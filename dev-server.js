const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const apiHandler = require('./api/ayrd');
const quotesHandler = require('./api/quotes');
const goldHandler = require('./api/gold');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/ayrd' || pathname === '/api/quotes' || pathname === '/api/gold') {
    const apiHandler = pathname === '/api/quotes' ? quotesHandler : pathname === '/api/gold' ? goldHandler : require('./api/ayrd');
    const adapter = {
      setHeader: (key, value) => res.setHeader(key, value),
      status(code) { res.statusCode = code; return this; },
      json(value) { res.end(JSON.stringify(value)); return value; }
    };
    try { await apiHandler(req, adapter); }
    catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: 'تعذّر تشغيل API محلياً.' })); }
    return;
  }
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
}).listen(Number(process.env.PORT || 4173), '0.0.0.0', () => {
  console.log(`محفظتي dev server listening on 0.0.0.0:${process.env.PORT || 4173}`);
});
