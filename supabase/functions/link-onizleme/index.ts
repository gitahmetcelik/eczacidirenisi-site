// Yönetici için haber bağlantısı önizlemesi: verilen adresin başlık, özet, görsel ve site adını döndürür.
// Yalnızca giriş yapmış YÖNETİCİLER çağırabilir. Dağıtım: Supabase paneli → Edge Functions → bu dosyanın içeriği.
// Önemli: işlev içinde kimlik doğrulaması yapıldığı için "Verify JWT" ayarı KAPALI olmalıdır.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;

function privateIp(h: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
function privateHost(raw: string): boolean {
  const h = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(h)) return true;
  if (h.includes(":")) return true;            // IPv6 adres biçimleri reddedilir
  if (privateIp(h)) return true;
  if (!h.includes(".")) return true;           // tek etiketli iç adlar
  return false;
}
async function checkUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Geçersiz adres"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Yalnızca http/https adresleri desteklenir");
  if (u.username || u.password) throw new Error("Geçersiz adres");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("Bu bağlantı noktası desteklenmiyor");
  if (privateHost(u.hostname)) throw new Error("Bu adrese erişilemez");
  try {   // alan adı iç ağa çözülüyorsa reddet (DNS çözümleme izni yoksa atlanır)
    const ips = await Deno.resolveDns(u.hostname, "A");
    if (ips.some(privateIp)) throw new Error("Bu adrese erişilemez");
  } catch (e) { if (e instanceof Error && e.message === "Bu adrese erişilemez") throw e; }
  return u;
}

function charsetOf(ct: string, head: Uint8Array): string {
  const h = /charset=["']?([\w-]+)/i.exec(ct);
  if (h) return h[1];
  const s = new TextDecoder("latin1").decode(head.subarray(0, 4096));
  const m = /<meta[^>]+charset=["']?([\w-]+)/i.exec(s) || /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(s);
  return m ? m[1] : "utf-8";
}
async function getHtml(start: URL): Promise<{ html: string; url: URL }> {
  let u = start;
  for (let i = 0; i < 4; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(u, {
        redirect: "manual", signal: ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; EczaciDirenisiOnizleme/1.0)", "Accept": "text/html,application/xhtml+xml", "Accept-Language": "tr,en;q=0.8" },
      });
    } catch { throw new Error("Siteye ulaşılamadı"); } finally { clearTimeout(timer); }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { await res.body?.cancel(); u = await checkUrl(new URL(loc, u).toString()); continue; }
    if (!res.ok) { await res.body?.cancel(); throw new Error(`Sayfa alınamadı (${res.status})`); }
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ct)) { await res.body?.cancel(); throw new Error("Bu adres bir web sayfası değil"); }
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    while (total < MAX_BYTES) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); total += value.length; }
    await reader.cancel().catch(() => {});
    const buf = new Uint8Array(Math.min(total, MAX_BYTES)); let off = 0;
    for (const c of chunks) { const part = c.subarray(0, Math.max(0, buf.length - off)); buf.set(part, off); off += part.length; }
    let html: string;
    try { html = new TextDecoder(charsetOf(ct, buf)).decode(buf); } catch { html = new TextDecoder("utf-8").decode(buf); }
    return { html, url: u };
  }
  throw new Error("Çok fazla yönlendirme");
}

const safeChar = (n: number) => { try { return String.fromCodePoint(n); } catch { return ""; } };
function decode(s: string): string {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => safeChar(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function attrs(tag: string): Record<string, string> {
  const o: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return o;
}
const clip = (s: string | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function parse(html: string, finalUrl: URL) {
  const head = html.slice(0, 250_000);
  const meta: Record<string, string> = {};
  for (const tag of head.match(/<meta\s[^>]*>/gi) ?? []) {
    const a = attrs(tag), key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = decode(a.content);
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = clip(meta["og:title"] || meta["twitter:title"] || (t ? decode(t[1]) : ""), 200);
  const description = clip(meta["og:description"] || meta["twitter:description"] || meta["description"], 500);
  let image = meta["og:image:secure_url"] || meta["og:image"] || meta["twitter:image"] || meta["twitter:image:src"] || "";
  if (image) {
    try {
      const iu = new URL(image, finalUrl);
      if (iu.protocol === "http:") iu.protocol = "https:";
      image = iu.protocol === "https:" && iu.toString().length <= 600 ? iu.toString() : "";
    } catch { image = ""; }
  }
  const site = clip(meta["og:site_name"] || finalUrl.hostname.replace(/^www\./, ""), 80);
  const published = clip(meta["article:published_time"] || meta["og:published_time"] || meta["datepublished"], 40);
  return { title, description, image, site, url: finalUrl.toString(), published };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Yalnızca POST kabul edilir" }, 405);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Giriş gerekli" }, 401);
    const key = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, key, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await sb.auth.getUser();
    if (ue || !u?.user) return json({ error: "Oturum geçersiz, yeniden giriş yap" }, 401);
    const { data: p } = await sb.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
    if (!p?.is_admin) return json({ error: "Bu işlem yalnızca yöneticiler içindir" }, 403);
    const body = await req.json().catch(() => ({}));
    const start = await checkUrl(String(body?.url ?? ""));
    const { html, url } = await getHtml(start);
    const out = parse(html, url);
    if (!out.title && !out.description) return json({ error: "Sayfadan başlık ya da özet okunamadı" }, 422);
    return json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Beklenmeyen hata" }, 502);
  }
});
