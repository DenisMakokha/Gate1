/**
 * Gate1 System - GitHub Webhook Server
 * Listens for push events and triggers deployment
 * 
 * Usage: node webhook-server.js
 * Or with PM2: pm2 start webhook-server.js --name gate1-webhook
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = 9001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-here';
const DEPLOY_SCRIPT = '/opt/apps/gate1/deploy/deploy.sh';

function verifySignature(payload, signature) {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

function runDeployment() {
    console.log(`[${new Date().toISOString()}] Starting deployment...`);
    
    exec(`bash ${DEPLOY_SCRIPT}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${new Date().toISOString()}] Deployment error:`, error.message);
            console.error(stderr);
            return;
        }
        console.log(`[${new Date().toISOString()}] Deployment output:`, stdout);
        console.log(`[${new Date().toISOString()}] Deployment completed successfully!`);
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            const signature = req.headers['x-hub-signature-256'];
            
            // Verify webhook signature
            if (!verifySignature(body, signature)) {
                console.log(`[${new Date().toISOString()}] Invalid signature`);
                res.writeHead(401);
                res.end('Unauthorized');
                return;
            }
            
            try {
                const payload = JSON.parse(body);
                
                // Only deploy on push to main branch
                if (payload.ref === 'refs/heads/main') {
                    console.log(`[${new Date().toISOString()}] Push to main detected from ${payload.pusher?.name || 'unknown'}`);
                    res.writeHead(200);
                    res.end('Deployment started');
                    runDeployment();
                } else {
                    console.log(`[${new Date().toISOString()}] Ignoring push to ${payload.ref}`);
                    res.writeHead(200);
                    res.end('Ignored - not main branch');
                }
            } catch (e) {
                console.error(`[${new Date().toISOString()}] Error parsing payload:`, e.message);
                res.writeHead(400);
                res.end('Bad request');
            }
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'gate1-webhook' }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[${new Date().toISOString()}] Gate1 Webhook Server listening on port ${PORT}`);
});
