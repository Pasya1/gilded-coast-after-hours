import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./game/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const port = Number(process.env.PORT || 4176);
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(resolve(root) + sep)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!(await stat(filename)).isFile()) throw new Error('Not a file');
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Gilded Coast is ready: http://127.0.0.1:${port} (PID ${process.pid})`));
