import http from 'http';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';

const PORT = Number(process.env.STREAM_TUNNEL_PORT || 7010);
const API_KEY = process.env.STREAM_TUNNEL_API_KEY || '';
const SIGNING_SECRET = process.env.STREAM_TUNNEL_SIGNING_SECRET || '';
const REQUEST_TIMEOUT_MS = Number(process.env.STREAM_TUNNEL_REQUEST_TIMEOUT_MS || 15000);

/**
 * agentId -> { ws, lastSeenAt }
 */
const agents = new Map();

/**
 * jobId -> { resolve, reject, timer }
 */
const inflight = new Map();

function b64urlDecodeToString(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function timingSafeEqHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function verifySignedPayload(payloadObj, sigHex) {
  if (!SIGNING_SECRET) return false;
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const expect = crypto.createHmac('sha256', SIGNING_SECRET).update(payloadB64).digest('hex');
  return timingSafeEqHex(expect, sigHex);
}

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
    const exp = Number.isFinite(Number(body?.exp)) ? Number(body.exp) : null;
    const nonce = typeof body?.nonce === 'string' ? body.nonce : null;
    const mediaId = typeof body?.media_id === 'string' ? body.media_id : null;
    const userId = Number.isFinite(Number(body?.user_id)) ? Number(body.user_id) : null;
    const sig = typeof body?.sig === 'string' ? body.sig : null;

    if (!agentId || !filePath || start === null || end === null || exp === null || !nonce || !mediaId || userId === null || !sig) {
      return json(res, 400, { error: 'Missing fields' });
    }

    if (!SIGNING_SECRET) {
      return json(res, 500, { error: 'Signing secret not configured' });
    }

    if (Date.now() > exp * 1000) {
      return json(res, 401, { error: 'Expired' });
    }

    const payloadForSig = { agent_id: agentId, file_path: filePath, start, end, media_id: mediaId, user_id: userId, exp, nonce };
    if (!verifySignedPayload(payloadForSig, sig)) {
      return json(res, 401, { error: 'Bad signature' });
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

      const status = Number(resp?.status ?? 500);
      const headers = resp?.headers && typeof resp.headers === 'object' ? resp.headers : {};
      const bodyBuf = Buffer.isBuffer(resp?.body) ? resp.body : Buffer.alloc(0);

      // Write raw bytes back to backend.
      res.writeHead(status, headers);
      res.end(bodyBuf);
      return;
    } catch {
      return json(res, 504, { error: 'Stream timeout' });
    }
  }

  json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server, path: '/agent' });

wss.on('connection', (ws, req) => {
  // Expect first message: { kind:'hello', token }
  let boundAgentId = null;
  let expectingBinaryJobId = null;

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString('utf8'));
    } catch {
      return;
    }

    if (msg?.kind === 'hello') {
      const token = typeof msg?.token === 'string' ? msg.token : null;
      if (!token) {
        ws.close(1008, 'missing agent_id');
        return;
      }

      if (!SIGNING_SECRET) {
        ws.close(1008, 'signing_secret_missing');
        return;
      }

      const parts = token.split('.');
      if (parts.length !== 2) {
        ws.close(1008, 'bad_token');
        return;
      }

      const payloadB64 = parts[0];
      const sig = parts[1];

      let payload;
      try {
        payload = JSON.parse(b64urlDecodeToString(payloadB64));
      } catch {
        ws.close(1008, 'bad_token');
        return;
      }

      const expect = crypto.createHmac('sha256', SIGNING_SECRET).update(payloadB64).digest('hex');
      if (!timingSafeEqHex(expect, sig)) {
        ws.close(1008, 'unauthorized');
        return;
      }

      const agentId = typeof payload?.agent_id === 'string' ? payload.agent_id : null;
      const exp = Number.isFinite(Number(payload?.exp)) ? Number(payload.exp) : null;
      if (!agentId || exp === null || Date.now() > exp * 1000) {
        ws.close(1008, 'expired');
        return;
      }

      // Optional extra key check.
      if (API_KEY) {
        const key = msg?.api_key;
        if (key !== API_KEY) {
          ws.close(1008, 'unauthorized');
          return;
        }
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

      // If this is metadata, wait for binary next.
      expectingBinaryJobId = jobId;
      entry.meta = {
        status: Number(msg?.status ?? 500),
        headers: typeof msg?.headers === 'object' && msg?.headers ? msg.headers : {},
      };
      return;
    }

    if (msg?.kind === 'stream_response') {
      return;
    }
  });

  ws.on('message', (buf, isBinary) => {
    if (!isBinary) return;
    if (!expectingBinaryJobId) return;

    const jobId = expectingBinaryJobId;
    expectingBinaryJobId = null;

    const entry = inflight.get(jobId);
    if (!entry) return;

    clearTimeout(entry.timer);
    inflight.delete(jobId);

    const meta = entry.meta || { status: 500, headers: {} };
    entry.resolve({ status: meta.status, headers: meta.headers, body: Buffer.from(buf) });
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
