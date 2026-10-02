import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'frontend', 'dist');
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function staticFile(response, pathname) {
  const relative = pathname === '/' ? '/harvestlink.html' : pathname;
  const file = normalize(join(publicRoot, relative));
  if (!file.startsWith(publicRoot + sep)) return json(response, 400, { error: 'Bad path' });
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    json(response, 404, { error: 'Not found' });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://' + (request.headers.host || 'localhost'));
  if (url.pathname === '/healthz') return json(response, 200, { status: 'ok' });
  if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed' });
  return staticFile(response, url.pathname);
});

server.listen(port, '0.0.0.0', () => console.log('Neighbor-Cart listening on ' + port));
