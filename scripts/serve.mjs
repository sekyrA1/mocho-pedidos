import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = path === '/' ? 'index.html' : path.slice(1);
    if (relative.split('/').some(part => part.startsWith('.')) || !/^(assets\/|[^/]+\.(html|css|js)$)/.test(relative)) throw new Error('Denied');
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) throw new Error('Denied');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end('Não encontrado'); }
}).listen(3000, '127.0.0.1', () => console.log('Mocho: http://localhost:3000'));
