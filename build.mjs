// Örnek site üreticisi: data/posts.jsonl -> docs/ (GitHub Pages)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const DIST = path.join(ROOT, "docs");
const posts = fs.readFileSync(path.join(ROOT, "data/posts.jsonl"), "utf-8")
  .split("\n").filter(Boolean).map(l => JSON.parse(l));

// ---------- Temalar / kampanyalar ----------
const THEMES = [
  { slug: "yok-tartismasi", name: "YÖK Başkanı tartışması", re: /özvar|yök/i,
    desc: "YÖK Başkanı Erol Özvar'ın açıklamalarına verilen tepkiler ve cevaplar." },
  { slug: "gida-takviyesi", name: "Gıda takviyesi ve internet satışı", re: /takviye|internet/i,
    desc: "Kontrolsüz internet satışı, gıda takviyelerinin denetimi ve halk sağlığı." },
  { slug: "cumartesi-kapansin", name: "Cumartesi kapanışı ve nöbet", re: /cumartesi|nöbet|kapans/i,
    desc: "#EczanelerCumartesiKapansın kampanyası ve çalışma düzeni tartışması." },
  { slug: "atama-kadro", name: "Atama, kadro ve işsizlik", re: /atama|işsiz|kadro/i,
    desc: "Eczacı ve diş hekimi atamaları, kadro sayıları, işsizlik." },
  { slug: "oda-secimleri", name: "Oda, TEB ve seçimler", re: /\boda\b|odası|\bteb\b|seçim|birlik/i,
    desc: "Eczacı odaları, Türk Eczacıları Birliği ve seçim süreçleri." },
  { slug: "yeni-fakulteler", name: "Yeni eczacılık fakülteleri", re: /fakülte/i,
    desc: "Açılan yeni fakülteler, kontenjanlar ve mesleğin geleceği." },
  { slug: "ucret-sgk", name: "Ücret, zam ve SGK", re: /\bzam\b|sgk|maaş|ücret|sigorta/i,
    desc: "Çalışma koşulları, ücretler, sigortasız çalıştırma ve ilaç fiyatları." },
  { slug: "vatan-gazi", name: "Gaziler ve vatan", re: /gazi|atatürk|bayrak|vatan|şehit|asker/i,
    desc: "Gazilerin hakları, şehitler ve vatansever mesajlar." },
];

const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const fmtDate = iso => { const d = new Date(iso); return `${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function clean(c) { return c.replace(/#\S+/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }

for (const p of posts) {
  p.text = clean(p.caption);
  p.themes = THEMES.filter(t => t.re.test(p.caption)).map(t => t.slug);
  const first = (p.text.split(/\n/).find(l => l.trim()) || "").trim();
  p.title = first.length > 90 ? first.slice(0, 87).replace(/\s+\S*$/, "") + "…" : first;
  p.img = fs.existsSync(path.join(ROOT, "assets/posts", p.shortcode + ".jpg"));
  p.rich = p.text.length >= 80;                  // metni yeterince uzun
  p.article = p.rich || p.img;                   // görseli ya da metni varsa kendi sayfası olur
  if (!p.title) p.title = `Görsel paylaşım · ${fmtDate(p.date)}`;
  p.slug = p.shortcode;
}
posts.sort((a, b) => b.date.localeCompare(a.date));
const articles = posts.filter(p => p.article);

// ---------- Şablon ----------
const CSS = fs.readFileSync(path.join(ROOT, "style.css"), "utf-8");

const NAV = [["/", "Ana sayfa"], ["/gundem.html", "Gündem"], ["/kampanyalar.html", "Kampanyalar"], ["/arsiv.html", "Arşiv"], ["/hakkimizda.html", "Hakkımızda"]];

const SITE_URL = "https://gitahmetcelik.github.io/eczacidirenisi-site"; // alt yol dahil, sonunda / yok

function layout({ title, desc = "", body, active = "/", depth = 0, path: pagePath = "", ld = null, type = "website", image = "assets/logo.jpg" }) {
  const base = depth ? "../".repeat(depth) : "./";
  const nav = NAV.map(([h, n]) => `<a href="${base}${h.slice(1)}"${h === active ? ' class="on" aria-current="page"' : ""}>${n}</a>`).join("");
  const url = `${SITE_URL}/${pagePath}`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#e30a17"><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="${base}assets/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Source+Serif+4:wght@400;700&display=swap" rel="stylesheet">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:locale" content="tr_TR"><meta property="og:image" content="${SITE_URL}/${image || "assets/logo.jpg"}"><meta name="twitter:card" content="summary_large_image">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
<script>document.documentElement.classList.add('js')</script>
<style>${CSS}</style></head><body>
<a class="skip" href="#icerik">İçeriğe geç</a>
<header class="site"><div class="wrap"><a class="brand" href="${base}index.html" aria-label="Eczacı Direnişi ana sayfa"><img src="${base}assets/logo.jpg" alt="" width="52" height="52"><span>Eczacı <b>Direnişi</b></span></a><nav aria-label="Ana menü">${nav}</nav></div></header>
<main id="icerik"><div class="wrap">${body}</div></main>
<footer><div class="wrap">Örnek çalışma, resmî site değildir · İçerik <a href="https://www.instagram.com/eczacidirenisi/">@eczacidirenisi</a> Instagram hesabından derlenmiştir.</div></footer>
<script>
(function(){
  var els=[].slice.call(document.querySelectorAll('main h2,.card,.list .item,.pn a,.note,.facts'));
  var idx=new Map();
  els.forEach(function(e){var p=e.parentNode,n=idx.get(p)||0;idx.set(p,n+1);e.classList.add('rv');e.style.setProperty('--d',Math.min(n,5)*70+'ms')});
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:0});
  els.forEach(function(e){io.observe(e)});
})();
</script>
</body></html>`;
}

