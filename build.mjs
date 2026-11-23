// Site üreticisi: statik kabuk sayfaları üretir (içerik Supabase veritabanından gelir) -> docs/ (GitHub Pages)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const DIST = path.join(ROOT, "docs");
const SEED = fs.existsSync(path.join(ROOT, "data/seed-yazilar.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "data/seed-yazilar.json"), "utf-8")) : [];

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

// ---------- Şablon ----------
const CSS = fs.readFileSync(path.join(ROOT, "style.css"), "utf-8");

const NAV = [["/", "Ana sayfa"], ["/gundem.html", "Gündem"], ["/akis.html", "Akış"], ["/is-ilanlari.html", "İş ilanları"], ["/devir-ilanlari.html", "Devir ilanları"], ["/arsiv.html", "Arşiv"], ["/hakkimizda.html", "Hakkımızda"]];

const SITE_URL = "https://gitahmetcelik.github.io/eczacidirenisi-site"; // alt yol dahil, sonunda / yok

function layout({ title, desc = "", body, active = "/", depth = 0, path: pagePath = "", ld = null, type = "website", image = "assets/logo.jpg", noindex = false }) {
  const base = depth ? "../".repeat(depth) : "./";
  const nav = NAV.map(([h, n]) => `<a href="${base}${h.slice(1)}"${h === active ? ' class="on" aria-current="page"' : ""}>${n}</a>`).join("");
  const url = `${SITE_URL}/${pagePath}`;
  return `<!doctype html><html lang="tr" data-base="${base}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#e30a17">${noindex ? `<meta name="robots" content="noindex,nofollow">` : ""}
<link rel="icon" href="${base}assets/logo.jpg">
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
<div class="shell"><aside class="rail rail-l" aria-label="Reklam alanı"><div class="ad-slot" data-slot="sol" data-etiket="Reklam"></div></aside>
<main id="icerik"><div class="wrap">${body}</div></main>
<aside class="rail rail-r" aria-label="Reklam alanı"><div class="ad-slot" data-slot="sag" data-etiket="Reklam"></div></aside></div>
<footer><div class="wrap"><a href="${base}konular.html">Konular</a> · <a href="${base}gizlilik.html">Gizlilik</a> · <button class="linkbtn" id="cerez-ac" type="button" hidden>Çerez tercihleri</button><span id="cerez-ayrac" hidden> · </span>Örnek çalışma, resmî site değildir · İçerik <a href="https://www.instagram.com/eczacidirenisi/">@eczacidirenisi</a> Instagram hesabından derlenmiştir.</div></footer>
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
fs.writeFileSync(path.join(DIST, "assets/reklam-ayar.js"), "window.ED_ADS=" + JSON.stringify({ client: ADS_ON ? ADS.client : "", slots: ADS.slots || {} }) + ";\n", "utf-8");
if (ADS_ON) write("ads.txt", `google.com, ${ADS.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);

// ---------- Üyelik, akış, ilanlar (Supabase; kurulum: supabase/schema.sql, anahtarlar: assets/config.js) ----------
const ILAN = {
  is: { file: "is-ilanlari.html", title: "İş ilanları", lead: "Eczane ve eczacılık alanında eleman arayanlar ile iş arayanlar için ilanlar." },
  devir: { file: "devir-ilanlari.html", title: "Devir ilanları", lead: "Devredilecek eczaneler ve devir arayanlar için ilanlar." },
};
const LISTS = JSON.parse(fs.readFileSync(path.join(ROOT, "lists.json"), "utf-8"));
const opts = a => a.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
for (const [k, T] of Object.entries(ILAN)) {
  write(T.file, layout({
    title: `${T.title} · Eczacı Direnişi`, desc: T.lead, active: `/${T.file}`, path: T.file,
    body: `<h1>${T.title}</h1><p class="lead">${T.lead}</p>
<div class="actions"><a class="btn" href="ilan-ver.html?tur=${k}">İlan ver</a></div>
<div id="il-own" class="ownbox" hidden></div>
<div class="filters filters-ilan"><select id="il-sehir" aria-label="Şehre göre filtrele"><option value="">Tüm şehirler</option>${opts(LISTS.iller)}</select>${k === "is" ? `<select id="il-poz" aria-label="Pozisyona göre filtrele"><option value="">Tüm pozisyonlar</option>${opts(LISTS.pozisyonlar)}</select>` : ""}<input id="il-q" type="search" placeholder="Kelime ara…" aria-label="İlanlarda ara"></div>
<p class="meta" id="il-count"></p>
<div class="ilanlar" id="il" data-tur="${k}" data-limit="100"><p class="muted">İlanlar yükleniyor…</p></div>
<noscript><p class="note">İlanları görmek için JavaScript gerekir.</p></noscript>
<p class="note">Görüşmeden önce ilan bilgilerini ilan sahibiyle teyit edin. İletişim bilgileri yalnızca üyelere gösterilir.</p>`
  }));
}
const homeIlan = k => `<div><h3 class="sub">${ILAN[k].title}</h3>
<div class="ilanlar" data-tur="${k}" data-limit="3"><p class="muted">Yükleniyor…</p></div>
<p><a class="btn ghost" href="${ILAN[k].file}">Tüm ${ILAN[k].title.toLowerCase()} →</a></p></div>`;

write("ilan-ver.html", layout({
  title: "İlan ver · Eczacı Direnişi", active: "", path: "ilan-ver.html", desc: "İş ya da devir ilanı ver.",
  body: `<h1>İlan ver</h1>
<p class="lead">İlanın yönetici onayından sonra sitede yayınlanır. İlan vermek için üye olman gerekir.</p>
<div id="ilan-form"><div class="msg" hidden></div>
<form id="f" class="form" novalidate>
<fieldset><legend>İlan türü</legend>
<label class="radio"><input type="radio" name="tur" value="is" checked> İş ilanı</label>
<label class="radio"><input type="radio" name="tur" value="devir"> Devir ilanı</label></fieldset>
<label>Başlık <span class="req">*</span><input name="baslik" required maxlength="120" placeholder="Örn. Eczacı aranıyor / Devren eczane"></label>
<div class="row2"><label>Şehir <span class="req">*</span><select name="sehir" required><option value="">Şehir seç…</option>${opts(LISTS.iller)}</select></label>
<label>İlçe <span class="req">*</span><select name="ilce" required disabled><option value="">Önce şehir seç…</option></select></label></div>
<div class="row2" id="isalan"><label>Pozisyon<select name="pozisyon"><option value="">Seç…</option>${opts(LISTS.pozisyonlar)}</select></label>
<label>Ücret (aylık)<select name="ucret"><option value="">Seç…</option>${opts(LISTS.ucretler)}</select></label></div>
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
<button class="btn" type="submit">İlanı gönder</button>
</form></div>
<noscript><p class="note">İlan vermek için JavaScript gerekir.</p></noscript>`
}));

write("giris.html", layout({
  title: "Giriş / Kayıt · Eczacı Direnişi", active: "", path: "giris.html", desc: "Üye ol ya da giriş yap.", noindex: true,
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
<label class="radio check"><input type="checkbox" name="onay"> <span><a href="gizlilik.html" target="_blank">Gizlilik bilgilendirmesini</a> okudum, kabul ediyorum.</span></label>
<button class="btn" type="submit">Üye ol</button>
</form>
</div>
<noscript><p class="note">Giriş için JavaScript gerekir.</p></noscript>`
}));

write("akis.html", layout({
  title: "Akış · Eczacı Direnişi", active: "/akis.html", path: "akis.html", desc: "Üyelerin kısa paylaşımları.",
  body: `<h1>Akış</h1><p class="lead">Üyelerin kısa paylaşımları. Okumak için üye olmak gerekmez, yazmak için gerekir.</p>
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
  title: "Yönetim · Eczacı Direnişi", active: "", path: "yonetim.html", noindex: true,
  body: `<h1>Yönetim</h1>
<div id="yonetim"><div id="icerik-admin"></div>
<div id="konu-admin"></div>
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
<h2>Bildirilen gönderiler</h2><div id="adm-rep"><p class="muted">Yükleniyor…</p></div></div>`
}));

write("gizlilik.html", layout({
  title: "Gizlilik bilgilendirmesi · Eczacı Direnişi", active: "", path: "gizlilik.html", desc: "Kişisel verilerin nasıl işlendiği.",
  body: `<article class="post"><h1>Gizlilik bilgilendirmesi</h1>
<p class="note"><b>Tamamlanacak:</b> Veri sorumlusu adı ve iletişim bilgisi: [VERİ SORUMLUSU ADI] · [İLETİŞİM E-POSTASI]</p>
<h2>Hangi verileri topluyoruz?</h2>
<p>Üye olurken e-posta adresin, kullanıcı adın ve şifren. Şifren yalnızca doğrulama için, şifrelenmiş olarak saklanır. Ayrıca yazdığın gönderiler, yorumlar, beğeniler ve verdiğin ilanlar.</p>
<h2>İlanlardaki iletişim bilgileri</h2>
<p>İlan verirken yazdığın telefon numarası (kişisel, iş ya da santral/dahili) ve e-posta adresi, ilan sayfalarında yalnızca giriş yapmış üyelere gösterilir. İlanı istediğin zaman, bir sebep seçerek kaldırabilirsin.</p>
<h2>Ne için kullanıyoruz?</h2>
<p>Üyeliğini yönetmek, gönderi ve yorumları göstermek, ilanları yayınlamak ve kötüye kullanımı önlemek için.</p>
<h2>Kimler görebilir?</h2>
<p>Kullanıcı adın, gönderilerin ve yorumların herkese açıktır. E-posta adresin herkese açık değildir. İlanda yazdığın iletişim bilgisi yalnızca giriş yapmış üyelere gösterilir.</p>
<h2>Nerede saklanıyor?</h2>
<p>Veriler, üyelik ve veritabanı hizmeti sağlayan Supabase altyapısında saklanır. Oturum bilgin ve tema tercihin (açık/koyu) tarayıcında tutulur.</p>
${ADS_ON ? `<h2>Reklamlar (Google AdSense)</h2>
<p>Bu sitede Google AdSense reklamları gösterilebilir. Reklamlar yalnızca çerez bildirimindeki "Kabul et" seçeneğini seçersen yüklenir. Kabul edersen Google ve ortakları reklamları göstermek ve ölçmek için tarayıcında çerez kullanabilir. Tercihini sayfa altındaki "Çerez tercihleri" bağlantısından istediğin zaman değiştirebilirsin. Google'ın verileri nasıl işlediği Google'ın gizlilik politikasında anlatılır.</p>` : ""}
<h2>Instagram paylaşımları</h2>
<p>Ana sayfadaki ve "Paylaşımlar" sayfasındaki Instagram gönderileri, Instagram'ın (Meta) kendi gömme (embed) yöntemiyle yüklenir. Bu paylaşımlar görüntülenirken IP adresin ve tarayıcı bilgilerin Instagram sunucularına iletilebilir ve Instagram kendi çerezlerini kullanabilir. Bu veriler Instagram'ın gizlilik politikasına tabidir.</p>
<h2>Haber bağlantıları ve görseller</h2>
<p>Yöneticiler başka sitelerden haber bağlantısı ekleyebilir. Bu içeriklerin başlık ve özeti kaynak sitenin sayfasından alınır, tıklandığında kaynak siteye gidilir. Kaynak sitelerden gelen görseller o sitelerin sunucularından yüklenebilir; bu sırada IP adresin o sitelere iletilebilir.</p>
<h2>Hakların</h2>
<p>Verilerine erişmek, düzeltmek ya da silinmesini istemek için yukarıdaki iletişim adresine yazabilirsin (KVKK madde 11). Kendi gönderilerini sitede istediğin zaman silebilirsin.</p></article>`
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
<div class="ad-slot ad-inline" data-slot="icerik" data-etiket="Reklam"></div>
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
<div class="ad-slot ad-inline" data-slot="icerik" data-etiket="Reklam"></div>
<div id="yorumlar-kutu"></div>
<noscript><p class="note">Yazıyı görmek için JavaScript gerekir.</p></noscript>`
}));
// Eski adresler (yazi/KOD.html) yeni sayfaya yönlenir
for (const s of SEED) {
  write(`yazi/${s.kod}.html`, `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Yönlendiriliyor…</title>
<meta http-equiv="refresh" content="0;url=../yazi.html?k=${s.kod}"><script>location.replace('../yazi.html?k=${s.kod}')</script></head>
<body><a href="../yazi.html?k=${s.kod}">Yazıya git</a></body></html>`);
}

// ---------- 404, sitemap, robots ----------
write("404.html", layout({
  title: "Sayfa bulunamadı · Eczacı Direnişi", active: "", path: "404.html",
  body: `<h1>Sayfa bulunamadı</h1><p class="lead">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
<p><a class="btn" href="${SITE_URL}/index.html">Ana sayfaya dön</a> <a class="btn ghost" href="${SITE_URL}/arsiv.html">Arşivde ara</a></p>`
}));
const urls = ["", "gundem.html", "akis.html", "paylasimlar.html", "is-ilanlari.html", "devir-ilanlari.html", "gizlilik.html", "konular.html", "arsiv.html", "hakkimizda.html"];
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

console.log(`Üretildi: ${SEED.length} yönlendirme, ${THEMES.length} konu → docs/`);
