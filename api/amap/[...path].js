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

function getServicePath(pathQuery) {
  const segments = Array.isArray(pathQuery) ? pathQuery : [pathQuery].filter(Boolean);
  return segments.map((segment) => String(segment).replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

function getTargetOrigin(servicePath) {
  const matched = ROUTE_TARGETS.find((target) => servicePath.startsWith(target.prefix));
  return matched?.origin || 'https://restapi.amap.com';
}

function appendQuery(params, key, value) {
  if (Array.isArray(value)) {
    value.forEach((item) => params.append(key, item));
    return;
  }

  if (value !== undefined && value !== null) {
    params.append(key, value);
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const jscode = process.env.AMAP_SECURITY_JS_CODE;

  if (!jscode) {
    res.status(500).json({ error: 'AMAP_SECURITY_JS_CODE is not configured on the server.' });
    return;
  }

  const servicePath = getServicePath(req.query.path);

  if (!servicePath) {
    res.status(400).json({ error: 'Missing AMap service path.' });
    return;
  }

  const query = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'path') appendQuery(query, key, value);
  });
  query.set('jscode', jscode);

  const upstreamUrl = `${getTargetOrigin(servicePath)}/${servicePath}?${query.toString()}`;
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readRequestBody(req);
  const upstreamResponse = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  res.status(upstreamResponse.status);
  upstreamResponse.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
  res.send(buffer);
}