const themeBy = slug => THEMES.find(t => t.slug === slug);
const tags = (p, base) => p.themes.slice(0, 3).map(s => `<a class="tag" href="${base}kampanya/${s}.html">${esc(themeBy(s).name)}</a>`).join("");
const excerpt = (t, n = 160) => t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t;
const postHref = (p, base) => p.article ? `${base}yazi/${p.slug}.html` : p.url;

const imgSrc = (p, base) => `${base}assets/posts/${p.slug}.jpg`;
function card(p, base, big = false) {
  return `<a class="card${big ? " big" : ""}" href="${postHref(p, base)}">${p.img ? `<img class="thumb" src="${imgSrc(p, base)}" alt="" loading="${big ? "eager" : "lazy"}" decoding="async">` : ""}
<div class="meta">${fmtDate(p.date)} · ${p.likes} beğeni</div><h3>${esc(p.title)}</h3>
<p>${esc(excerpt(p.text.replace(p.title, "").trim() || p.text, big ? 260 : 140))}</p></a>`;
}
function item(p, base) {
  const sub = p.rich ? `<p>${esc(excerpt(p.text.replace(p.title, "").trim(), 200))}</p>` : `<p>İçerik görselin içinde.</p>`;
  return `<a class="item${p.img ? " has-img" : ""}" href="${postHref(p, base)}" data-themes="${p.themes.join(" ")}" data-q="${esc((p.title + " " + p.text).toLowerCase())}">
${p.img ? `<img class="thumb" src="${imgSrc(p, base)}" alt="" loading="lazy" decoding="async">` : ""}<div>
<div class="meta">${fmtDate(p.date)} · ${p.type === "GraphVideo" ? "Video" : p.type === "GraphSidecar" ? "Çoklu görsel" : "Görsel"} · ${p.likes} beğeni</div>
<h3>${esc(p.title)}</h3>${sub}</div></a>`;
}

function write(rel, html) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html, "utf-8");
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });

// ---------- Ana sayfa ----------
const rich = posts.filter(p => p.rich);
const seenTitles = new Set();
const byLikes = [...rich].sort((a, b) => b.likes - a.likes).filter(p => !seenTitles.has(p.title) && seenTitles.add(p.title));
const featured = byLikes[0];
const popular = byLikes.slice(1, 4);
const latest = rich.slice(0, 9);
const counts = Object.fromEntries(THEMES.map(t => [t.slug, posts.filter(p => p.themes.includes(t.slug)).length]));

write("index.html", layout({
  title: "Eczacı Direnişi", desc: "Vatansever Genç Türk Eczacılar Topluluğu", active: "/", path: "",
  ld: { "@context": "https://schema.org", "@type": "Organization", name: "Eczacı Direnişi", url: SITE_URL, sameAs: ["https://www.instagram.com/eczacidirenisi/"] },
  body: `<div class="intro"><span class="kicker">${posts.length} paylaşım · ${THEMES.length} kampanya</span>
<h1>Vatansever Genç Türk Eczacılar Topluluğu</h1></div>
<h2>Öne çıkan</h2>
<div class="hero">${card(featured, "./", true)}<div style="display:grid;gap:16px">${popular.map(p => card(p, "./")).join("")}</div></div>
<h2>Kampanyalar</h2>
<div class="grid">${THEMES.map(t => `<a class="card" href="kampanya/${t.slug}.html"><div class="meta">${counts[t.slug]} paylaşım</div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></a>`).join("")}</div>
<h2>Son yazılar</h2><div class="list">${latest.map(p => item(p, "./")).join("")}</div>
<p><a class="btn ghost" href="arsiv.html">Tüm arşiv →</a></p>`
}));

