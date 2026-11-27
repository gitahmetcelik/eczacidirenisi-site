// Site üreticisi: statik kabuk sayfaları üretir (içerik Supabase veritabanından gelir) -> docs/ (GitHub Pages)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const DIST = path.join(ROOT, "docs");
// Eski yazi/KOD.html adreslerinin kodları (yeni sayfaya yönlendirilir)
const ESKI_KODLAR = JSON.parse(fs.readFileSync(path.join(ROOT, "eski-adresler.json"), "utf-8"));

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

// ---------- Site ayarları (site.json) ----------
const AYAR = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf-8"));
const OZ = { isIlanlari: true, akis: true, reklamKutulari: true, ...(AYAR.ozellikler || {}) };

// ---------- Şablon ----------
const CSS = fs.readFileSync(path.join(ROOT, "style.css"), "utf-8");

const NAV = [["/", "Ana sayfa"], ["/gundem.html", "Gündem"], ["/kose-yazilari.html", "Köşe yazıları"], OZ.akis && ["/akis.html", "Akış"], OZ.isIlanlari && ["/is-ilanlari.html", "İş ilanları"],
  ["/devir-ilanlari.html", "Devir ilanları"], ["/rehber.html", "Rehber"], ["/arsiv.html", "Arşiv"]].filter(Boolean);
const slot = (yer, cls = "") => `<div class="ad-slot${cls ? " " + cls : ""}" data-slot="${yer}" data-etiket="Reklam"></div>`;

const SITE_URL = "https://gitahmetcelik.github.io/eczacidirenisi-site"; // alt yol dahil, sonunda / yok

function layout({ title, desc = "", body, active = "/", depth = 0, path: pagePath = "", ld = null, type = "website", image = "assets/logo.jpg", noindex = false, reklam = true }) {
  const base = depth ? "../".repeat(depth) : "./";
  const nav = NAV.map(([h, n]) => `<a href="${base}${h.slice(1)}"${h === active ? ' class="on" aria-current="page"' : ""}>${n}</a>`).join("");
  const url = `${SITE_URL}/${pagePath}`;
  return `<!doctype html><html lang="tr" data-base="${base}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#e30a17">${noindex ? `<meta name="robots" content="noindex,nofollow">` : ""}
<link rel="icon" href="${base}assets/logo.jpg"><link rel="apple-touch-icon" href="${base}assets/logo.jpg"><link rel="manifest" href="${base}site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Source+Serif+4:wght@400;700&display=swap" rel="stylesheet">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:locale" content="tr_TR"><meta property="og:image" content="${SITE_URL}/${image || "assets/logo.jpg"}"><meta name="twitter:card" content="summary_large_image">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
<script>document.documentElement.classList.add('js');try{var _t=localStorage.getItem('ed-tema');if(_t==='koyu'||(_t==='sistem'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.setAttribute('data-theme','dark')}catch(e){}</script>
<style>${CSS}</style></head><body>
<a class="skip" href="#icerik">İçeriğe geç</a>
<header class="site"><div class="wrap"><a class="brand" href="${base}index.html" aria-label="Eczacı Direnişi ana sayfa"><img src="${base}assets/logo.jpg" alt="" width="52" height="52"><span>Eczacı <b>Direnişi</b></span></a><nav aria-label="Ana menü">${nav}</nav><div class="hdr-tools"><button class="tema-btn" id="tema" type="button" aria-label="Tema">◐</button><div class="auth" id="auth"></div></div></div></header>
<div class="shell">${reklam ? `<aside class="rail rail-l" aria-label="Reklam alanı">${slot("sol")}</aside>` : "<div></div>"}
<main id="icerik"><div class="wrap">${reklam ? slot("ust", "ad-banner") : ""}${body}${reklam ? slot("alt", "ad-banner") : ""}</div></main>
${reklam ? `<aside class="rail rail-r" aria-label="Reklam alanı">${slot("sag")}</aside>` : "<div></div>"}</div>
<footer><div class="wrap"><div class="foot">
<nav aria-label="İçerik"><b>İçerik</b><a href="${base}konular.html">Konular</a><a href="${base}kose-yazilari.html">Köşe yazıları</a><a href="${base}rehber.html">Rehber</a><a href="${base}hakkimizda.html">Hakkımızda</a></nav>
<nav aria-label="Yasal"><b>Yasal</b><a href="${base}gizlilik.html">KVKK aydınlatma metni</a><a href="${base}kullanim-kosullari.html">Kullanım koşulları</a><a href="${base}topluluk-kurallari.html">Topluluk kuralları</a></nav>
<nav aria-label="İletişim"><b>İletişim</b><a href="${base}iletisim.html">İletişim ve içerik bildirimi</a><a href="${base}reklam-ver.html">Reklam verin</a><a href="https://www.instagram.com/eczacidirenisi/">Instagram</a></nav>
</div><p class="foot-not"><button class="linkbtn" id="cerez-ac" type="button" hidden>Çerez tercihleri</button><span id="cerez-ayrac" hidden> · </span>Örnek çalışma, resmî site değildir · İçerik <a href="https://www.instagram.com/eczacidirenisi/">@eczacidirenisi</a> Instagram hesabından derlenmiştir.</p></div></footer>
<script>
(function(){
  var els=[].slice.call(document.querySelectorAll('main h2,.card,.list .item,.pn a,.note,.facts,.ilan,.empty'));
  var idx=new Map();
  els.forEach(function(e){var p=e.parentNode,n=idx.get(p)||0;idx.set(p,n+1);e.classList.add('rv');e.style.setProperty('--d',Math.min(n,5)*70+'ms')});
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:0});
  els.forEach(function(e){io.observe(e)});
})();
</script>
<script>
(function(){
  var b=document.getElementById('tema'); if(!b) return;
  var ADLAR={acik:'Açık tema',koyu:'Koyu tema',sistem:'Sistem teması'}, SIMGE={acik:'☀',koyu:'☾',sistem:'◐'};
  function tercih(){try{return localStorage.getItem('ed-tema')||'acik'}catch(e){return 'acik'}}
  function uygula(t){
    var koyu=t==='koyu'||(t==='sistem'&&matchMedia('(prefers-color-scheme: dark)').matches);
    if(koyu)document.documentElement.setAttribute('data-theme','dark');else document.documentElement.removeAttribute('data-theme');
    b.textContent=SIMGE[t];b.title=ADLAR[t]+' (değiştirmek için tıkla)';b.setAttribute('aria-label',ADLAR[t]+', değiştirmek için tıkla');
    var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',koyu?'#8f0710':'#e30a17');
  }
  b.addEventListener('click',function(){var s={acik:'koyu',koyu:'sistem',sistem:'acik'}[tercih()]||'koyu';try{localStorage.setItem('ed-tema',s)}catch(e){}uygula(s)});
  if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){if(tercih()==='sistem')uygula('sistem')});
  uygula(tercih());
})();
</script>
<script src="${base}assets/config.js"></script>
<script src="${base}assets/reklam-ayar.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="${base}assets/app.js" defer></script>
<script src="${base}assets/icerik.js" defer></script>
<script src="${base}assets/reklam.js" defer></script>
</body></html>`;
}

