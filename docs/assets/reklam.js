/* Reklam alanları. Sıra: 1) yönetimden eklenen kendi reklamlarımız (çerez yok), 2) Google AdSense (ads.json doluysa ve çerez izni verilirse),
   3) "Bu alana reklam verin" kutusu (site.json → reklamKutulari). Her ücretli reklam "Reklam" etiketi taşır.
   Yerleşimi görmek için adresin sonuna ?reklam=onizle ekle. */
(function () {
  'use strict';
  var A = window.ED_ADS || {}, root = document.documentElement, KEY = 'ed-cerez';
  var BASE = root.getAttribute('data-base') || './';
  var YER = { ust: ['Üst alan', '970 × 90'], alt: ['Alt alan', '970 × 90'], icerik: ['İçerik arası', '728 × 90'], sol: ['Sol kenar', '160 × 600'], sag: ['Sağ kenar', '160 × 600'] };
  var slots = [].slice.call(document.querySelectorAll('.ad-slot'));
  var yerAdi = function (el) { return el.getAttribute('data-slot'); };

  function etiketle(el, metin) { el.setAttribute('data-etiket', metin); }

  if (/[?&]reklam=onizle\b/.test(location.search)) {
    root.classList.add('ads-preview');
    slots.forEach(function (s) { var y = YER[yerAdi(s)] || ['', '']; s.textContent = y[0] + ' · ' + y[1]; });
    return;
  }

  // ---------- kendi reklamlarımız ----------
  async function kendiReklamlari() {
    var E = window.ED;
    if (!E || !E.sb || !slots.length) return [];
    try {
      var r = await E.sb.from('reklamlar').select('id,ad_veren,yer,gorsel_url,baglanti,aktif,baslangic,bitis').eq('aktif', true);
      if (r.error) return [];                      // tablo henüz yoksa sessizce atla
      var simdi = Date.now();                      // yöneticiye süresi dolanlar da gelir: burada da süz
      return (r.data || []).filter(function (x) {
        return new Date(x.baslangic) <= simdi && (!x.bitis || new Date(x.bitis) > simdi) && /^https:\/\//i.test(x.gorsel_url) && /^https:\/\//i.test(x.baglanti);
      });
    } catch (e) { return []; }
  }
  function say(id, tur) {
    try { window.ED.sb.rpc('reklam_say', { p_id: id, p_tur: tur }).then(function () {}, function () {}); } catch (e) { /* sayaç zorunlu değil */ }
  }
  function yerlestir(liste) {
    var gruplar = {}, sira = {};
    liste.forEach(function (x) { (gruplar[x.yer] = gruplar[x.yer] || []).push(x); });
    Object.keys(gruplar).forEach(function (k) { sira[k] = Math.floor(Math.random() * gruplar[k].length); });
    var gozlem = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (g) { if (g.isIntersecting) { gozlem.unobserve(g.target); say(+g.target.getAttribute('data-id'), 'gosterim'); } });
    }, { threshold: 0.5 }) : null;
    return slots.filter(function (el) {            // boş kalanları döndürür
      var g = gruplar[yerAdi(el)];
      if (!g) return true;
      var x = g[sira[yerAdi(el)]++ % g.length];
      var a = document.createElement('a');
      a.href = x.baglanti; a.target = '_blank'; a.rel = 'sponsored noopener noreferrer'; a.setAttribute('data-id', x.id);
      var img = document.createElement('img');
      img.src = x.gorsel_url; img.alt = 'Reklam: ' + x.ad_veren; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', function () { el.classList.remove('dolu'); a.remove(); });
      a.appendChild(img); a.addEventListener('click', function () { say(x.id, 'tiklama'); });
      el.textContent = ''; el.appendChild(a); el.classList.add('dolu'); etiketle(el, 'Reklam');
      if (gozlem) gozlem.observe(a);
      return false;
    });
  }

  // ---------- "reklam verin" kutuları ----------
  function kutular(bos) {
    if (!A.kutular) return;
    bos.forEach(function (el) {
      var y = YER[yerAdi(el)]; if (!y) return;
      var a = document.createElement('a'); a.href = BASE + 'reklam-ver.html';
      var b = document.createElement('b'); b.textContent = 'Bu alana reklam verin';
      var s = document.createElement('span'); s.textContent = y[0] + ' · ' + y[1];
      a.appendChild(b); a.appendChild(s); el.textContent = ''; el.appendChild(a); el.classList.add('kutu'); etiketle(el, '');
    });
  }

  // ---------- Google AdSense (yalnızca ads.json doluysa) ----------
  var client = A.client || '';
  var adsense = /^ca-pub-\d{10,20}$/.test(client);
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* tarayıcı depolaması kapalı */ } }
  function birimi(el) { var id = (A.slots || {})[yerAdi(el)]; return /^\d{6,20}$/.test(id || '') ? id : null; }

  function yukle(bos) {
    if (document.getElementById('adsense-js')) return;
    var s = document.createElement('script');
    s.id = 'adsense-js'; s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    document.head.appendChild(s);
    bos.forEach(function (el) {
      var id = birimi(el); if (!id) return;
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle'; ins.style.display = 'block';
      ins.setAttribute('data-ad-client', client); ins.setAttribute('data-ad-slot', id);
      if (el.closest('.rail')) { ins.style.width = '100%'; ins.style.minHeight = '600px'; ins.setAttribute('data-ad-format', 'vertical'); }
      else { ins.setAttribute('data-ad-format', 'auto'); ins.setAttribute('data-full-width-responsive', 'true'); }
      el.textContent = ''; el.classList.remove('kutu'); el.classList.add('dolu'); etiketle(el, 'Reklamlar'); el.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* reklam betiği engellenmiş olabilir */ }
    });
  }
  function bildirim(bos) {
    var b = document.createElement('div');
    b.className = 'cerez'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Çerez tercihleri');
    b.innerHTML = '<div class="wrap"><p>Bu site, reklam göstermek için Google AdSense kullanabilir. Reklam çerezlerine izin verirsen Google ve ortakları tarayıcında çerez kullanabilir. ' +
      'Reddedersen Google reklamı yüklenmez ve reklam çerezi kullanılmaz. Ayrıntılar için <a href="' + BASE + 'gizlilik.html">aydınlatma metnine</a> bak.</p>' +
      '<div class="btns"><button class="btn" type="button" data-k="evet">Kabul et</button><button class="btn" type="button" data-k="hayir">Reddet</button></div></div>';
    b.addEventListener('click', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!k) return;
      var yukluydu = !!document.getElementById('adsense-js');
      set(k); b.remove();
      if (k === 'evet') yukle(bos); else if (yukluydu) location.reload();   // izin geri alındıysa yüklenmiş reklamları temizle
    });
    document.body.appendChild(b);
  }
  function adsenseBaslat(bos) {
    var uygun = bos.filter(birimi);
    var ac = document.getElementById('cerez-ac'), ay = document.getElementById('cerez-ayrac');
    if (ac) {
      ac.hidden = false; if (ay) ay.hidden = false;
      ac.addEventListener('click', function () { try { localStorage.removeItem(KEY); } catch (e) { /* yok say */ } if (!document.querySelector('.cerez')) bildirim(uygun); });
    }
    if (!uygun.length) return;
    var t = get();
    if (t === 'evet') yukle(uygun); else if (t !== 'hayir') bildirim(uygun);
  }

  // ---------- yönetim: reklam ekle, durdur, sil, sayaçlar ----------
  function yonetim() {
    var root2 = document.getElementById('reklam-admin'), E = window.ED;
    if (!root2 || !E || !E.sb || !E.profile || !E.profile.is_admin) return;
    var h = E.h, msg = E.msg, trErr = E.trErr;
    var out = h('div', { class: 'msg', hidden: true }), liste = h('div', { class: 'list' });
    var f = h('form', { class: 'form', novalidate: true },
      h('label', {}, 'Reklamveren', h('input', { name: 'ad_veren', maxlength: '80', required: true })),
      h('label', {}, 'Konum', h('select', { name: 'yer' }, Object.keys(YER).map(function (k) { return h('option', { value: k }, YER[k][0] + ' (' + YER[k][1] + ')'); }))),
      h('label', {}, 'Tıklanınca gidilecek adres (https://)', h('input', { name: 'baglanti', type: 'url', maxlength: '800', placeholder: 'https://' })),
      h('label', {}, 'Görsel (JPG, PNG, WebP; en çok 1 MB)', h('input', { name: 'dosya', type: 'file', accept: 'image/jpeg,image/png,image/webp' })),
      h('label', {}, 'Bitiş tarihi (isteğe bağlı)', h('input', { name: 'bitis', type: 'date' })),
      out, h('button', { class: 'btn', type: 'submit', text: 'Reklamı yayınla' }));
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var ad = f.ad_veren.value.trim(), bag = f.baglanti.value.trim(), d = f.dosya.files[0];
      if (ad.length < 2) return msg(out, 'Reklamveren adını yaz.', 'err');
      if (!/^https:\/\/\S+\.\S+/.test(bag)) return msg(out, 'Adres https:// ile başlamalı.', 'err');
      if (!d) return msg(out, 'Bir görsel seç.', 'err');
      if (!/^image\/(jpeg|png|webp)$/.test(d.type) || d.size > 1048576) return msg(out, 'Görsel JPG, PNG ya da WebP ve en çok 1 MB olmalı.', 'err');
      var bitis = f.bitis.value ? new Date(f.bitis.value + 'T23:59:59') : null;
      if (bitis && bitis < new Date()) return msg(out, 'Bitiş tarihi geçmişte olamaz.', 'err');
      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; msg(out, 'Yükleniyor…');
      var yol = 'reklam/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + d.type.split('/')[1].replace('jpeg', 'jpg');
      var u = await E.sb.storage.from('gorseller').upload(yol, d, { contentType: d.type });
      if (u.error) { btn.disabled = false; return msg(out, trErr(u.error), 'err'); }
      var url = E.sb.storage.from('gorseller').getPublicUrl(yol).data.publicUrl;
      var r = await E.sb.from('reklamlar').insert({ ad_veren: ad, yer: f.yer.value, baglanti: bag, gorsel_url: url, bitis: bitis ? bitis.toISOString() : null });
      btn.disabled = false;
      if (r.error) return msg(out, trErr(r.error), 'err');
      f.reset(); msg(out, 'Reklam yayında.', 'ok'); listele();
    });
    async function listele() {
      var r = await E.sb.from('reklamlar').select('id,ad_veren,yer,aktif,bitis,baglanti').order('id', { ascending: false });
      E.clear(liste);
      if (r.error) return liste.appendChild(h('p', { class: 'note', text: 'Reklam tablosu okunamadı. supabase/gecis-02.sql çalıştırıldı mı? (' + trErr(r.error) + ')' }));
      var s = await E.sb.from('reklam_sayac').select('reklam_id,gosterim,tiklama'), say2 = {};
      (s.data || []).forEach(function (x) { say2[x.reklam_id] = x; });
      if (!(r.data || []).length) return liste.appendChild(h('p', { class: 'muted', text: 'Henüz reklam yok.' }));
      r.data.forEach(function (x) {
        var c = say2[x.id] || { gosterim: 0, tiklama: 0 }, bitti = x.bitis && new Date(x.bitis) < new Date();
        liste.appendChild(h('div', { class: 'yrow' },
          h('div', { class: 'ybody' }, h('div', { class: 'meta', text: (YER[x.yer] || [x.yer])[0] + ' · ' + (bitti ? 'SÜRESİ DOLDU' : (x.aktif ? 'YAYINDA' : 'DURDURULDU')) + (x.bitis ? ' · bitiş ' + new Date(x.bitis).toLocaleDateString('tr-TR') : '') }),
            h('strong', { text: x.ad_veren }), h('div', { class: 'muted', text: c.gosterim + ' gösterim · ' + c.tiklama + ' tıklama (yaklaşık)' })),
          h('div', { class: 'acts' },
            h('button', { type: 'button', class: 'act', text: x.aktif ? 'Durdur' : 'Başlat', onclick: async function () { var u = await E.sb.from('reklamlar').update({ aktif: !x.aktif }).eq('id', x.id); if (u.error) alert(trErr(u.error)); else listele(); } }),
            h('button', { type: 'button', class: 'act', text: 'Sil', onclick: async function () { if (!confirm('"' + x.ad_veren + '" reklamı silinsin mi?')) return; var u = await E.sb.from('reklamlar').delete().eq('id', x.id); if (u.error) alert(trErr(u.error)); else listele(); } }))));
      });
    }
    E.clear(root2);
    root2.appendChild(h('h2', { text: 'Reklamlar' }));
    root2.appendChild(h('p', { class: 'lead', text: 'Kendi sattığın reklamları ekle. Eczane ya da eczacı tanıtımı, ilaç, sağlık beyanlı ürün, tütün ve alkol reklamı alma.' }));
    root2.appendChild(f); root2.appendChild(liste); listele();
  }

  var bekle = (window.ED && window.ED.ready) || Promise.resolve();
  bekle.then(async function () {
    yonetim();
    if (!slots.length) return;
    var bos = yerlestir(await kendiReklamlari());
    kutular(bos);
    if (adsense) adsenseBaslat(bos);
  });
})();