// ---------- Gündem ----------
write("gundem.html", layout({
  title: "Gündem · Eczacı Direnişi", active: "/gundem.html", path: "gundem.html", desc: "Son açıklamalar ve tepkiler.",
  body: `<h1>Gündem</h1><p class="lead">Son açıklamalar ve tepkiler, tarih sırasıyla.</p>
<div class="list">${rich.slice(0, 40).map(p => item(p, "./")).join("")}</div>
<p><a class="btn ghost" href="arsiv.html">Daha eski paylaşımlar için arşiv →</a></p>`
}));

// ---------- Kampanyalar ----------
write("kampanyalar.html", layout({
  title: "Kampanyalar · Eczacı Direnişi", active: "/kampanyalar.html", path: "kampanyalar.html", desc: "Süreklilik gösteren konular, tek sayfada.",
  body: `<h1>Kampanyalar</h1><p class="lead">Süreklilik gösteren konular, tek sayfada toplanmış.</p>
<div class="grid" style="margin-top:20px">${THEMES.map(t => `<a class="card" href="kampanya/${t.slug}.html"><div class="meta">${counts[t.slug]} paylaşım</div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></a>`).join("")}</div>`
}));

for (const t of THEMES) {
  const list = posts.filter(p => p.themes.includes(t.slug));
  const tl = list.filter(p => p.article);
  write(`kampanya/${t.slug}.html`, layout({
    title: `${t.name} · Eczacı Direnişi`, desc: t.desc, active: "/kampanyalar.html", depth: 1, path: `kampanya/${t.slug}.html`,
    body: `<p class="meta"><a href="../kampanyalar.html">← Kampanyalar</a></p><h1>${esc(t.name)}</h1>
<p class="lead">${esc(t.desc)}</p>
<p class="facts"><span><b>${list.length}</b> paylaşım</span><span>İlk paylaşım <b>${list.length ? fmtDate(list[list.length - 1].date) : "-"}</b></span><span><b>${list.reduce((s, p) => s + p.likes, 0).toLocaleString("tr-TR")}</b> toplam beğeni</span></p>
<h2>Zaman çizelgesi</h2><div class="list">${(tl.length ? tl : list).slice(0, 60).map(p => item(p, "../")).join("")}</div>`
  }));
}

// ---------- Yazılar ----------
for (const [i, p] of articles.entries()) {
  const rel = posts.filter(x => x.rich && x.slug !== p.slug && x.themes.some(s => p.themes.includes(s))).slice(0, 4);
  const newer = articles[i - 1], older = articles[i + 1];
  const minutes = Math.max(1, Math.round(p.text.split(/\s+/).length / 200));
  write(`yazi/${p.slug}.html`, layout({
    title: `${p.title} · Eczacı Direnişi`, desc: excerpt(p.text, 150) || "Eczacı Direnişi Instagram paylaşımı", active: "/gundem.html", depth: 1,
    path: `yazi/${p.slug}.html`, type: "article", image: p.img ? `assets/posts/${p.slug}.jpg` : "",
    ld: { "@context": "https://schema.org", "@type": "NewsArticle", headline: p.title.slice(0, 110), datePublished: p.date + "Z",
      publisher: { "@type": "Organization", name: "Eczacı Direnişi" }, mainEntityOfPage: `${SITE_URL}/yazi/${p.slug}.html` },
    body: `<div class="progress" id="pg"></div><article class="post"><p class="meta"><a href="../gundem.html">← Gündem</a></p>
<div>${tags(p, "../")}</div><h1>${esc(p.title)}</h1>
<p class="facts"><span><time datetime="${p.date}">${fmtDate(p.date)}</time></span><span>${minutes} dk okuma</span><span>${p.likes} beğeni</span><span>${p.comments} yorum</span></p>
${p.img ? `<figure class="shot"><img src="../assets/posts/${p.slug}.jpg" alt="${p.rich ? "Paylaşımın görseli" : "Paylaşım görseli (metin görselin içindedir)"}" decoding="async"></figure>` : ""}
${p.rich ? `<div class="body">${esc(p.text.replace(p.title, "").trim() || p.text)}</div>` : ""}
<p class="note">Bu yazı Instagram paylaşımından derlenmiştir. Orijinal görsel ve yorumlar için Instagram'a bakın.</p>
<div class="actions"><a class="btn" href="${p.url}">Instagram'da gör</a>
<button class="btn ghost" id="share" type="button">Bağlantıyı kopyala</button></div></article>
<nav class="pn" aria-label="Yazılar arası gezinme">${older ? `<a href="${older.slug}.html"><small>← Önceki</small>${esc(excerpt(older.title, 70))}</a>` : "<span></span>"}${newer ? `<a class="next" href="${newer.slug}.html"><small>Sonraki →</small>${esc(excerpt(newer.title, 70))}</a>` : "<span></span>"}</nav>
${rel.length ? `<h2>İlgili yazılar</h2><div class="list">${rel.map(x => item(x, "../")).join("")}</div>` : ""}
<script>
const pg=document.getElementById('pg');addEventListener('scroll',()=>{const h=document.documentElement;pg.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight||1)*100)+'%'},{passive:true});
document.getElementById('share').addEventListener('click',async e=>{const b=e.currentTarget;try{await navigator.clipboard.writeText(location.href);b.textContent='Kopyalandı ✓'}catch{b.textContent='Kopyalanamadı'}setTimeout(()=>b.textContent='Bağlantıyı kopyala',2000)});
</script>`
  }));
}

