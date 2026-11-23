/* Eczacı Direnişi: içerik (yazı, haber, bağlantı) gösterimi ve yönetim editörü. app.js'in window.ED nesnesini kullanır.
   Kullanıcı/yönetici metinleri textContent ile ya da kaçışlanmış küçük bir işaretleme dilinden (mdToHtml) basılır. */
(function () {
  'use strict';
  var E = window.ED; if (!E) return;
  var h = E.h, $ = E.$, clear = E.clear, msg = E.msg, trErr = E.trErr, BASE = E.BASE;
  var TEMALAR = [];   // konular veritabanından yüklenir (konularYukle)
  var COLS = 'id,tur,kod,baslik,ozet,gorsel_url,gorsel_alt,gorsel_konum,link_url,link_etiket,link_dogrudan,kaynak_site,temalar,yayin_tarihi,yayinda,gundemde,one_cikan';
  var TUR_AD = { yazi: 'Yazı', haber: 'Haber', baglanti: 'Bağlantı', instagram: 'Instagram' };
  var KONUM_AD = { ust: 'Üst', alt: 'Alt', sol: 'Sol', sag: 'Sağ' };

  // ---------- yardımcılar ----------
  function temaAd(slug) { for (var i = 0; i < TEMALAR.length; i++) if (TEMALAR[i].slug === slug) return TEMALAR[i].ad; return null; }
  async function konularYukle() {
    if (!E.sb) return;
    var r = await E.sb.from('konular').select('id,slug,ad,aciklama,sira').order('sira', { ascending: true }).order('ad', { ascending: true });
    TEMALAR = r.data || [];
  }
  function imgSrc(u) { u = u || ''; if (/^https:\/\//i.test(u)) return u; if (/^assets\//.test(u)) return BASE + u; return ''; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function tarih(iso) { return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function kisalt(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; }
  function hedef(y) {
    var l = safeUrl(y.link_url);
    if (y.link_dogrudan && l) return { href: l, ext: true };
    return { href: y.id ? BASE + 'yazi.html?id=' + y.id : '#', ext: false };
  }
  function escH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  // Küçük işaretleme dili: boş satır = paragraf, "## " başlık, "- " liste, **kalın**, *italik*, [metin](https://adres). Önce her şey kaçışlanır.
  function inl(s) {
    s = escH(s);
    s = s.replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)<>"]{1,500})\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return s;
  }
  function mdToHtml(src) {
    var out = [];
    String(src || '').replace(/\r/g, '').split(/\n{2,}/).forEach(function (b) {
      b = b.replace(/^\n+|\n+$/g, ''); if (!b.trim()) return;
      var lines = b.split('\n');
      if (lines.length === 1 && /^#{2,3}\s+/.test(lines[0])) { out.push('<h3 class="yz-h">' + inl(lines[0].replace(/^#{2,3}\s+/, '')) + '</h3>'); return; }
      if (lines.every(function (l) { return /^[-*]\s+/.test(l); })) { out.push('<ul>' + lines.map(function (l) { return '<li>' + inl(l.replace(/^[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>'); return; }
      out.push('<p>' + lines.map(inl).join('<br>') + '</p>');
    });
    return out.join('');
  }

  // ---------- kart ve satır ----------
  function resim(y, cls, eager) { var s = imgSrc(y.gorsel_url); return s ? h('img', { class: cls, src: s, alt: '', loading: eager ? 'eager' : 'lazy', decoding: 'async' }) : null; }
  function metaYazi(y, t) { return tarih(y.yayin_tarihi) + (y.kaynak_site ? ' · ' + y.kaynak_site : '') + (t.ext ? ' ↗' : ''); }
  function haberKart(y, big) {
    var t = hedef(y);
    var a = h('a', { class: 'card' + (big ? ' big' : ''), href: t.href, target: t.ext ? '_blank' : null, rel: t.ext ? 'noopener noreferrer' : null },
      resim(y, 'thumb', big), h('div', { class: 'meta', text: metaYazi(y, t) }), h('h3', { text: y.baslik }),
      y.ozet ? h('p', { text: kisalt(y.ozet, big ? 260 : 150) }) : null);
    return a;
  }
  function satir(y) {
    var t = hedef(y), r = resim(y, 'thumb', false);
    var alt = y.ozet ? h('p', { text: kisalt(y.ozet, 200) }) : (y.tur === 'instagram' ? h('p', { text: 'İçerik görselin içinde.' }) : null);
    var a = h('a', { class: 'item' + (r ? ' has-img' : ''), href: t.href, target: t.ext ? '_blank' : null, rel: t.ext ? 'noopener noreferrer' : null,
      'data-themes': (y.temalar || []).join(' '), 'data-q': ((y.baslik || '') + ' ' + (y.ozet || '')).toLowerCase() },
      r, h('div', {}, h('div', { class: 'meta', text: metaYazi(y, t) }), h('h3', { text: y.baslik }), alt));
    return a;
  }

  // ---------- tam yazı ----------
  function yaziEl(y) {
    var kutu = h('article', { class: 'post yz' });
    var tg = h('div'); (y.temalar || []).forEach(function (s) { var ad = temaAd(s); if (ad) tg.appendChild(h('a', { class: 'tag', href: BASE + 'konu.html?s=' + encodeURIComponent(s), text: ad })); });
    kutu.appendChild(tg);
    kutu.appendChild(h('h1', { text: y.baslik || '(Başlıksız)' }));
    var dk = Math.max(1, Math.round(((y.govde || '').split(/\s+/).length) / 200));
    var facts = h('p', { class: 'facts' }, h('span', { text: tarih(y.yayin_tarihi || new Date().toISOString()) }));
    if (y.govde) facts.appendChild(h('span', { text: dk + ' dk okuma' }));
    if (y.kaynak_site) facts.appendChild(h('span', {}, 'Kaynak ', h('b', { text: y.kaynak_site })));
    kutu.appendChild(facts);
    var konum = KONUM_AD[y.gorsel_konum] ? y.gorsel_konum : 'ust', src = imgSrc(y.gorsel_url);
    var fig = src ? h('figure', { class: 'yz-img ' + konum }, h('img', { src: src, alt: y.gorsel_alt || '', decoding: 'async' })) : null;
    var gov = h('div', { class: 'yz-body' }); gov.innerHTML = mdToHtml(y.govde || y.ozet || '');
    var sar = h('div', { class: 'yz-wrap' });
    if (fig && konum !== 'alt') sar.appendChild(fig);
    sar.appendChild(gov);
    if (fig && konum === 'alt') sar.appendChild(fig);
    kutu.appendChild(sar);
    var l = safeUrl(y.link_url), acts = h('div', { class: 'actions' });
    if (l) acts.appendChild(h('a', { class: 'btn', href: l, target: '_blank', rel: 'noopener noreferrer', text: (y.link_etiket || (y.tur === 'baglanti' ? 'Haberin devamı' : 'Devamını oku')) + ' →' }));
    var pay = h('button', { class: 'btn ghost', type: 'button', text: 'Bağlantıyı kopyala' });
    pay.addEventListener('click', function () {
      var u = y.id ? location.origin + location.pathname + '?id=' + y.id : location.href;
      (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { pay.textContent = 'Kopyalandı ✓'; }, function () { pay.textContent = 'Kopyalanamadı'; });
      setTimeout(function () { pay.textContent = 'Bağlantıyı kopyala'; }, 2000);
    });
    acts.appendChild(pay); kutu.appendChild(acts);
    return kutu;
  }

  // ---------- sayfalar ----------
  function sorgu() { return E.sb.from('yazilar'); }

  async function mountHome() {
    var oz = $('#ozne'); if (!oz) return;
    if (!E.sb) return E.notReady(oz);
    var r = await Promise.all([
      sorgu().select(COLS).eq('yayinda', true).eq('gundemde', true).eq('one_cikan', true).order('yayin_tarihi', { ascending: false }).limit(4),
      sorgu().select(COLS).eq('yayinda', true).in('tur', ['haber', 'baglanti']).order('yayin_tarihi', { ascending: false }).limit(6),
      sorgu().select(COLS).eq('yayinda', true).eq('gundemde', true).order('yayin_tarihi', { ascending: false }).limit(16)
    ]);
    var one = r[0].data || [], haber = r[1].data || [], son = r[2].data || [], used = {};
    if (!one.length) one = son.filter(function (y) { return imgSrc(y.gorsel_url); }).slice(0, 4);
    if (one.length) {
      one.forEach(function (y) { used[y.id] = 1; });
      clear(oz);
      oz.appendChild(h('div', { class: 'hero' }, haberKart(one[0], true),
        h('div', { style: 'display:grid;gap:16px' }, one.slice(1, 4).map(function (y) { return haberKart(y, false); }))));
      $('#ozne-sec').hidden = false;
    }
    if (haber.length) {
      var g = $('#haberler'); clear(g); haber.forEach(function (y) { g.appendChild(haberKart(y, false)); }); $('#haberler-sec').hidden = false;
    }
    var rest = son.filter(function (y) { return !used[y.id]; }).slice(0, 9);
    if (rest.length) { var L = $('#son-yazilar'); clear(L); rest.forEach(function (y) { L.appendChild(satir(y)); }); $('#son-sec').hidden = false; }
  }

  async function sayfali(el, kur, adet, bos) {
    var from = 0, btn = h('button', { type: 'button', class: 'btn ghost', text: 'Daha fazla', hidden: true });
    el.parentNode.insertBefore(btn, el.nextSibling);
    async function yukle() {
      btn.disabled = true;
      var r = await kur(from, from + adet - 1);
      if (from === 0) clear(el);
      if (r.error) { el.appendChild(h('p', { class: 'note', text: 'Yüklenemedi: ' + trErr(r.error) })); return; }
      var rows = r.data || [];
      rows.forEach(function (y) { el.appendChild(satir(y)); });
      if (from === 0 && !rows.length) el.appendChild(h('p', { class: 'muted', text: bos || 'Henüz içerik yok.' }));
      from += adet; btn.hidden = rows.length < adet; btn.disabled = false;
    }
    btn.onclick = yukle; await yukle();
  }
  function mountGundem() {
    var el = $('#gundem'); if (!el) return; if (!E.sb) return E.notReady(el);
    return sayfali(el, function (a, b) { return sorgu().select(COLS).eq('yayinda', true).eq('gundemde', true).order('yayin_tarihi', { ascending: false }).range(a, b); }, parseInt(el.getAttribute('data-sayfa') || '20', 10));
  }
  function mountKonu() {
    var el = $('#konu-liste'); if (!el || !$('#konu-baslik')) return; if (!E.sb) return E.notReady(el);
    var slug = new URLSearchParams(location.search).get('s') || '';
    var konu = TEMALAR.filter(function (t) { return t.slug === slug; })[0];
    if (!konu) { $('#konu-baslik').textContent = 'Konu bulunamadı'; clear(el); el.appendChild(h('p', { class: 'lead', text: 'Bu konu kaldırılmış ya da hiç var olmamış olabilir.' })); el.appendChild(h('p', {}, h('a', { class: 'btn', href: BASE + 'konular.html', text: 'Tüm konular' }))); return; }
    $('#konu-baslik').textContent = konu.ad; $('#konu-aciklama').textContent = konu.aciklama || '';
    document.title = konu.ad + ' · Eczacı Direnişi';
    var md = document.querySelector('meta[name=description]'); if (md) md.setAttribute('content', konu.aciklama || konu.ad);
    return sayfali(el, function (a, b) { return sorgu().select(COLS).eq('yayinda', true).contains('temalar', [slug]).order('yayin_tarihi', { ascending: false }).range(a, b); }, 20, 'Bu konuda henüz içerik yok.');
  }
  function mountKonular() {
    var el = $('#konular-liste'); if (!el) return; if (!E.sb) return E.notReady(el);
    clear(el);
    if (!TEMALAR.length) { el.appendChild(h('p', { class: 'muted', text: 'Henüz konu yok.' })); return; }
    TEMALAR.forEach(function (t) {
      el.appendChild(h('a', { class: 'card', href: BASE + 'konu.html?s=' + encodeURIComponent(t.slug) }, h('div', { class: 'meta', text: 'Konu' }), h('h3', { text: t.ad }), t.aciklama ? h('p', { text: t.aciklama }) : null));
    });
  }
  async function mountArsiv() {
    var el = $('#list'); if (!el || !$('#q')) return; if (!E.sb) return E.notReady(el);
    var q = $('#q'), cnt = $('#count'), t = '';
    var r = await sorgu().select(COLS).eq('yayinda', true).order('yayin_tarihi', { ascending: false }).range(0, 999);
    clear(el);
    if (r.error) { el.appendChild(h('p', { class: 'note', text: 'Yüklenemedi: ' + trErr(r.error) })); return; }
    var items = (r.data || []).map(satir); items.forEach(function (i) { el.appendChild(i); });
    var lead = $('#arsiv-lead'); if (lead) lead.textContent = items.length + ' içerik. Konuya göre filtrele ya da ara.';
    function run() {
      var s = q.value.toLowerCase().trim(), n = 0;
      items.forEach(function (e) { var ok = (!t || e.getAttribute('data-themes').split(' ').indexOf(t) > -1) && (!s || e.getAttribute('data-q').indexOf(s) > -1); e.style.display = ok ? '' : 'none'; if (ok) n++; });
      cnt.textContent = n + ' sonuç';
    }
    q.addEventListener('input', run);
    var fk = $('#konu-filtre');
    if (fk) TEMALAR.forEach(function (tm) { fk.appendChild(h('button', { type: 'button', 'data-t': tm.slug, text: tm.ad })); });
    document.querySelectorAll('.filters button[data-t]').forEach(function (b) {
      b.addEventListener('click', function () { document.querySelectorAll('.filters button[data-t]').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); t = b.getAttribute('data-t'); run(); });
    });
    run();
  }
  async function mountYazi() {
    var kutu = $('#yazi-kutu'); if (!kutu) return; if (!E.sb) return E.notReady(kutu);
    var p = new URLSearchParams(location.search), id = parseInt(p.get('id') || '', 10), k = p.get('k');
    var q = sorgu().select(COLS + ',govde');
    q = id ? q.eq('id', id) : q.eq('kod', k || '');
    var r = await q.maybeSingle(), y = r.data;
    clear(kutu);
    if (!y) { kutu.appendChild(h('h1', { text: 'Yazı bulunamadı' })); kutu.appendChild(h('p', { class: 'lead', text: 'Bu yazı kaldırılmış ya da hiç var olmamış olabilir.' })); kutu.appendChild(h('p', {}, h('a', { class: 'btn', href: BASE + 'gundem.html', text: 'Gündeme dön' }))); return; }
    document.title = y.baslik + ' · Eczacı Direnişi';
    var md = document.querySelector('meta[name=description]'); if (md) md.setAttribute('content', kisalt(y.ozet || y.govde || '', 150));
    var adm = E.profile && E.profile.is_admin;
    if (adm && !y.yayinda) kutu.appendChild(h('p', { class: 'note', text: 'Taslak: bu yazıyı yalnızca yöneticiler görüyor.' }));
    kutu.appendChild(yaziEl(y));
    if (adm) kutu.appendChild(h('p', {}, h('a', { class: 'btn ghost', href: BASE + 'yonetim.html?duzenle=' + y.id, text: 'Düzenle' })));
    var ref = y.kod || ('y' + y.id), yk = $('#yorumlar-kutu');
    if (yk) { yk.appendChild(h('h2', { text: 'Yorumlar' })); var yc = h('div', { id: 'yorumlar', 'data-ref': ref }); yk.appendChild(yc); E.mountFeed(yc); }
    var pg = $('#pg'); if (pg) addEventListener('scroll', function () { var d = document.documentElement; pg.style.width = (d.scrollTop / (d.scrollHeight - d.clientHeight || 1) * 100) + '%'; }, { passive: true });
  }

  // ---------- yönetim: içerik editörü ----------
  async function kucult(file, maxW) {
    var bmp = await createImageBitmap(file);
    var s = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * s), hh = Math.round(bmp.height * s);
    var c = document.createElement('canvas'); c.width = w; c.height = hh;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); x.drawImage(bmp, 0, 0, w, hh);
    return await new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('Görsel işlenemedi')); }, 'image/jpeg', 0.86); });
  }
  async function onizlemeGetir(url) {
    var s = await E.sb.auth.getSession(), tok = s.data.session && s.data.session.access_token;
    var r = await fetch(E.config.SUPABASE_URL + '/functions/v1/link-onizleme', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: E.config.SUPABASE_ANON_KEY }, body: JSON.stringify({ url: url }) });
    var j = {}; try { j = await r.json(); } catch (e) { /* boş yanıt */ }
    if (r.status === 404) throw new Error('Siteden çekme servisi kurulu değil. Bilgileri elle girebilirsin.');
    if (!r.ok) throw new Error(j.error || ('Hata ' + r.status));
    return j;
  }
  function yerelTarih(iso) { var d = new Date(iso), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function mountAdmin() {
    var root = $('#icerik-admin'); if (!root) return;
    if (!E.sb || !E.profile || !E.profile.is_admin) return;
    clear(root);
    var listBox = h('div', { class: 'list' }), moreBtn = h('button', { type: 'button', class: 'btn ghost', text: 'Daha fazla', hidden: true });
    var edBox = h('div', { class: 'ed', hidden: true });
    var ara = h('input', { type: 'search', placeholder: 'Başlıkta ara…', 'aria-label': 'İçerikte ara' });
    var turSel = h('select', { 'aria-label': 'Türe göre filtrele' }, h('option', { value: '' }, 'Tüm türler'),
      Object.keys(TUR_AD).map(function (k) { return h('option', { value: k }, TUR_AD[k]); }));
    var yeni = h('button', { type: 'button', class: 'btn', text: 'Yeni yazı / haber' });
    root.appendChild(h('h2', { text: 'İçerik' }));
    root.appendChild(h('p', { class: 'lead', text: 'Yazı ve haber ekle, fotoğraf yükle, bağlantı ver. Mevcut içerikleri düzenle ya da kaldır.' }));
    root.appendChild(h('div', { class: 'actions' }, yeni));
    root.appendChild(edBox);
    root.appendChild(h('div', { class: 'filters filters-ilan' }, turSel, ara));
    root.appendChild(listBox); root.appendChild(moreBtn);

    var from = 0, PAGE = 20;
    async function yukle(sifirla) {
      if (sifirla) { from = 0; clear(listBox); }
      var q = sorgu().select('id,tur,baslik,yayin_tarihi,yayinda,gundemde,one_cikan').order('yayin_tarihi', { ascending: false }).range(from, from + PAGE - 1);
      if (turSel.value) q = q.eq('tur', turSel.value);
      if (ara.value.trim()) q = q.ilike('baslik', '%' + ara.value.trim().replace(/[%_]/g, '') + '%');
      var r = await q;
      if (r.error) { listBox.appendChild(h('p', { class: 'note', text: trErr(r.error) })); return; }
      var rows = r.data || [];
      rows.forEach(function (y) { listBox.appendChild(satirYonetim(y)); });
      if (from === 0 && !rows.length) listBox.appendChild(h('p', { class: 'muted', text: 'Hiç içerik yok. "Yeni yazı / haber" ile ekle.' }));
      from += PAGE; moreBtn.hidden = rows.length < PAGE;
    }
    function satirYonetim(y) {
      var rozet = [TUR_AD[y.tur] || y.tur, tarih(y.yayin_tarihi)]; if (!y.yayinda) rozet.push('TASLAK'); if (y.one_cikan) rozet.push('ÖNE ÇIKAN');
      var row = h('div', { class: 'yrow' }, h('div', { class: 'ybody' }, h('div', { class: 'meta', text: rozet.join(' · ') }), h('strong', { text: y.baslik })),
        h('div', { class: 'acts' },
          h('button', { type: 'button', class: 'act', text: 'Düzenle', onclick: function () { ac(y.id); } }),
          h('a', { class: 'act', href: BASE + 'yazi.html?id=' + y.id, text: 'Aç' }),
          h('button', { type: 'button', class: 'act', text: 'Sil', onclick: async function () {
            if (!confirm('"' + y.baslik + '" kalıcı olarak silinsin mi?')) return;
            var d = await sorgu().delete().eq('id', y.id); if (d.error) alert(trErr(d.error)); else row.remove();
          } })));
      return row;
    }
    var tmr; ara.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { yukle(true); }, 250); });
    turSel.addEventListener('change', function () { yukle(true); });
    moreBtn.addEventListener('click', function () { yukle(false); });
    yeni.addEventListener('click', function () { ac(null); });

    async function ac(id) {
      var y = null;
      if (id) { var r = await sorgu().select(COLS + ',govde').eq('id', id).maybeSingle(); y = r.data; if (!y) { alert('İçerik bulunamadı.'); return; } }
      editor(y);
      edBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function editor(y) {
      var yeniKayit = !y;
      var d = y || { tur: 'yazi', gorsel_konum: 'ust', yayinda: true, gundemde: true, one_cikan: false, link_dogrudan: false, temalar: [], yayin_tarihi: new Date().toISOString() };
      clear(edBox); edBox.hidden = false;
      var out = h('div', { class: 'msg', hidden: true });
      var f = h('form', { class: 'form', novalidate: true });
      var onizle = h('div', { class: 'onizleme' });
      function alan(etiket, girdi, zorunlu) { return h('label', {}, etiket, zorunlu ? h('span', { class: 'req', text: ' *' }) : null, girdi); }
      var turAlan = h('select', { name: 'tur' }, Object.keys(TUR_AD).filter(function (k) { return k !== 'instagram' || d.tur === 'instagram'; }).map(function (k) { return h('option', { value: k, selected: d.tur === k }, TUR_AD[k]); }));
      if (d.tur === 'instagram') turAlan.disabled = true;

      // Siteden çek
      var cekUrl = h('input', { type: 'url', placeholder: 'https://haber-sitesi.com/haber-adresi', 'aria-label': 'Haber bağlantısı' });
      var cekBtn = h('button', { type: 'button', class: 'btn ghost', text: 'Siteden çek' });
      var cekKutu = h('div', { class: 'cek' }, h('strong', { text: 'Bir siteden haber çek' }),
        h('p', { class: 'muted', text: 'Haber adresini yapıştır, başlık, özet ve görsel kendiliğinden gelir. Sonra düzenleyebilirsin.' }), h('div', { class: 'crow' }, cekUrl, cekBtn));

      var baslik = h('input', { name: 'baslik', maxlength: '200', value: d.baslik || '', placeholder: 'Başlık' });
      var ozet = h('textarea', { name: 'ozet', rows: '3', maxlength: '500', placeholder: 'Kartlarda görünecek kısa özet' }, d.ozet || '');
      var govde = h('textarea', { name: 'govde', rows: '12', maxlength: '30000', placeholder: 'Yazının metni…' }, d.govde || '');
      var gUrl = h('input', { name: 'gorsel_url', type: 'url', placeholder: 'https://… ya da dosya yükle', value: d.gorsel_url || '' });
      var gDosya = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Fotoğraf yükle' });
      var gAlt = h('input', { name: 'gorsel_alt', maxlength: '200', value: d.gorsel_alt || '', placeholder: 'Görselin kısa tarifi (erişilebilirlik için)' });
      var gOnizle = h('img', { class: 'gprev', alt: '' });
      var gSil = h('button', { type: 'button', class: 'act', text: 'Görseli kaldır' });
      var konumlar = h('div', { class: 'posgrid', role: 'radiogroup', 'aria-label': 'Fotoğraf konumu' }, Object.keys(KONUM_AD).map(function (k) {
        return h('label', { class: 'posopt' }, h('input', { type: 'radio', name: 'konum', value: k, checked: (d.gorsel_konum || 'ust') === k }), h('span', { class: 'pos pos-' + k }, h('i')), KONUM_AD[k]);
      }));
      var lUrl = h('input', { name: 'link_url', type: 'url', placeholder: 'https://… (yönlendirme bağlantısı)', value: d.link_url || '' });
      var lEt = h('input', { name: 'link_etiket', maxlength: '60', value: d.link_etiket || '', placeholder: 'Düğme yazısı (örn. Haberin devamı)' });
      var lDog = h('input', { type: 'checkbox', name: 'link_dogrudan', checked: !!d.link_dogrudan });
      var kaynak = h('input', { name: 'kaynak_site', maxlength: '80', value: d.kaynak_site || '', placeholder: 'Kaynak site (örn. hurriyet.com.tr)' });
      var temaKutu = h('div', { class: 'temagrid' }, TEMALAR.map(function (t) {
        return h('label', { class: 'radio check' }, h('input', { type: 'checkbox', name: 'tema', value: t.slug, checked: (d.temalar || []).indexOf(t.slug) > -1 }), h('span', { text: t.ad }));
      }));
      var tarihInp = h('input', { type: 'datetime-local', name: 'tarih', value: yerelTarih(d.yayin_tarihi) });
      var yayinda = h('input', { type: 'checkbox', name: 'yayinda', checked: d.yayinda !== false });
      var gundemde = h('input', { type: 'checkbox', name: 'gundemde', checked: d.gundemde !== false });
      var oneCikan = h('input', { type: 'checkbox', name: 'one_cikan', checked: !!d.one_cikan });
      function kutu(girdi, yazi) { return h('label', { class: 'radio check' }, girdi, h('span', { text: yazi })); }

      [turAlan && alan('Tür', turAlan), cekKutu, alan('Başlık', baslik, true), alan('Özet', ozet),
        alan('İçerik', govde), h('p', { class: 'muted ipucu', text: 'Biçim: boş satır = yeni paragraf · "## " ile başlık · "- " ile liste · **kalın** · *italik* · [yazı](https://adres) ile bağlantı' }),
        h('fieldset', {}, h('legend', { text: 'Fotoğraf' }), alan('Dosya yükle (JPEG/PNG/WebP, otomatik küçültülür)', gDosya), alan('ya da görsel adresi', gUrl), alan('Görsel açıklaması', gAlt),
          h('div', { class: 'gsat' }, gOnizle, gSil), h('p', { class: 'muted', text: 'Fotoğrafın yazıdaki konumu:' }), konumlar),
        h('fieldset', {}, h('legend', { text: 'Yönlendirme bağlantısı' }), alan('Bağlantı adresi', lUrl), alan('Düğme yazısı', lEt), alan('Kaynak site', kaynak),
          kutu(lDog, 'Karta tıklayınca doğrudan bu bağlantıya git (yazı sayfası açılmaz)')),
        h('fieldset', {}, h('legend', { text: 'Konular' }), temaKutu),
        h('fieldset', {}, h('legend', { text: 'Yayın' }), alan('Yayın tarihi', tarihInp), kutu(yayinda, 'Yayında (kapalıysa taslak, yalnızca yöneticiler görür)'),
          kutu(gundemde, 'Gündem ve "Son yazılar"da göster'), kutu(oneCikan, 'Ana sayfada "Öne çıkan"da göster'))
      ].forEach(function (n) { if (n) f.appendChild(n); });
      var kaydet = h('button', { type: 'submit', class: 'btn', text: yeniKayit ? 'Yayınla' : 'Kaydet' });
      var iptal = h('button', { type: 'button', class: 'btn ghost', text: 'Kapat' });
      f.appendChild(out); f.appendChild(h('div', { class: 'actions' }, kaydet, iptal));
      edBox.appendChild(h('h3', { class: 'sub', text: yeniKayit ? 'Yeni içerik' : 'İçeriği düzenle' }));
      edBox.appendChild(h('div', { class: 'edgrid' }, f, h('div', {}, h('h3', { class: 'sub', text: 'Önizleme' }), onizle)));

      function topla() {
        var temalar = [].slice.call(f.querySelectorAll('input[name=tema]:checked')).map(function (x) { return x.value; });
        var v = function (x) { return (x.value || '').trim() || null; };
        return { tur: d.tur === 'instagram' ? 'instagram' : turAlan.value, baslik: baslik.value.trim(), ozet: v(ozet), govde: (govde.value || '').replace(/\s+$/, '') || null,
          gorsel_url: v(gUrl), gorsel_alt: v(gAlt), gorsel_konum: (f.konum && f.konum.value) || 'ust', link_url: v(lUrl), link_etiket: v(lEt), link_dogrudan: lDog.checked,
          kaynak_site: v(kaynak), temalar: temalar, yayin_tarihi: tarihInp.value ? new Date(tarihInp.value).toISOString() : new Date().toISOString(),
          yayinda: yayinda.checked, gundemde: gundemde.checked, one_cikan: oneCikan.checked };
      }
      function guncelle() {
        var row = topla(); row.id = d.id; row.kod = d.kod;
        clear(onizle); onizle.appendChild(yaziEl(row));
        var s = imgSrc(row.gorsel_url); if (s) { gOnizle.src = s; gOnizle.hidden = false; gSil.hidden = false; } else { gOnizle.removeAttribute('src'); gOnizle.hidden = true; gSil.hidden = true; }
      }
      var t2; f.addEventListener('input', function () { clearTimeout(t2); t2 = setTimeout(guncelle, 150); }); f.addEventListener('change', guncelle);
      gSil.addEventListener('click', function () { gUrl.value = ''; gAlt.value = ''; guncelle(); });
      iptal.addEventListener('click', function () { edBox.hidden = true; clear(edBox); });

      gDosya.addEventListener('change', async function () {
        var dosya = gDosya.files && gDosya.files[0]; if (!dosya) return;
        if (!/^image\/(jpeg|png|webp)$/.test(dosya.type)) return msg(out, 'Yalnızca JPEG, PNG ya da WebP yükleyebilirsin.', 'err');
        msg(out, 'Fotoğraf yükleniyor…');
        try {
          var blob = await kucult(dosya, 1600);
          var yol = 'yazi/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
          var up = await E.sb.storage.from('gorseller').upload(yol, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
          if (up.error) throw up.error;
          gUrl.value = E.sb.storage.from('gorseller').getPublicUrl(yol).data.publicUrl;
          if (!gAlt.value) gAlt.value = baslik.value.trim().slice(0, 120);
          msg(out, 'Fotoğraf yüklendi.', 'ok'); guncelle();
        } catch (e) { msg(out, 'Yüklenemedi: ' + trErr(e), 'err'); }
      });

      cekBtn.addEventListener('click', async function () {
        var u = cekUrl.value.trim(); if (!/^https?:\/\//i.test(u)) return msg(out, 'Geçerli bir haber adresi yapıştır (https://…).', 'err');
        cekBtn.disabled = true; msg(out, 'Siteden bilgiler çekiliyor…');
        try {
          var j = await onizlemeGetir(u);
          if (j.title) baslik.value = j.title.slice(0, 200);
          if (j.description) ozet.value = j.description.slice(0, 500);
          if (j.image && /^https:\/\//i.test(j.image)) gUrl.value = j.image.slice(0, 600);
          if (j.site) kaynak.value = j.site.slice(0, 80);
          lUrl.value = (j.url || u).slice(0, 800); lDog.checked = true; if (!lEt.value) lEt.value = 'Haberin devamı';
          if (d.tur !== 'instagram') turAlan.value = 'baglanti';
          if (j.published) { var pd = new Date(j.published); if (!isNaN(pd)) tarihInp.value = yerelTarih(pd.toISOString()); }
          msg(out, 'Bilgiler geldi. Gözden geçirip "' + (yeniKayit ? 'Yayınla' : 'Kaydet') + '"e bas. Görsel kaynak siteden yüklenir; istersen kendi fotoğrafını yükleyebilirsin.', 'ok'); guncelle();
        } catch (e) { msg(out, 'Çekilemedi: ' + (e.message || trErr(e)), 'err'); }
        cekBtn.disabled = false;
      });

      f.addEventListener('submit', async function (e) {
        e.preventDefault(); var row = topla();
        if (!row.baslik) { baslik.focus(); return msg(out, 'Başlık zorunlu.', 'err'); }
        if (row.gorsel_url && !/^(https:\/\/|assets\/)/.test(row.gorsel_url)) return msg(out, 'Görsel adresi https:// ile başlamalı.', 'err');
        if (row.link_url && !/^https?:\/\//.test(row.link_url)) return msg(out, 'Bağlantı http:// ya da https:// ile başlamalı.', 'err');
        kaydet.disabled = true; msg(out, 'Kaydediliyor…');
        var r = d.id ? await sorgu().update(row).eq('id', d.id).select('id').single() : await sorgu().insert(row).select('id').single();
        kaydet.disabled = false;
        if (r.error) return msg(out, trErr(r.error), 'err');
        d.id = r.data.id; yeniKayit = false;
        msg(out, 'Kaydedildi. ', 'ok'); out.appendChild(h('a', { href: BASE + 'yazi.html?id=' + d.id, text: 'Yazıyı aç →' }));
        kaydet.textContent = 'Kaydet'; yukle(true);
      });
      guncelle();
    }

    yukle(true).then(function () {
      var id = parseInt(new URLSearchParams(location.search).get('duzenle') || '', 10);
      if (id) ac(id);
    });
  }

  // ---------- yönetim: konular ----------
  function slugla(s) {
    var m = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
    return String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, function (c) { return m[c]; }).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function mountKonuAdmin() {
    var root = $('#konu-admin'); if (!root) return;
    if (!E.sb || !E.profile || !E.profile.is_admin) return;
    clear(root);
    var liste = h('div', { class: 'list' }), form = h('div', { class: 'ed', hidden: true });
    var yeni = h('button', { type: 'button', class: 'btn', text: 'Yeni konu' });
    root.appendChild(h('h2', { text: 'Konular' }));
    root.appendChild(h('p', { class: 'lead', text: 'Konular yazılara etiket olarak eklenir ve "Konular" sayfasında listelenir.' }));
    root.appendChild(h('div', { class: 'actions' }, yeni)); root.appendChild(form); root.appendChild(liste);

    async function yukle() {
      await konularYukle(); clear(liste);
      if (!TEMALAR.length) liste.appendChild(h('p', { class: 'muted', text: 'Henüz konu yok.' }));
      TEMALAR.forEach(function (t) {
        liste.appendChild(h('div', { class: 'yrow' },
          h('div', { class: 'ybody' }, h('div', { class: 'meta', text: 'Sıra ' + t.sira + ' · ' + t.slug }), h('strong', { text: t.ad })),
          h('div', { class: 'acts' },
            h('button', { type: 'button', class: 'act', text: 'Düzenle', onclick: function () { ac(t); } }),
            h('a', { class: 'act', href: BASE + 'konu.html?s=' + encodeURIComponent(t.slug), text: 'Aç' }),
            h('button', { type: 'button', class: 'act', text: 'Sil', onclick: async function () {
              if (!confirm('"' + t.ad + '" konusu silinsin mi? Bu konuya bağlı yazılar silinmez, yalnızca etiket görünmez olur.')) return;
              var d = await E.sb.from('konular').delete().eq('id', t.id); if (d.error) alert(trErr(d.error)); else yukle();
            } }))));
      });
    }
    function ac(t) {
      var yeniK = !t;
      t = t || { ad: '', slug: '', aciklama: '', sira: TEMALAR.reduce(function (m, x) { return Math.max(m, x.sira); }, 0) + 10 };
      clear(form); form.hidden = false;
      var out = h('div', { class: 'msg', hidden: true });
      var ad = h('input', { name: 'ad', maxlength: '80', value: t.ad, placeholder: 'Örn. Eczane devirleri' });
      var slug = h('input', { name: 'slug', maxlength: '60', value: t.slug, placeholder: 'adres-parcasi', readonly: !yeniK });
      var acik = h('textarea', { name: 'aciklama', rows: '3', maxlength: '300', placeholder: 'Konu sayfasında görünecek kısa açıklama' }, t.aciklama || '');
      var sira = h('input', { name: 'sira', type: 'number', value: String(t.sira), step: '1' });
      var kaydet = h('button', { type: 'submit', class: 'btn', text: yeniK ? 'Konuyu ekle' : 'Kaydet' });
      var f = h('form', { class: 'form', novalidate: true },
        h('label', {}, 'Konu adı', h('span', { class: 'req', text: ' *' }), ad),
        h('label', {}, 'Adres parçası', slug),
        h('p', { class: 'hint', text: yeniK ? 'Konu adından kendiliğinden oluşur; istersen değiştir. Eklendikten sonra değiştirilemez.' : 'Adres parçası değiştirilemez (yazılar bu adrese bağlıdır).' }),
        h('label', {}, 'Açıklama', acik), h('label', {}, 'Sıra (küçük olan önce)', sira), out,
        h('div', { class: 'actions' }, kaydet, h('button', { type: 'button', class: 'btn ghost', text: 'Kapat', onclick: function () { form.hidden = true; clear(form); } })));
      if (yeniK) { var elle = false; slug.addEventListener('input', function () { elle = true; }); ad.addEventListener('input', function () { if (!elle) slug.value = slugla(ad.value); }); }
      f.addEventListener('submit', async function (e) {
        e.preventDefault(); var a = ad.value.trim(), s = slug.value.trim();
        if (a.length < 2) return msg(out, 'Konu adı en az 2 karakter olmalı.', 'err');
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length < 2) return msg(out, 'Adres parçası yalnızca küçük harf, rakam ve tire içerebilir.', 'err');
        var row = { ad: a, aciklama: acik.value.trim() || null, sira: parseInt(sira.value, 10) || 0 };
        kaydet.disabled = true;
        var r = yeniK ? await E.sb.from('konular').insert(Object.assign({ slug: s }, row)).select('id').single()
                      : await E.sb.from('konular').update(row).eq('id', t.id).select('id').single();
        kaydet.disabled = false;
        if (r.error) return msg(out, /duplicate|unique/i.test(r.error.message) ? 'Bu adres parçası zaten kullanılıyor.' : trErr(r.error), 'err');
        form.hidden = true; clear(form); yukle();
      });
      form.appendChild(h('h3', { class: 'sub', text: yeniK ? 'Yeni konu' : 'Konuyu düzenle' })); form.appendChild(f); ad.focus();
    }
    yeni.addEventListener('click', function () { ac(null); });
    yukle();
  }

  // ---------- başlat ----------
  E.ready.then(async function () {
    await konularYukle();
    mountHome(); mountGundem(); mountKonu(); mountKonular(); mountArsiv(); mountYazi(); mountAdmin(); mountKonuAdmin();
  });
})();
