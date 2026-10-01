import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';

const MAX_REQUEST_BYTES = 200_000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseEnvFile(path) {
  if (!path || !existsSync(path)) return {};

  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let [, name, value] = match;
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[name] = value;
  }
  return values;
}

function isLoopbackOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    ...(isLoopbackOrigin(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

function sendJson(response, status, origin, body) {
  response.writeHead(status, {
    ...corsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function readRequest(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error('Request body exceeds the local proxy limit.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

const localSettings = parseEnvFile(resolve(process.cwd(), '.env.local'));
const keyFile = process.env.LOCAL_AI_ENV_FILE || localSettings.LOCAL_AI_ENV_FILE;
const keyFileSettings = parseEnvFile(keyFile);
const apiKey = process.env.OPENAI_API_KEY
  || keyFileSettings.OPENAI_API_KEY
  || keyFileSettings.EXPO_PUBLIC_OPENAI_API_KEY;
const requestedPort = Number(process.env.LOCAL_AI_PROXY_PORT || localSettings.LOCAL_AI_PROXY_PORT || 8787);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536
  ? requestedPort
  : 8787;

if (!apiKey) {
  console.error('No API key found. Set OPENAI_API_KEY or LOCAL_AI_ENV_FILE in .env.local.');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, origin, { ok: true });
    return;
  }

  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    sendJson(response, 404, origin, { error: { message: 'Not found.' } });
    return;
  }

  if (origin && !isLoopbackOrigin(origin)) {
    sendJson(response, 403, origin, { error: { message: 'This local proxy only accepts loopback origins.' } });
    return;
  }

  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    sendJson(response, 413, origin, { error: { message: 'Request body exceeds the local proxy limit.' } });
    return;
  }

  try {
    const body = await readRequest(request);
    JSON.parse(body.toString('utf8'));

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(55_000),
    });

    response.writeHead(upstream.status, {
      ...corsHeaders(origin),
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    if (!upstream.body) {
      response.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'OpenAI request timed out.'
      : 'Unable to complete the local AI request.';
    sendJson(response, 502, origin, { error: { message } });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local AI proxy listening at http://127.0.0.1:${port}`);
});
