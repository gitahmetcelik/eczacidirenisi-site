// Basit statik sunucu: docs/ klasörünü 4321 portunda yayınlar
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "docs");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(path.join(root, "404.html")));
  }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(4321, () => console.log("http://localhost:4321"));