// ---------- 404, sitemap, robots ----------
write("404.html", layout({
  title: "Sayfa bulunamadı · Eczacı Direnişi", active: "", path: "404.html",
  body: `<h1>Sayfa bulunamadı</h1><p class="lead">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
<p><a class="btn" href="${SITE_URL}/index.html">Ana sayfaya dön</a> <a class="btn ghost" href="${SITE_URL}/arsiv.html">Arşivde ara</a></p>`
}));
const urls = ["", "gundem.html", "kampanyalar.html", "arsiv.html", "hakkimizda.html",
  ...THEMES.map(t => `kampanya/${t.slug}.html`), ...articles.map(p => `yazi/${p.slug}.html`)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join("")}</urlset>`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// ---------- Arşiv ----------
write("arsiv.html", layout({
  title: "Arşiv · Eczacı Direnişi", active: "/arsiv.html", path: "arsiv.html", desc: "Tüm paylaşımlar, konuya göre filtrelenebilir.",
  body: `<h1>Arşiv</h1><p class="lead">${posts.length} paylaşımın tamamı. Konuya göre filtrele ya da ara.</p>
<div class="filters"><input id="q" type="search" placeholder="Ara…" aria-label="Ara">
<button class="on" data-t="">Tümü</button>${THEMES.map(t => `<button data-t="${t.slug}">${esc(t.name)}</button>`).join("")}</div>
<p class="meta" id="count"></p><div class="list" id="list">${posts.map(p => item(p, "./")).join("")}</div>
<script>
const items=[...document.querySelectorAll('#list .item')],q=document.getElementById('q'),c=document.getElementById('count');let t='';
function run(){const s=q.value.toLowerCase().trim();let n=0;items.forEach(e=>{const ok=(!t||e.dataset.themes.split(' ').includes(t))&&(!s||e.dataset.q.includes(s));e.style.display=ok?'':'none';if(ok)n++});c.textContent=n+' sonuç'}
q.addEventListener('input',run);document.querySelectorAll('.filters button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('on'));b.classList.add('on');t=b.dataset.t;run()}));run();
</script>`
}));

// ---------- Hakkımızda ----------
write("hakkimizda.html", layout({
  title: "Hakkımızda · Eczacı Direnişi", active: "/hakkimizda.html", path: "hakkimizda.html", desc: "Vatansever Genç Türk Eczacılar Topluluğu hakkında.",
  body: `<article class="post"><h1>Hakkımızda</h1>
<p class="lead">Vatansever Genç Türk Eczacılar Topluluğu.</p>
<p>Bu sayfa örnek metindir. Topluluğun amacı, çalışma biçimi ve iletişim bilgileri burada yer alacak.</p>
<p><a class="btn" href="https://www.instagram.com/eczacidirenisi/">Instagram'da takip et</a></p></article>`
}));

console.log("Ana sayfa görselsiz:", [featured, ...popular, ...latest].filter(p => !p.img).map(p => p.slug).join(" ") || "yok");
console.log(`Üretildi: ${posts.length} paylaşım, ${articles.length} yazı sayfası, ${THEMES.length} kampanya → docs/`);