function write(rel, html) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html, "utf-8");
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });
// Reklam ayarları (ads.json): Google AdSense için hazır alt yapı. "client" boşsa hiçbir reklam ya da çerez bildirimi gösterilmez.
const ADS = fs.existsSync(path.join(ROOT, "ads.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "ads.json"), "utf-8")) : { client: "", slots: {} };
const ADS_ON = /^ca-pub-\d{10,20}$/.test(ADS.client || "");
fs.writeFileSync(path.join(DIST, "assets/reklam-ayar.js"), "window.ED_ADS=" + JSON.stringify({ client: ADS_ON ? ADS.client : "", slots: ADS.slots || {}, kutular: !!OZ.reklamKutulari }) + ";\n", "utf-8");
write("site.webmanifest", JSON.stringify({ name: "Eczacı Direnişi", short_name: "Eczacı D.", lang: "tr", start_url: "./index.html", scope: "./", display: "standalone", background_color: "#ffffff", theme_color: "#e30a17", icons: [{ src: "assets/logo.jpg", sizes: "any", type: "image/jpeg" }] }));
if (ADS_ON) write("ads.txt", `google.com, ${ADS.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);

// ---------- Üyelik, akış, ilanlar (Supabase; kurulum: supabase/schema.sql, anahtarlar: assets/config.js) ----------
const ILAN = {
  is: { file: "is-ilanlari.html", title: "İş ilanları", lead: "Eczane ve eczacılık alanında eleman arayanlar ile iş arayanlar için ilanlar." },
  devir: { file: "devir-ilanlari.html", title: "Devir ilanları", lead: "Devredilecek eczaneler ve devir arayanlar için ilanlar." },
};
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, "lists.json"), "utf-8"));
const opts = a => a.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
const KAPALI = ad => `<h1>${ad}</h1><p class="note">Bu bölüm şu an kapalı.</p><p><a class="btn" href="index.html">Ana sayfaya dön</a></p>`;
const CALISMA = ["Tam zamanlı", "Yarı zamanlı", "Dönemsel / vekâlet", "Staj"], RUHSAT = ["Ruhsatlı", "Ruhsatsız"];
for (const [k, T] of Object.entries(ILAN)) {
  if (k === "is" && !OZ.isIlanlari) { write(T.file, layout({ title: `${T.title} · Eczacı Direnişi`, active: "", path: T.file, noindex: true, reklam: false, body: KAPALI(T.title) })); continue; }
  write(T.file, layout({
    title: `${T.title} · Eczacı Direnişi`, desc: T.lead, active: `/${T.file}`, path: T.file,
    body: `<h1>${T.title}</h1><p class="lead">${T.lead}</p>
<div class="actions"><a class="btn" href="ilan-ver.html?tur=${k}">İlan ver</a></div>
<div id="il-own" class="ownbox" hidden></div>
<div class="filters filters-ilan"><select id="il-sehir" aria-label="Şehre göre filtrele"><option value="">Tüm şehirler</option>${opts(LISTS.iller)}</select><select id="il-ilce" aria-label="İlçeye göre filtrele" disabled><option value="">Tüm ilçeler</option></select>${k === "is" ? `<select id="il-poz" aria-label="Pozisyona göre filtrele"><option value="">Tüm pozisyonlar</option>${opts(LISTS.pozisyonlar)}</select><select id="il-ek" aria-label="Çalışma şekline göre filtrele"><option value="">Tüm çalışma şekilleri</option>${opts(CALISMA)}</select>` : `<select id="il-ek" aria-label="Ruhsat durumuna göre filtrele"><option value="">Ruhsat durumu: hepsi</option>${opts(RUHSAT)}</select>`}<input id="il-q" type="search" placeholder="Kelime ara…" aria-label="İlanlarda ara"></div>
<p class="meta" id="il-count"></p>
<div class="ilanlar" id="il" data-tur="${k}" data-limit="100"><p class="muted">İlanlar yükleniyor…</p></div>
<noscript><p class="note">İlanları görmek için JavaScript gerekir.</p></noscript>
${slot("icerik", "ad-inline")}
<p class="note"><b>Güvenliğin için:</b> Eczaneyi, kişiyi ve belgeleri doğrulamadan kapora ya da herhangi bir ödeme gönderme. Şüpheli ilanı "Bildir" düğmesiyle bize ilet. İletişim bilgileri yalnızca üyelere gösterilir; ilanlar yayına alındıktan 60 gün sonra kendiliğinden kalkar.${k === "devir" ? ' Süreç için <a href="rehber.html">eczane devri rehberine</a> bak.' : ""}</p>`
  }));
}
const homeIlan = k => (k === "is" && !OZ.isIlanlari) ? "" : `<div><h3 class="sub">${ILAN[k].title}</h3>
<div class="ilanlar" data-tur="${k}" data-limit="3"><p class="muted">Yükleniyor…</p></div>
<p><a class="btn ghost" href="${ILAN[k].file}">Tüm ${ILAN[k].title.toLowerCase()} →</a></p></div>`;

write("ilan-ver.html", layout({
  title: "İlan ver · Eczacı Direnişi", active: "", path: "ilan-ver.html", desc: "İş ya da devir ilanı ver.", reklam: false,
  body: `<h1>İlan ver</h1>
<p class="lead">İlanın yönetici onayından sonra sitede yayınlanır. İlan vermek için üye olman gerekir.</p>
<div id="ilan-form"><div class="msg" hidden></div>
<form id="f" class="form" novalidate>
<fieldset><legend>İlan türü</legend>
${OZ.isIlanlari ? '<label class="radio"><input type="radio" name="tur" value="is" checked> İş ilanı</label>\n' : ""}<label class="radio"><input type="radio" name="tur" value="devir"${OZ.isIlanlari ? "" : " checked"}> Devir ilanı</label></fieldset>
<label>Başlık <span class="req">*</span><input name="baslik" required maxlength="120" placeholder="Örn. Eczacı aranıyor / Devren eczane"></label>
<div class="row2"><label>Şehir <span class="req">*</span><select name="sehir" required><option value="">Şehir seç…</option>${opts(LISTS.iller)}</select></label>
<label>İlçe <span class="req">*</span><select name="ilce" required disabled><option value="">Önce şehir seç…</option></select></label></div>
<div class="row2" data-yalniz="is"><label>Pozisyon<select name="pozisyon"><option value="">Seç…</option>${opts(LISTS.pozisyonlar)}</select></label>
<label>Ücret (aylık)<select name="ucret"><option value="">Seç…</option>${opts(LISTS.ucretler)}</select></label></div>
<div data-yalniz="is"><label>Çalışma şekli<select name="calisma_sekli"><option value="">Seç…</option>${opts(CALISMA)}</select></label></div>
<div data-yalniz="devir" hidden><label>Ruhsat durumu<select name="ruhsat"><option value="">Belirtmek istemiyorum</option>${opts(RUHSAT)}</select></label></div>
<label>Açıklama<textarea name="aciklama" rows="5" maxlength="1200" placeholder="Detayları yaz."></textarea></label>
<fieldset class="iletisim-set"><legend>İletişim</legend>
<p class="hint">Telefon ya da e-posta bilgisinden en az birini ver. Telefon vermezsen e-posta zorunludur. Bu bilgiler yalnızca giriş yapmış üyelere gösterilir. Başkasının bilgisini onayı olmadan yazma.</p>
<label>Telefon türü<select name="tel_tur"><option value="">Telefon vermek istemiyorum</option><option value="cep">Kişisel cep telefonu</option><option value="sabit">İş / sabit hat</option><option value="dahili">Santral + dahili hat</option></select></label>
<div id="tel-grup" hidden>
<label><span id="tel-etiket">Telefon numarası</span> <span class="req">*</span><input name="tel" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="17" placeholder="0 (5__) ___ __ __"><span class="hint" id="tel-ipucu"></span><span class="fielderr" id="tel-hata"></span></label>
<label id="dahili-grup" hidden>Dahili no <span class="req">*</span><input name="dahili" inputmode="numeric" maxlength="6" placeholder="Örn. 214"><span class="fielderr" id="dahili-hata"></span></label>
</div>
<label>E-posta <span class="req" id="eposta-zorunlu">*</span><input name="eposta" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="ad@ornek.com"><span class="sug" id="eposta-oner"></span><span class="fielderr" id="eposta-hata"></span></label>
</fieldset>
<p class="hint">İlan, onaylandıktan sonra 60 gün yayında kalır; süre dolmaya yaklaşınca uzatabilirsin. Göndererek <a href="kullanim-kosullari.html" target="_blank">kullanım koşullarını</a> kabul etmiş olursun.</p>
<button class="btn" type="submit">İlanı gönder</button>
</form></div>
<noscript><p class="note">İlan vermek için JavaScript gerekir.</p></noscript>`
}));

write("giris.html", layout({
  title: "Giriş / Kayıt · Eczacı Direnişi", active: "", path: "giris.html", desc: "Üye ol ya da giriş yap.", noindex: true, reklam: false,
  body: `<h1>Üyelik</h1>
<div id="auth-box" class="authbox">
<div class="tabs" role="tablist"><button type="button" class="tab on" data-tab="giris">Giriş yap</button><button type="button" class="tab" data-tab="kayit">Üye ol</button></div>
<div class="msg" hidden></div>
<form id="f-giris" class="form" data-panel="giris">
<label>E-posta<input type="email" name="email" required autocomplete="email"></label>
<label>Şifre<input type="password" name="password" required autocomplete="current-password"></label>
<button class="btn" type="submit">Giriş yap</button>
<p><button type="button" class="linkbtn dark" id="unuttum">Şifremi unuttum</button></p>
</form>
<form id="f-kayit" class="form" data-panel="kayit" hidden>
<label>Kullanıcı adı<input name="username" required minlength="3" maxlength="20" autocomplete="username" placeholder="3-20 karakter: harf, rakam, _"></label>
<label>E-posta<input type="email" name="email" required autocomplete="email"></label>
<label>Şifre<input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="En az 8 karakter"></label>
<label class="radio check"><input type="checkbox" name="yas"> <span>18 yaşını doldurdum.</span></label>
<label class="radio check"><input type="checkbox" name="onay"> <span><a href="kullanim-kosullari.html" target="_blank">Kullanım koşullarını</a> ve <a href="topluluk-kurallari.html" target="_blank">topluluk kurallarını</a> kabul ediyorum.</span></label>
<p class="hint">Kişisel verilerinin nasıl işlendiği <a href="gizlilik.html" target="_blank">KVKK aydınlatma metninde</a> anlatılır.</p>
<button class="btn" type="submit">Üye ol</button>
</form>
</div>
<noscript><p class="note">Giriş için JavaScript gerekir.</p></noscript>`
}));

write("akis.html", layout({
  title: "Akış · Eczacı Direnişi", active: "/akis.html", path: "akis.html", desc: "Üyelerin kısa paylaşımları.", noindex: !OZ.akis, reklam: OZ.akis,
  body: !OZ.akis ? KAPALI("Akış") : `<h1>Akış</h1><p class="lead">Üyelerin kısa paylaşımları. Okumak için üye olmak gerekmez, yazmak için gerekir. Yazmadan önce <a href="topluluk-kurallari.html">kurallara</a> göz at; hasta ve reçete bilgisi paylaşma.</p>
<div id="akis"><p class="muted">Yükleniyor…</p></div>
<noscript><p class="note">Akışı görmek için JavaScript gerekir.</p></noscript>`
}));

write("paylasimlar.html", layout({
  title: "Paylaşımlar · Eczacı Direnişi", active: "", path: "paylasimlar.html", desc: "Instagram'dan seçilen paylaşımlar.",
  body: `<h1>Paylaşımlar</h1><p class="lead">Instagram hesabından seçilen paylaşımlar, yeniden eskiye.</p>
<div class="igs" id="ig-all" data-limit="12" data-more="1"><p class="muted">Yükleniyor…</p></div>
<noscript><p class="note">Paylaşımları görmek için JavaScript gerekir.</p></noscript>`
}));

write("yonetim.html", layout({
  title: "Yönetim · Eczacı Direnişi", active: "", path: "yonetim.html", noindex: true, reklam: false,
  body: `<h1>Yönetim</h1>
<div id="yonetim"><div id="icerik-admin"></div>
<div id="konu-admin"></div>
<div id="reklam-admin"></div>
<h2>Instagram paylaşımı ekle</h2>
<form id="ig-form" class="form" novalidate>
<p class="lead">Instagram'daki gönderinin bağlantısını yapıştır. Paylaşım ana sayfada ve "Tüm paylaşımlar" sayfasında görünür.</p>
<label>Instagram bağlantısı <span class="req">*</span><input name="url" type="url" required placeholder="https://www.instagram.com/p/..."></label>
<label>Başlık (isteğe bağlı)<input name="baslik" maxlength="160" placeholder="Gönderinin üstünde görünecek kısa not"></label>
<div class="msg" hidden></div>
<button class="btn" type="submit">Ana sayfaya ekle</button>
</form>
<div class="igs" id="ig-admin-list" data-limit="6"></div>
<h2>Onay bekleyen ilanlar</h2><div id="adm-ilan"><p class="muted">Yükleniyor…</p></div>
<h2>Bildirimler</h2><div id="adm-rep"><p class="muted">Yükleniyor…</p></div></div>`
}));

// ---------- Yasal ve bilgi sayfaları (metinler taslaktır; yayından önce hukukçuya okutulmalı) ----------
const doldur = (deger, ad) => deger ? esc(deger) : `<mark class="eksik">[${ad}]</mark>`;
const VS = () => doldur(AYAR.veriSorumlusu, "VERİ SORUMLUSU ADI / UNVANI");
const EPOSTA = () => AYAR.iletisimEposta ? `<a href="mailto:${esc(AYAR.iletisimEposta)}">${esc(AYAR.iletisimEposta)}</a>` : doldur("", "İLETİŞİM E-POSTASI");
const metinSayfasi = (file, title, desc, html) => write(file, layout({ title: `${title} · Eczacı Direnişi`, desc, active: "", path: file, reklam: false, body: `<article class="post"><h1>${title}</h1>\n${html}</article>` }));

metinSayfasi("gizlilik.html", "KVKK aydınlatma metni", "Kişisel verilerin nasıl işlendiği.", `
<h2>Veri sorumlusu</h2>
<p>${VS()} · Adres: ${doldur(AYAR.adres, "ADRES")} · ${EPOSTA()}</p>
<h2>Hangi verileri, nasıl topluyoruz?</h2>
<p>Verileri senin sitedeki formlara yazman yoluyla, elektronik ortamda topluyoruz: üyelikte e-posta adresi, kullanıcı adı ve şifre (şifre okunamaz biçimde saklanır); yazdığın gönderi, yorum, beğeni ve bildirimler; ilan verdiğinde ilan bilgileri ile yazdığın telefon ve e-posta. Altyapı sağlayıcıları ayrıca IP adresi ve tarayıcı bilgisi gibi teknik kayıtlar tutabilir.</p>
<h2>Amaç ve hukuki sebep</h2>
<ul><li>Üyeliğini açmak ve yürütmek, gönderi ve ilanlarını yayınlamak: sözleşmenin kurulması ve ifası (KVKK m.5/2-c).</li>
<li>Bildirimleri incelemek, kötüye kullanımı önlemek ve yasal yükümlülükleri yerine getirmek: hukuki yükümlülük ve meşru menfaat (m.5/2-ç ve f).</li></ul>
<h2>Kimlere aktarılır?</h2>
<p>Kullanıcı adın, gönderilerin ve yorumların herkese açıktır. İlanda yazdığın iletişim bilgisi yalnızca giriş yapmış üyelere gösterilir. E-posta adresin başka üyelere gösterilmez. Veriler, yasal olarak yetkili kurumların usulüne uygun talebi dışında aşağıdaki hizmet sağlayıcılar dışında kimseyle paylaşılmaz.</p>
<h2>Yurt dışına aktarım</h2>
<p>Üyelik ve veritabanı hizmetini Supabase sağlar; veriler İrlanda'daki (Avrupa Birliği) sunucularda tutulur. Site GitHub Pages üzerinden sunulur; yazı tipleri Google Fonts'tan, bir program kütüphanesi jsDelivr'dan yüklenir ve bu sırada IP adresin bu hizmetlere iletilir.</p>
<p><mark class="eksik">[YURT DIŞI AKTARIM DAYANAĞI: KVKK m.9 kapsamında uygulanacak güvence (ör. standart sözleşme) hukukçuyla belirlenip buraya yazılacak]</mark></p>
<h2>Tarayıcında tutulanlar</h2>
<p>Oturum bilgin, tema tercihin ve (Google reklamı açıksa) çerez tercihin tarayıcında tutulur. Kendi sattığımız reklamlar çerez kullanmaz; yalnızca toplam gösterim ve tıklama sayısı tutulur.</p>
${ADS_ON ? `<h2>Reklamlar (Google AdSense)</h2>
<p>Google AdSense reklamları yalnızca çerez bildiriminde "Kabul et" seçersen yüklenir. Kabul edersen Google ve ortakları reklamları göstermek ve ölçmek için çerez kullanabilir. Tercihini sayfa altındaki "Çerez tercihleri" bağlantısından değiştirebilirsin.</p>` : ""}
<h2>Instagram ve haber bağlantıları</h2>
<p>Instagram gönderileri Instagram'ın (Meta) gömme yöntemiyle yüklenir; bu sırada IP adresin ve tarayıcı bilgilerin Instagram'a iletilir ve Instagram çerez kullanabilir. Haber bağlantılarındaki görseller kaynak sitenin sunucusundan yüklenebilir.</p>
<h2>Ne kadar saklanır?</h2>
<p>Üyelik verileri üyeliğin sürdükçe saklanır. "Hesabım" sayfasından üyeliğini sildiğinde profilin, gönderilerin, beğenilerin ve ilanların silinir. Yasal saklama yükümlülüğü olan kayıtlar için süre ayrıca uygulanır: <mark class="eksik">[SAKLAMA SÜRELERİ]</mark></p>
<h2>Hakların (KVKK m.11)</h2>
<p>Verinin işlenip işlenmediğini öğrenme, bilgi isteme, işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı kişileri bilme, eksik ya da yanlışsa düzeltilmesini, şartları varsa silinmesini ya da yok edilmesini ve bunların aktarılan kişilere bildirilmesini isteme, yalnızca otomatik analizle aleyhine çıkan sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zararının giderilmesini talep etme haklarına sahipsin. Başvurunu ${EPOSTA()} adresine yapabilirsin.</p>`);

metinSayfasi("kullanim-kosullari.html", "Kullanım koşulları", "Siteyi kullanma koşulları.", `
<p>Siteyi işleten: ${VS()}. Siteyi kullanarak bu koşulları ve <a href="topluluk-kurallari.html">topluluk kurallarını</a> kabul edersin.</p>
<h2>Üyelik</h2><p>Üyelik 18 yaşını doldurmuş kişiler içindir. Verdiğin bilgilerin doğruluğundan ve hesabının güvenliğinden sen sorumlusun. İstediğin zaman "Hesabım" sayfasından üyeliğini silebilirsin.</p>
<h2>Paylaştıkların</h2><p>Yazdığın içeriğin sorumluluğu sana aittir. Paylaştığın içeriğin sitede gösterilmesine izin verirsin. Kurallara ya da hukuka aykırı içerik, önceden haber vermeden kaldırılabilir; tekrarında üyelik kapatılabilir.</p>
<h2>İlanlar</h2><p>Site yalnızca ilanların yayınlandığı bir panodur: tarafları buluşturma, aday seçme, görüşme ayarlama ya da ücret alma işi yapmaz. İlanın doğruluğundan ilanı veren sorumludur. İlanlar onaydan sonra yayınlanır ve 60 gün sonra kendiliğinden kalkar. Ayrımcı, yanıltıcı ya da mevzuata aykırı ilan yayınlanmaz. Eczane devri ve çalışma ilişkileri ilgili mevzuata tabidir.</p>
<h2>Sağlık bilgisi</h2><p>Sitedeki hiçbir içerik tıbbi ya da hukuki tavsiye değildir. İlaç satışı, reçete yönlendirmesi ve eczane ya da eczacı tanıtımı yapılamaz.</p>
<h2>Sorumluluk</h2><p>Üyelerin ve üçüncü tarafların içeriklerinden doğan zararlardan, hukukun izin verdiği ölçüde, site sorumlu tutulamaz. Hukuka aykırı olduğu bildirilen içerik incelenir ve gerekirse kaldırılır (<a href="iletisim.html">içerik bildirimi</a>).</p>
<h2>Değişiklik ve yetki</h2><p>Koşullar güncellenebilir; güncel metin bu sayfadadır. Uyuşmazlıklarda Türk hukuku uygulanır. Yetkili yer: <mark class="eksik">[YETKİLİ MAHKEME]</mark></p>`);

metinSayfasi("topluluk-kurallari.html", "Topluluk kuralları", "Akış, yorum ve ilanlarda uyulacak kurallar.", `
<p>Burası meslektaşların birbirine güvenerek konuşabildiği bir yer olsun.</p>
<h2>Yapma</h2><ul>
<li><b>Hasta ve reçete bilgisi paylaşma.</b> Ad, fotoğraf, reçete görüntüsü ya da kişiyi tanıtacak ayrıntı yazma.</li>
<li>Hakaret, tehdit, ayrımcılık ve kişileri hedef gösterme.</li>
<li>Kanıtlanmamış suçlama. Bir kişi ya da kurum hakkında yazarken doğrulayabildiğin şeyi yaz.</li>
<li>Başkasının telefonunu, adresini, özel mesajını ya da fotoğrafını izinsiz paylaşma.</li>
<li>Eczane, eczacı, ilaç ya da takviye ürün tanıtımı; reçete yönlendirmesi; izinsiz reklam.</li>
<li>Sahte ilan, kapora tuzağı, zincir mesaj ve aynı içeriği tekrar tekrar gönderme.</li></ul>
<h2>Bildirme</h2><p>Her gönderi, yorum ve ilanda "Bildir" düğmesi var. Sebebini seç; bildirimler yalnızca yöneticilere görünür.</p>
<h2>Sonuçlar</h2><p>Kurala aykırı içerik kaldırılır. Tekrarında ya da ağır ihlalde üyelik kapatılır. Karara itiraz için <a href="iletisim.html">iletişim</a> sayfasını kullan.</p>`);

metinSayfasi("iletisim.html", "İletişim", "İletişim bilgileri ve içerik bildirimi.", `
<h2>Tanıtıcı bilgiler</h2>
<p>Siteyi işleten: ${VS()}<br>Adres: ${doldur(AYAR.adres, "ADRES")}<br>E-posta: ${EPOSTA()}</p>
<h2>İçerik bildirimi ve kaldırma talebi</h2>
<p>Üyeysen içeriğin altındaki <b>Bildir</b> düğmesini kullan. Üye değilsen ya da kişilik hakkının ihlal edildiğini düşünüyorsan ${EPOSTA()} adresine şunları yaz: içeriğin bağlantısı, neden hukuka aykırı olduğunu düşündüğün ve sana nasıl ulaşabileceğimiz.</p>
<h2>Sosyal medya</h2><p><a href="https://www.instagram.com/eczacidirenisi/">Instagram: @eczacidirenisi</a></p>`);

metinSayfasi("reklam-ver.html", "Reklam verin", "Reklam konumları, ölçüler ve yayın kuralları.", `
<p class="lead">Eczacılara ve eczacılık öğrencilerine ulaşmak isteyen kurumlar için reklam alanları.</p>
<h2>Konumlar</h2>
<div class="tablo"><table><thead><tr><th>Konum</th><th>Ölçü (px)</th><th>Nerede görünür?</th></tr></thead><tbody>
<tr><td>Üst alan</td><td>970 × 90</td><td>Sayfa başlığının üstü; telefonda da görünür</td></tr>
<tr><td>İçerik arası</td><td>728 × 90</td><td>Ana sayfa, yazı ve ilan sayfaları</td></tr>
<tr><td>Alt alan</td><td>970 × 90</td><td>Sayfa sonu</td></tr>
<tr><td>Sol ve sağ kenar</td><td>160 × 600</td><td>Yalnızca geniş ekranlar (1440 px ve üzeri)</td></tr></tbody></table></div>
<p>Görsel JPG, PNG ya da WebP, en çok 1 MB. Hareketli, ses çıkaran ya da açılır pencere reklamı kabul edilmez. Telefonda geniş görseller ekrana sığacak şekilde küçülür; yazıları büyük tut.</p>
<h2>Kabul etmediğimiz reklamlar</h2>
<ul><li>Eczane ya da eczacı tanıtımı; reçete yönlendirmesi</li><li>İlaç ve tıbbi iddia taşıyan ürünler; sağlık beyanlı takviye edici gıdalar</li><li>Tütün, alkol, bahis ve kumar</li><li>Yanıltıcı, siyasi ya da hakaret içeren reklamlar</li></ul>
<p>Bu liste yayın politikamızdır; reklamın mevzuata uygunluğundan reklamveren de sorumludur. Her reklam "Reklam" etiketiyle, haber ve yazılardan ayrı gösterilir. Reklam yayınlamak, o kurumu önerdiğimiz anlamına gelmez.</p>
<h2>Başvuru</h2>
<p>Kurum adını, istediğin konumu, süreyi ve reklamın gideceği adresi ${EPOSTA()} adresine yaz.</p>`);

metinSayfasi("rehber.html", "Eczane devri rehberi", "Eczane devrinde süreç, belge kontrol listesi ve resmî bağlantılar.", `
<p class="note"><b>Genel bilgilendirme (Kasım 2026).</b> Belge listesi ve usul ilden ile ve zamanla değişebilir. İşlem yapmadan ve ödeme göndermeden önce il sağlık müdürlüğünden ve bölge eczacı odasından güncel listeyi teyit et.</p>
<h2>Anlaşmadan önce</h2>
<ul class="liste-kutu"><li>Devredenin devre engel bir durumu olup olmadığını il sağlık müdürlüğünden öğren.</li><li>Ciro, reçete sayısı, stok, borç ve alacakları belgeleriyle gör; mali müşavire incelet.</li><li>Kira sözleşmesinin devralana geçip geçmeyeceğini mülk sahibiyle netleştir.</li><li>Personelin durumunu ve işçilik alacaklarını konuş.</li><li>Bedelin hangi kalemlerden oluştuğunu (demirbaş, stok, diğer) yazılı hale getir.</li><li><b>Resmî bilgi almadan devir bedeli ya da kapora gönderme.</b></li></ul>
<h2>Başvuruda sık istenen belgeler</h2>
<ul class="liste-kutu"><li>Devreden ve devralanın imzaladığı dilekçe ya da müdürlüğün formu</li><li>Devralanın onaylı diploma örneği ve oda kayıt belgesi</li><li>Sağlık raporu ve adli sicil kaydı (güncellik süresini sor)</li><li>Devir senedi ya da tutanağı (müdürlük ve oda yetkilileri huzurunda)</li><li>İş yerine ait yapı belgeleri ve kroki</li><li>Harç makbuzu (ödeme zamanını müdürlükten öğren)</li></ul>
<h2>Bilmen gereken</h2><p>Muvazaalı (göstermelik) eczane açtığı tespit edilen eczacıya beş yıl eczane açma yasağı uygulanır. Devir bedeli için resmî bir hesaplama formülü bulunmuyor; tek bir "çarpan" hesabına güvenme.</p>
<h2>Resmî bağlantılar</h2>
<ul><li><a href="https://www.mevzuat.gov.tr/MevzuatMetin/yonetmelik/7.5.19569.pdf" rel="noopener" target="_blank">Eczacılar ve Eczaneler Hakkında Yönetmelik (mevzuat.gov.tr)</a></li><li><a href="https://eys.titck.gov.tr" rel="noopener" target="_blank">Eczacı Yerleştirme Sistemi (TİTCK)</a></li><li><a href="https://teb.org.tr" rel="noopener" target="_blank">Türk Eczacıları Birliği</a></li><li><a href="https://www.its.gov.tr/its/ilac_sorgula" rel="noopener" target="_blank">İlaç Takip Sistemi sorgulama</a></li></ul>
<p>Kaynak olarak bakılan sayfalar: <a href="https://trabzonism.saglik.gov.tr/TR-148107/eczane-devir-islemleri.html" rel="noopener" target="_blank">Trabzon İl Sağlık Müdürlüğü</a>, <a href="https://www.hatayeo.org.tr/eczane-rehberi/6227" rel="noopener" target="_blank">Hatay Eczacı Odası</a>.</p>
<p><a class="btn" href="devir-ilanlari.html">Devir ilanlarına bak</a></p>`);

write("hesabim.html", layout({
  title: "Hesabım · Eczacı Direnişi", active: "", path: "hesabim.html", noindex: true, reklam: false,
  body: `<h1>Hesabım</h1><div id="hesap"><p class="muted">Yükleniyor…</p></div>`
}));

write("kose-yazilari.html", layout({
  title: "Köşe yazıları · Eczacı Direnişi", active: "/kose-yazilari.html", path: "kose-yazilari.html", desc: "İmzalı görüş ve köşe yazıları.",
  body: `<h1>Köşe yazıları</h1><p class="lead">İmzalı yazılar. Görüşler yazarına aittir.</p>
<div class="list" id="kose-liste"><p class="muted">Yükleniyor…</p></div>
<noscript><p class="note">İçerikleri görmek için JavaScript gerekir.</p></noscript>`
}));

write("index.html", layout({
  title: "Eczacı Direnişi", desc: "Vatansever Genç Türk Eczacılar Topluluğu", active: "/", path: "",
  ld: { "@context": "https://schema.org", "@type": "Organization", name: "Eczacı Direnişi", url: SITE_URL, sameAs: ["https://www.instagram.com/eczacidirenisi/"] },
  body: `<div class="intro"><span class="kicker">Meslek gündemi · haberler · ilanlar</span>
<h1>Vatansever Genç Türk Eczacılar Topluluğu</h1></div>
<div id="ozne-sec" hidden><h2>Öne çıkan</h2><div id="ozne"></div></div>
<div id="haberler-sec" hidden><h2>Haberler</h2><div class="grid" id="haberler"></div></div>
<div id="ig-sec" hidden><h2>Instagram'dan</h2>
<div class="igs" id="ig-home" data-limit="6"></div>
<p><a class="btn ghost" href="paylasimlar.html">Tüm paylaşımlar →</a></p></div>
${slot("icerik", "ad-inline")}
<h2>İlanlar</h2>
<div class="cols2">${homeIlan("is")}${homeIlan("devir")}</div>
<div id="son-sec" hidden><h2>Son yazılar</h2><div class="list" id="son-yazilar"></div>
<p><a class="btn ghost" href="arsiv.html">Tüm arşiv →</a></p></div>
<noscript><p class="note">İçerikleri görmek için JavaScript gerekir.</p></noscript>`
}));

// ---------- Gündem ----------
write("gundem.html", layout({
  title: "Gündem · Eczacı Direnişi", active: "/gundem.html", path: "gundem.html", desc: "Son açıklamalar, haberler ve yazılar.",
  body: `<h1>Gündem</h1><p class="lead">Son açıklamalar, haberler ve yazılar, yeniden eskiye.</p>
<div class="list" id="gundem" data-sayfa="20"><p class="muted">Yükleniyor…</p></div>
<noscript><p class="note">İçerikleri görmek için JavaScript gerekir.</p></noscript>`
}));

// ---------- Konular ----------
write("konular.html", layout({
  title: "Konular · Eczacı Direnişi", active: "/konular.html", path: "konular.html", desc: "Süreklilik gösteren konular, tek sayfada.",
  body: `<h1>Konular</h1><p class="lead">Süreklilik gösteren konular, tek sayfada toplanmış.</p>
<div class="grid" id="konular-liste" style="margin-top:20px"><p class="muted">Yükleniyor…</p></div>
<noscript><p class="note">Konuları görmek için JavaScript gerekir.</p></noscript>`
}));
// Tek konu sayfası: konu.html?s=KONU-ADRESI (konular veritabanından gelir, yönetimden eklenebilir)
write("konu.html", layout({
  title: "Konu · Eczacı Direnişi", active: "/konular.html", path: "konu.html", desc: "Konuya ait içerikler.",
  body: `<p class="meta"><a href="konular.html">← Konular</a></p><h1 id="konu-baslik">Konu</h1>
<p class="lead" id="konu-aciklama"></p>
<div class="list" id="konu-liste"><p class="muted">Yükleniyor…</p></div>`
}));
// Eski konu adresleri (konu/ADRES.html) yeni sayfaya yönlenir
for (const t of THEMES) {
  write(`konu/${t.slug}.html`, `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Yönlendiriliyor…</title>
<meta http-equiv="refresh" content="0;url=../konu.html?s=${t.slug}"><script>location.replace('../konu.html?s=${t.slug}')</script></head>
<body><a href="../konu.html?s=${t.slug}">Konuya git</a></body></html>`);
}

// ---------- Yazı sayfası (tek sayfa, içerik veritabanından: yazi.html?id=…) ----------
write("yazi.html", layout({
  title: "Yazı · Eczacı Direnişi", active: "/gundem.html", path: "yazi.html", desc: "Eczacı Direnişi yazısı.", type: "article",
  body: `<div class="progress" id="pg"></div>
<p class="meta"><a href="gundem.html">← Gündem</a></p>
<div id="yazi-kutu"><p class="muted">Yükleniyor…</p></div>
${slot("icerik", "ad-inline")}
${OZ.akis ? '<div id="yorumlar-kutu"></div>' : ""}
<noscript><p class="note">Yazıyı görmek için JavaScript gerekir.</p></noscript>`
}));
// Eski adresler (yazi/KOD.html) yeni sayfaya yönlenir
for (const kod of ESKI_KODLAR) {
  write(`yazi/${kod}.html`, `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Yönlendiriliyor…</title>
<meta http-equiv="refresh" content="0;url=../yazi.html?k=${kod}"><script>location.replace('../yazi.html?k=${kod}')</script></head>
<body><a href="../yazi.html?k=${kod}">Yazıya git</a></body></html>`);
}

// ---------- 404, sitemap, robots ----------
write("404.html", layout({
  title: "Sayfa bulunamadı · Eczacı Direnişi", active: "", path: "404.html", reklam: false,
  body: `<h1>Sayfa bulunamadı</h1><p class="lead">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
<p><a class="btn" href="${SITE_URL}/index.html">Ana sayfaya dön</a> <a class="btn ghost" href="${SITE_URL}/arsiv.html">Arşivde ara</a></p>`
}));
const urls = ["", "gundem.html", "kose-yazilari.html", OZ.akis && "akis.html", "paylasimlar.html", OZ.isIlanlari && "is-ilanlari.html", "devir-ilanlari.html", "rehber.html", "reklam-ver.html", "iletisim.html", "gizlilik.html", "kullanim-kosullari.html", "topluluk-kurallari.html", "konular.html", "arsiv.html", "hakkimizda.html"].filter(u => u !== false);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE_URL}/${u}</loc></url>`).join("")}</urlset>`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// ---------- Arşiv ----------
write("arsiv.html", layout({
  title: "Arşiv · Eczacı Direnişi", active: "/arsiv.html", path: "arsiv.html", desc: "Tüm içerikler, konuya göre filtrelenebilir.",
  body: `<h1>Arşiv</h1><p class="lead" id="arsiv-lead">Tüm içerikler. Konuya göre filtrele ya da ara.</p>
<div class="filters" id="konu-filtre"><input id="q" type="search" placeholder="Ara…" aria-label="Ara">
<button class="on" data-t="">Tümü</button></div>
<p class="meta" id="count"></p><div class="list" id="list"><p class="muted">Yükleniyor…</p></div>
<noscript><p class="note">İçerikleri görmek için JavaScript gerekir.</p></noscript>`
}));

// ---------- Hakkımızda ----------
write("hakkimizda.html", layout({
  title: "Hakkımızda · Eczacı Direnişi", active: "/hakkimizda.html", path: "hakkimizda.html", desc: "Vatansever Genç Türk Eczacılar Topluluğu hakkında.",
  body: `<article class="post"><h1>Hakkımızda</h1>
<p class="lead">Vatansever Genç Türk Eczacılar Topluluğu.</p>
<p>Bu sayfa örnek metindir. Topluluğun amacı, çalışma biçimi ve iletişim bilgileri burada yer alacak.</p>
<p><a class="btn" href="https://www.instagram.com/eczacidirenisi/">Instagram'da takip et</a></p></article>`
}));

console.log(`Üretildi: ${ESKI_KODLAR.length} yönlendirme, ${THEMES.length} konu → docs/`);
