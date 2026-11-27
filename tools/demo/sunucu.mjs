// DEMO: docs/ klasörünü veritabanı olmadan sunar. Supabase kütüphanesi yerine tools/demo/sahte-supabase.js yüklenir.
// Veriler yalnızca tarayıcının yerel depolamasında tutulur; gerçek veritabanına hiçbir istek gitmez.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(BURASI, "../../docs");
const SAHTE = path.join(BURASI, "sahte-supabase.js");
const PORT = Number(process.env.PORT) || 4322;
const TIP = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".xml": "text/xml", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };
const gonder = (res, tip, govde) => { res.writeHead(200, { "Content-Type": tip, "Cache-Control": "no-store" }); res.end(govde); };

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === "/__sahte.js") return gonder(res, TIP[".js"], fs.readFileSync(SAHTE));
  if (p.endsWith("/assets/config.js")) return gonder(res, TIP[".js"], 'window.ED_CONFIG={SUPABASE_URL:"http://fake",SUPABASE_ANON_KEY:"fake"};');
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(KOK, p);
  if (!f.startsWith(KOK + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("404"); }
  let govde = fs.readFileSync(f);
  if (f.endsWith(".html")) govde = govde.toString("utf-8").replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/dist\/umd\/supabase\.js/, "/__sahte.js");
  gonder(res, TIP[path.extname(f)] || "application/octet-stream", govde);
}).listen(PORT, "127.0.0.1", () => console.log(`Demo: http://localhost:${PORT}`));
