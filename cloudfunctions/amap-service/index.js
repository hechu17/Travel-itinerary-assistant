import { createServer } from 'node:http';

const PORT = Number(process.env.PORT) || 9000;
const SERVICE_PREFIX = '/_AMapService';
const ROUTE_TARGETS = [
  {
    prefix: 'v4/map/styles',
    origin: 'https://webapi.amap.com',
  },
  {
    prefix: 'v3/vectormap',
    origin: 'https://fmap01.amap.com',
  },
];

function normalizeServicePath(pathname) {
  return pathname
    .replace(new RegExp(`^${SERVICE_PREFIX}`), '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function getTargetOrigin(servicePath) {
  const matched = ROUTE_TARGETS.find((target) => servicePath.startsWith(target.prefix));
  return matched?.origin || 'https://restapi.amap.com';
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function copyResponseHeaders(upstreamResponse, res) {
  upstreamResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!['connection', 'content-encoding', 'transfer-encoding'].includes(lowerKey)) {
      res.setHeader(key, value);
    }
  });
}

async function handleProxy(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const jscode = process.env.AMAP_SECURITY_JS_CODE;

  if (!jscode) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'AMAP_SECURITY_JS_CODE is not configured.' }));
    return;
  }

  const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const servicePath = normalizeServicePath(requestUrl.pathname);

  if (!servicePath) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Missing AMap service path.' }));
    return;
  }

  requestUrl.searchParams.set('jscode', jscode);

  const upstreamUrl = `${getTargetOrigin(servicePath)}/${servicePath}${requestUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await collectRequestBody(req);
  const upstreamResponse = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  res.statusCode = upstreamResponse.status;
  copyResponseHeaders(upstreamResponse, res);

  const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
  res.end(buffer);
}

const server = createServer((req, res) => {
  handleProxy(req, res).catch((error) => {
    console.error('AMap proxy failed:', error);
    setCorsHeaders(res);
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'AMap proxy failed.' }));
  });
});

server.listen(PORT, () => {
  console.log(`AMap service proxy listening on ${PORT}`);
});

