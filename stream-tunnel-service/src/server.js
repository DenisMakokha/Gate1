import http from 'http';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';

const PORT = Number(process.env.STREAM_TUNNEL_PORT || 7010);
const API_KEY = process.env.STREAM_TUNNEL_API_KEY || '';
const REQUEST_TIMEOUT_MS = Number(process.env.STREAM_TUNNEL_REQUEST_TIMEOUT_MS || 15000);

/**
 * agentId -> { ws, lastSeenAt }
 */
const agents = new Map();

/**
 * jobId -> { resolve, reject, timer }
 */
const inflight = new Map();

function json(res, statusCode, body) {
  const out = Buffer.from(JSON.stringify(body));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': String(out.length),
  });
  res.end(out);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const s = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(s));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function ensureApiKey(req, res) {
  if (!API_KEY) return true;
  const got = req.headers['x-tunnel-key'];
  if (got !== API_KEY) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, agents: agents.size });
  }

  if (req.method === 'POST' && req.url === '/stream/request') {
    if (!ensureApiKey(req, res)) return;

    let body;
    try {
      body = await readJson(req);
    } catch {
      return json(res, 400, { error: 'Invalid JSON' });
    }

    const agentId = typeof body?.agent_id === 'string' ? body.agent_id : null;
    const filePath = typeof body?.file_path === 'string' ? body.file_path : null;
    const start = Number.isFinite(Number(body?.start)) ? Number(body.start) : null;
    const end = Number.isFinite(Number(body?.end)) ? Number(body.end) : null;

    if (!agentId || !filePath || start === null || end === null) {
      return json(res, 400, { error: 'Missing fields' });
    }

    const agent = agents.get(agentId);
    if (!agent?.ws || agent.ws.readyState !== agent.ws.OPEN) {
      return json(res, 404, { error: 'Agent offline' });
    }

    const jobId = crypto.randomUUID();

    const p = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        inflight.delete(jobId);
        reject(new Error('timeout'));
      }, REQUEST_TIMEOUT_MS);

      inflight.set(jobId, { resolve, reject, timer });
    });

    agent.ws.send(
      JSON.stringify({
        kind: 'stream_request',
        job_id: jobId,
        file_path: filePath,
        start,
        end,
      })
    );

    try {
      const resp = await p;
      return json(res, 200, resp);
    } catch {
      return json(res, 504, { error: 'Stream timeout' });
    }
  }

  json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server, path: '/agent' });

wss.on('connection', (ws, req) => {
  // Expect first message: { kind:'hello', agent_id, api_key }
  let boundAgentId = null;

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString('utf8'));
    } catch {
      return;
    }

    if (msg?.kind === 'hello') {
      const agentId = typeof msg?.agent_id === 'string' ? msg.agent_id : null;
      const key = msg?.api_key;

      if (!agentId) {
        ws.close(1008, 'missing agent_id');
        return;
      }

      if (API_KEY && key !== API_KEY) {
        ws.close(1008, 'unauthorized');
        return;
      }

      boundAgentId = agentId;
      agents.set(agentId, { ws, lastSeenAt: Date.now() });
      ws.send(JSON.stringify({ kind: 'hello_ack', ok: true }));
      return;
    }

    if (msg?.kind === 'stream_response') {
      const jobId = msg?.job_id;
      if (typeof jobId !== 'string') return;

      const entry = inflight.get(jobId);
      if (!entry) return;

      clearTimeout(entry.timer);
      inflight.delete(jobId);

      entry.resolve({
        status: Number(msg?.status ?? 500),
        headers: typeof msg?.headers === 'object' && msg?.headers ? msg.headers : {},
        data_base64: typeof msg?.data_base64 === 'string' ? msg.data_base64 : null,
        error: typeof msg?.error === 'string' ? msg.error : null,
      });
      return;
    }
  });

  ws.on('close', () => {
    if (boundAgentId && agents.get(boundAgentId)?.ws === ws) {
      agents.delete(boundAgentId);
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`stream-tunnel listening on :${PORT}`);
});
