/* Eczacı Direnişi: üyelik, akış, yorum, ilan ve yönetim (Supabase). Tüm kullanıcı metinleri textContent ile yazılır (XSS yok). */
(function () {
  'use strict';
  var C = window.ED_CONFIG || {};
  var ready = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  var sb = ready ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  var BASE = document.documentElement.getAttribute('data-base') || './';
  var me = null, profile = null;

  // ---------- yardımcılar ----------
  function h(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    function add(c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function when(iso) {
    var d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'şimdi'; if (s < 3600) return Math.floor(s / 60) + ' dk';
    if (s < 86400) return Math.floor(s / 3600) + ' sa';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function trErr(e) {
    var m = (e && e.message) || '';
    if (/hiz_siniri/.test(m)) return 'Çok hızlı paylaşıyorsun, biraz bekle.';
    if (/Invalid login credentials/i.test(m)) return 'E-posta ya da şifre yanlış.';
    if (/already registered|already been registered/i.test(m)) return 'Bu e-posta zaten kayıtlı.';
    if (/Email not confirmed/i.test(m)) return 'E-postanı henüz doğrulamadın. Gelen kutunu kontrol et.';
    if (/Password should|at least 8/i.test(m)) return 'Şifre en az 8 karakter olmalı.';
    if (/rate limit|too many|over_email_send_rate_limit/i.test(m)) return 'Çok sık denedin, biraz bekle.';
    if (/gecersiz_ilce/.test(m)) return 'Seçtiğin ilçe bu şehre ait değil.';
    if (/ilan_iletisim_tel_bicim/.test(m)) return 'Telefon numarası geçersiz.';
    if (/ilan_iletisim_eposta_bicim/.test(m)) return 'E-posta adresi geçersiz ya da kabul edilmiyor.';
    if (/ilan_iletisim_en_az_biri/.test(m)) return 'Telefon ya da e-posta vermelisin.';
    if (/ilan_iletisim_dahili_kural/.test(m)) return 'Dahili numara geçersiz.';
    if (/ilanlar_(sehir|pozisyon|ucret)_liste/.test(m)) return 'Şehir, pozisyon ve ücret listeden seçilmelidir.';
    if (/duplicate key|unique/i.test(m)) return 'Bu kayıt zaten var.';
    return m || 'Bir hata oluştu.';
  }
  function notReady(el) {
    clear(el); el.appendChild(h('p', { class: 'note', text: 'Üyelik sistemi henüz etkinleştirilmedi.' }));
  }
  function msg(el, text, kind) {
    el.textContent = text; el.className = 'msg ' + (kind || ''); el.hidden = !text;
  }
  function safeNext(n) { return /^[a-z0-9\-_\/]+\.html$/i.test(n || '') ? n : 'akis.html'; }
  function loginLink(text) {
    return h('a', { href: BASE + 'giris.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html'), text: text || 'Giriş yap' });
  }

  async function loadMe() {
    if (!sb) return;
    var r = await sb.auth.getSession();
    me = r.data.session ? r.data.session.user : null; profile = null;
    if (me) { var p = await sb.from('profiles').select('username,is_admin').eq('id', me.id).maybeSingle(); profile = p.data; }
  }

  // ---------- üst menü: giriş durumu ----------
  function mountAuthWidget() {
    var el = $('#auth'); if (!el) return;
    clear(el);
    if (!sb) { el.hidden = true; return; }
    if (!me) { el.appendChild(loginLink('Giriş / Kayıt')); return; }
    el.appendChild(h('span', { class: 'who', text: '@' + ((profile && profile.username) || 'üye') }));
    if (profile && profile.is_admin) el.appendChild(h('a', { href: BASE + 'yonetim.html', text: 'Yönetim' }));
    el.appendChild(h('button', { type: 'button', class: 'linkbtn', text: 'Çıkış', onclick: async function () { await sb.auth.signOut(); location.href = BASE + 'index.html'; } }));
  }

  // ---------- giriş / kayıt ----------
  function mountAuth(el) {
    if (!sb) return notReady(el);
    var params = new URLSearchParams(location.search), next = safeNext(params.get('next'));
    var out = $('.msg', el);
    var tabs = el.querySelectorAll('[data-tab]'), panels = el.querySelectorAll('[data-panel]');
    function show(name) {
      tabs.forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === name); });
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
      msg(out, '');
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-tab')); }); });
    show(params.get('kayit') ? 'kayit' : 'giris');
    if (me) { msg(out, 'Zaten giriş yaptın (@' + ((profile && profile.username) || '') + ').', 'ok'); }

    $('#f-giris', el).addEventListener('submit', async function (e) {
      e.preventDefault(); var f = e.target; msg(out, 'Giriş yapılıyor…');
      var r = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if (r.error) return msg(out, trErr(r.error), 'err');
      location.href = BASE + next;
    });
    $('#f-kayit', el).addEventListener('submit', async function (e) {
      e.preventDefault(); var f = e.target, u = f.username.value.trim();
      if (!/^[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]{3,20}$/.test(u)) return msg(out, 'Kullanıcı adı 3-20 karakter olmalı; harf, rakam ve _ kullanılabilir.', 'err');
      if (f.password.value.length < 8) return msg(out, 'Şifre en az 8 karakter olmalı.', 'err');
      if (!f.onay.checked) return msg(out, 'Devam etmek için gizlilik bilgilendirmesini onaylamalısın.', 'err');
      msg(out, 'Kayıt yapılıyor…');
      var ex = await sb.from('profiles').select('id').eq('username', u).maybeSingle();
      if (ex.data) return msg(out, 'Bu kullanıcı adı alınmış.', 'err');
      var r = await sb.auth.signUp({ email: f.email.value.trim(), password: f.password.value,
        options: { data: { username: u }, emailRedirectTo: location.origin + location.pathname } });
      if (r.error) return msg(out, trErr(r.error), 'err');
      if (r.data.session) { location.href = BASE + next; return; }
      msg(out, 'Kayıt alındı. E-postana gelen doğrulama bağlantısına tıkla, sonra giriş yap.', 'ok');
      f.reset();
    });
    $('#unuttum', el).addEventListener('click', async function () {
      var mail = $('#f-giris [name=email]', el).value.trim();
      if (!mail) return msg(out, 'Önce e-posta adresini yaz.', 'err');
      var r = await sb.auth.resetPasswordForEmail(mail, { redirectTo: location.origin + location.pathname });
      msg(out, r.error ? trErr(r.error) : 'Şifre yenileme bağlantısı e-postana gönderildi.', r.error ? 'err' : 'ok');
    });
    sb.auth.onAuthStateChange(function (ev) {
      if (ev !== 'PASSWORD_RECOVERY') return;
      var np = h('form', { class: 'form' },
        h('h2', { text: 'Yeni şifre' }),
        h('label', {}, 'Yeni şifre', h('input', { type: 'password', name: 'p', minlength: '8', required: true, autocomplete: 'new-password' })),
        h('button', { class: 'btn', type: 'submit', text: 'Şifreyi kaydet' }));
      np.addEventListener('submit', async function (e) {
        e.preventDefault();
        var r = await sb.auth.updateUser({ password: np.p.value });
        if (r.error) return msg(out, trErr(r.error), 'err');
        location.href = BASE + 'akis.html';
      });
      el.appendChild(np);
    });
  }

  // ---------- akış ve yorumlar ----------
  var PAGE = 20;
  function postItem(p, ctx) {
    var likeN = (p.likes && p.likes[0] && p.likes[0].count) || 0;
    var replyN = (p.replies && p.replies[0] && p.replies[0].count) || 0;
    var liked = ctx.liked.has(p.id), name = (p.profiles && p.profiles.username) || 'üye';
    var mine = me && p.author_id === me.id, admin = profile && profile.is_admin;
    var root = h('article', { class: 'tw' });
    var likeBtn = h('button', { type: 'button', class: 'act' + (liked ? ' on' : ''), 'aria-pressed': String(liked) });
    function paintLike() { likeBtn.textContent = (liked ? '♥ ' : '♡ ') + likeN; likeBtn.className = 'act' + (liked ? ' on' : ''); likeBtn.setAttribute('aria-pressed', String(liked)); }
    paintLike();
    likeBtn.addEventListener('click', async function () {
      if (!me) { location.href = loginLink().getAttribute('href'); return; }
      var was = liked; liked = !liked; likeN += liked ? 1 : -1; paintLike();
      var r = was ? await sb.from('likes').delete().eq('post_id', p.id).eq('user_id', me.id)
                  : await sb.from('likes').insert({ post_id: p.id });
      if (r.error) { liked = was; likeN += liked ? 1 : -1; paintLike(); }
    });
    var repliesBox = h('div', { class: 'replies', hidden: true });
    var replyBtn = h('button', { type: 'button', class: 'act', text: 'Yanıtla' + (replyN ? ' (' + replyN + ')' : '') });
    var opened = false;
    replyBtn.addEventListener('click', async function () {
      opened = !opened; repliesBox.hidden = !opened; if (!opened) return;
      clear(repliesBox);
      var list = h('div'); repliesBox.appendChild(list);
      var r = await sb.from('posts').select('id,body,created_at,author_id,profiles!posts_author_id_fkey(username)').eq('parent_id', p.id).order('created_at', { ascending: true });
      (r.data || []).forEach(function (x) { list.appendChild(replyItem(x)); });
      repliesBox.appendChild(composer({ parent: p.id, max: 280, label: 'Yanıtın', btn: 'Yanıtla', onPosted: function (x) { list.appendChild(replyItem(x)); } }));
    });
    function replyItem(x) {
      var n = (x.profiles && x.profiles.username) || 'üye';
      var row = h('div', { class: 'reply' }, h('div', { class: 'meta', text: '@' + n + ' · ' + when(x.created_at) }), h('div', { class: 'tw-body', text: x.body }));
      if ((me && x.author_id === me.id) || admin) row.appendChild(h('button', { type: 'button', class: 'act', text: 'Sil', onclick: async function () {
        if (!confirm('Bu yanıtı silmek istiyor musun?')) return;
        var d = await sb.from('posts').delete().eq('id', x.id); if (!d.error) row.remove();
      } }));
      return row;
    }
    var acts = h('div', { class: 'acts' }, likeBtn, replyBtn,
      h('button', { type: 'button', class: 'act', text: 'Bildir', onclick: async function (e) {
        if (!me) { location.href = loginLink().getAttribute('href'); return; }
        if (!confirm('Bu gönderiyi yöneticilere bildirmek istiyor musun?')) return;
        var r = await sb.from('reports').insert({ post_id: p.id });
        e.target.textContent = r.error && !/duplicate|unique/i.test(r.error.message) ? 'Bildirilemedi' : 'Bildirildi';
      } }));
    if (mine || admin) acts.appendChild(h('button', { type: 'button', class: 'act', text: 'Sil', onclick: async function () {
      if (!confirm('Bu gönderiyi silmek istiyor musun?')) return;
      var d = await sb.from('posts').delete().eq('id', p.id); if (!d.error) root.remove(); else alert(trErr(d.error));
    } }));
    root.appendChild(h('div', { class: 'meta', text: '@' + name + ' · ' + when(p.created_at) }));
    root.appendChild(h('div', { class: 'tw-body', text: p.body }));
    root.appendChild(acts); root.appendChild(repliesBox);
    return root;
  }

  function composer(o) {
    if (!me) return h('p', { class: 'note' }, 'Yazmak için ', loginLink('giriş yap'), ' ya da ', h('a', { href: BASE + 'giris.html?kayit=1', text: 'üye ol' }), '.');
    var ta = h('textarea', { rows: o.parent ? '2' : '3', maxlength: String(o.max), 'aria-label': o.label, placeholder: o.label });
    var cnt = h('span', { class: 'cnt', text: '0/' + o.max });
    var btn = h('button', { class: 'btn', type: 'submit', text: o.btn });
    var err = h('div', { class: 'msg', hidden: true });
    var f = h('form', { class: 'composer' }, ta, h('div', { class: 'crow' }, cnt, btn), err);
    ta.addEventListener('input', function () { cnt.textContent = ta.value.length + '/' + o.max; });
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); var body = ta.value.trim(); if (!body) return;
      btn.disabled = true; msg(err, '');
      var row = { body: body }; if (o.parent) row.parent_id = o.parent; if (o.ref) row.ref = o.ref;
      var r = await sb.from('posts').insert(row).select('id,body,created_at,author_id,parent_id,ref,profiles!posts_author_id_fkey(username),likes(count)').single();
      btn.disabled = false;
      if (r.error) return msg(err, trErr(r.error), 'err');
      ta.value = ''; cnt.textContent = '0/' + o.max; o.onPosted(r.data);
    });
    return f;
  }

  function mountFeed(el) {
    if (!sb) return notReady(el);
    var ref = el.getAttribute('data-ref') || null;
    clear(el);
    var top = h('div'), list = h('div', { class: 'tws' }), more = h('button', { type: 'button', class: 'btn ghost', text: 'Daha fazla', hidden: true });
    el.appendChild(top); el.appendChild(list); el.appendChild(more);
    var from = 0, ctx = { liked: new Set() };
    top.appendChild(composer({ max: ref ? 500 : 280, ref: ref, label: ref ? 'Yorumun' : 'Ne düşünüyorsun?', btn: ref ? 'Yorum yap' : 'Paylaş',
      onPosted: function (p) { list.insertBefore(postItem(p, ctx), list.firstChild); } }));
    async function load() {
      more.disabled = true;
      var q = sb.from('posts').select('id,body,created_at,author_id,parent_id,ref,profiles!posts_author_id_fkey(username),likes(count)')
        .is('parent_id', null).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
      q = ref ? q.eq('ref', ref) : q.is('ref', null);
      var r = await q;
      if (r.error) { list.appendChild(h('p', { class: 'note', text: 'Yüklenemedi: ' + trErr(r.error) })); return; }
      var rows = r.data || [];
      if (rows.length) {   // yanıt sayıları: kendine bağlanan ilişki yerine ayrı sorgu (daha sağlam)
        var rc = await sb.from('posts').select('parent_id').in('parent_id', rows.map(function (x) { return x.id; }));
        var counts = {}; (rc.data || []).forEach(function (x) { counts[x.parent_id] = (counts[x.parent_id] || 0) + 1; });
        rows.forEach(function (x) { x.replies = [{ count: counts[x.id] || 0 }]; });
      }
      if (me && rows.length) {
        var l = await sb.from('likes').select('post_id').eq('user_id', me.id).in('post_id', rows.map(function (x) { return x.id; }));
        (l.data || []).forEach(function (x) { ctx.liked.add(x.post_id); });
      }
      rows.forEach(function (p) { list.appendChild(postItem(p, ctx)); });
      if (!rows.length && from === 0) list.appendChild(h('p', { class: 'muted', text: ref ? 'Henüz yorum yok. İlk yorumu sen yaz.' : 'Henüz paylaşım yok. İlk paylaşımı sen yap.' }));
      from += PAGE; more.hidden = rows.length < PAGE; more.disabled = false;
    }
    more.addEventListener('click', load); load();
  }

  // ---------- ilanlar ----------
  var KALDIRMA_NEDENLERI = ['Pozisyon doldu / eleman bulundu', 'Devir gerçekleşti', 'Vazgeçtim', 'İlanda hata var, yenisini vereceğim', 'Diğer'];
  var ILAN_SEL = 'id,baslik,sehir,ilce,pozisyon,ucret,aciklama,created_at,ilan_iletisim(iletisim,tel_tur,tel,dahili,eposta)';

  // Telefon ve e-posta kuralları (veritabanındaki kısıtlamalarla aynıdır)
  var RE_CEP = /^05(0[15-7]|5[1-59]|3[0-9]|4[0-9])[0-9]{7}$/;
  var RE_SABIT = /^(0[234][0-9]{2}[2-9][0-9]{6}|0850[0-9]{7})$/;
  var RE_EPOSTA = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  var RE_GECICI = /@(mailinator|guerrillamail|10minutemail|tempmail|temp-mail|yopmail|trashmail|sharklasers|getnada|dispostable|maildrop|throwawaymail|fakeinbox)\./i;
  var ALAN_ONERI = { 'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com' };
  function telFormat(d) {                       // 05321234567 → 0 (532) 123 45 67
    d = String(d || '').replace(/\D/g, '').slice(0, 11); if (!d) return '';
    var s = d.slice(0, 1);
    if (d.length > 1) s += ' (' + d.slice(1, 4);
    if (d.length >= 4) s += ')';
    if (d.length > 4) s += ' ' + d.slice(4, 7);
    if (d.length > 7) s += ' ' + d.slice(7, 9);
    if (d.length > 9) s += ' ' + d.slice(9, 11);
    return s;
  }
  function telTemiz(v) { var d = String(v || '').replace(/\D/g, ''); if (d && d.charAt(0) !== '0') d = '0' + d; return d.slice(0, 11); }
  function epostaKontrol(v) {                   // hata metni ya da '' döner
    if (!RE_EPOSTA.test(v) || /\.\./.test(v) || /^\.|\.@/.test(v) || v.length > 120) return 'Geçerli bir e-posta adresi yaz (örn. ad@ornek.com).';
    if (RE_GECICI.test(v)) return 'Geçici (tek kullanımlık) e-posta adresleri kabul edilmez.';
    return '';
  }

  function iletisimNode(c) {
    if (Array.isArray(c)) c = c[0] || null;
    var box = h('p', { class: 'iletisim' });
    if (!c) { box.appendChild(h('b', { text: 'İletişim: ' })); box.appendChild(loginLink('Görmek için giriş yap')); return box; }
    if (c.tel) {
      var lbl = c.tel_tur === 'cep' ? 'Cep' : (c.tel_tur === 'dahili' ? 'Santral' : 'İş telefonu');
      var s = h('span', {}, h('b', { text: lbl + ': ' }), h('a', { href: 'tel:+90' + String(c.tel).slice(1), text: telFormat(c.tel) }));
      if (c.dahili) s.appendChild(document.createTextNode(' · Dahili ' + c.dahili));
      box.appendChild(s);
    }
    if (c.eposta) box.appendChild(h('span', {}, h('b', { text: 'E-posta: ' }), h('a', { href: 'mailto:' + c.eposta, text: c.eposta })));
    if (c.iletisim) box.appendChild(h('span', {}, h('b', { text: 'İletişim: ' }), c.iletisim));   // eski kayıtlar
    return box;
  }
  function ilanCard(l) {
    var where = [l.sehir, l.ilce].filter(Boolean).join(' / ');
    var facts = [];
    if (l.pozisyon) facts.push(h('span', {}, 'Pozisyon ', h('b', { text: l.pozisyon })));
    if (l.ucret) facts.push(h('span', {}, 'Ücret ', h('b', { text: l.ucret })));
    return h('article', { class: 'ilan', 'data-q': [l.baslik, where, l.aciklama, l.pozisyon].join(' ').toLowerCase(), 'data-sehir': l.sehir || '', 'data-poz': l.pozisyon || '' },
      h('div', { class: 'meta', text: where + ' · ' + new Date(l.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) }),
      h('h3', { text: l.baslik }),
      facts.length ? h.apply(null, ['p', { class: 'facts' }].concat(facts)) : null,
      l.aciklama ? h('p', { class: 'body-s', text: l.aciklama }) : null,
      iletisimNode(l.ilan_iletisim));
  }

  // İlanı veren kişi, sebep seçerek ilanını kaldırır
  function kaldirPaneli(l, onDone) {
    var sel = h('select', { 'aria-label': 'Kaldırma sebebi' }, h('option', { value: '' }, 'Sebep seç…'), KALDIRMA_NEDENLERI.map(function (n) { return h('option', { value: n }, n); }));
    var out = h('div', { class: 'msg', hidden: true });
    var panel = h('div', { class: 'kaldir' }, h('label', {}, 'İlanı neden kaldırıyorsun?', sel), out,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', text: 'İlanı kaldır', onclick: async function (e) {
          if (!sel.value) return msg(out, 'Bir sebep seç.', 'err');
          if (!confirm('Bu ilan kaldırılsın mı? Geri alınamaz.')) return;
          e.target.disabled = true;
          var r = await sb.from('ilanlar').update({ durum: 'kaldirildi', kaldirma_nedeni: sel.value }).eq('id', l.id).select('id');
          e.target.disabled = false;
          if (r.error || !r.data || !r.data.length) return msg(out, r.error ? trErr(r.error) : 'İlan kaldırılamadı.', 'err');
          onDone();
        } }),
        h('button', { class: 'btn ghost', type: 'button', text: 'Vazgeç', onclick: function () { panel.remove(); } })));
    return panel;
  }
  var DURUM = { beklemede: ['Onay bekliyor', 'wait'], yayinda: ['Yayında', 'on'], reddedildi: ['Reddedildi', 'no'], kaldirildi: ['Kaldırıldı', 'off'] };

  async function mountIlan(el) {
    if (!sb) return notReady(el);
    var tur = el.getAttribute('data-tur'), lim = parseInt(el.getAttribute('data-limit') || '100', 10);
    var q = $('#il-q'), cnt = $('#il-count'), selS = $('#il-sehir'), selP = $('#il-poz'), filt = $('.filters-ilan'), own = $('#il-own');
    var r = await sb.from('ilanlar').select(ILAN_SEL).eq('tur', tur).eq('durum', 'yayinda').order('created_at', { ascending: false }).limit(lim);

    // Üyenin kendi ilanları (yalnızca ilan sayfasında): durumu görür, yayındakini ya da bekleyeni sebep seçerek kaldırır
    if (me && own) {
      var mine = await sb.from('ilanlar').select(ILAN_SEL + ',durum,kaldirma_nedeni').eq('author_id', me.id).eq('tur', tur).order('created_at', { ascending: false });
      clear(own);
      if (!mine.error && (mine.data || []).length) {
        own.hidden = false;
        own.appendChild(h('h3', { text: 'Senin ilanların' }));
        mine.data.forEach(function (l) {
          var card = ilanCard(l), d = DURUM[l.durum] || [l.durum, 'off'], meta = card.querySelector('.meta');
          meta.insertBefore(h('span', { class: 'badge ' + d[1], text: d[0] }), meta.firstChild);
          if (l.durum === 'kaldirildi' && l.kaldirma_nedeni) card.appendChild(h('p', { class: 'muted', text: 'Kaldırma sebebi: ' + l.kaldirma_nedeni }));
          if (l.durum === 'beklemede' || l.durum === 'yayinda') {
            var btn = h('button', { type: 'button', class: 'act', text: 'İlanı kaldır' });
            btn.addEventListener('click', function () {
              if (card.querySelector('.kaldir')) return;
              card.appendChild(kaldirPaneli(l, function () { mountIlan(el); }));
            });
            card.appendChild(h('div', { class: 'acts' }, btn));
          }
          own.appendChild(card);
        });
      } else own.hidden = true;
    }

    clear(el);
    if (r.error) return el.appendChild(h('p', { class: 'note', text: 'İlanlar yüklenemedi.' }));
    var rows = r.data || [];
    if (!rows.length) {
      el.appendChild(h('div', { class: 'empty' }, h('h3', { text: tur === 'is' ? 'Henüz yayında iş ilanı yok.' : 'Henüz yayında devir ilanı yok.' }),
        h('p', { text: 'İlanlar yönetici onayından sonra burada görünür.' }), h('a', { class: 'btn', href: BASE + 'ilan-ver.html?tur=' + tur, text: 'İlan ver' })));
      if (filt) filt.hidden = true; if (cnt) cnt.hidden = true; return;
    }
    if (filt) filt.hidden = false; if (cnt) cnt.hidden = false;
    var cards = rows.map(ilanCard); cards.forEach(function (c) { el.appendChild(c); });
    function apply() {
      var s = q ? q.value.toLowerCase().trim() : '', sc = selS ? selS.value : '', pc = selP ? selP.value : '', n = 0;
      cards.forEach(function (c) {
        var ok = (!s || c.getAttribute('data-q').indexOf(s) > -1) && (!sc || c.getAttribute('data-sehir') === sc) && (!pc || c.getAttribute('data-poz') === pc);
        c.style.display = ok ? '' : 'none'; if (ok) n++;
      });
      if (cnt) cnt.textContent = n + ' ilan';
    }
    el.__apply = apply;
    if (!el.__bagli) { [q, selS, selP].forEach(function (x) { if (x) x.addEventListener(x === q ? 'input' : 'change', function () { el.__apply(); }); }); el.__bagli = true; }
    apply();
  }

  function mountIlanForm(el) {
    if (!sb) return notReady(el);
    var form = $('#f', el), out = $('.msg', el);
    if (!me) { form.hidden = true; clear(out); out.hidden = false; out.className = 'note'; out.appendChild(document.createTextNode('İlan vermek için ')); out.appendChild(loginLink('giriş yap')); out.appendChild(document.createTextNode(' ya da ')); out.appendChild(h('a', { href: BASE + 'giris.html?kayit=1', text: 'üye ol' })); out.appendChild(document.createTextNode('.')); return; }
    var t0 = new URLSearchParams(location.search).get('tur'); if (t0 === 'is' || t0 === 'devir') form.querySelector('input[name=tur][value=' + t0 + ']').checked = true;
    var isalan = $('#isalan', el);
    function tog() { isalan.style.display = form.tur.value === 'is' ? '' : 'none'; } form.addEventListener('change', tog); tog();

    // şehir → ilçe (973 ilçe, assets/ilceler.json)
    var ILCE = null;
    async function ilceListesi() { if (!ILCE) { var r = await fetch(BASE + 'assets/ilceler.json'); ILCE = await r.json(); } return ILCE; }
    function ilceDoldur(liste, secili) {
      var s = form.ilce; clear(s);
      if (!liste) { s.disabled = true; s.appendChild(h('option', { value: '' }, 'Önce şehir seç…')); return; }
      s.disabled = false; s.appendChild(h('option', { value: '' }, 'İlçe seç…'));
      liste.forEach(function (n) { s.appendChild(h('option', { value: n, selected: n === secili }, n)); });
    }
    form.sehir.addEventListener('change', async function () {
      if (!form.sehir.value) return ilceDoldur(null);
      try { var l = await ilceListesi(); ilceDoldur(l[form.sehir.value] || []); } catch (e) { ilceDoldur(null); msg(out, 'İlçe listesi yüklenemedi, sayfayı yenile.', 'err'); }
    });

    // iletişim: telefon türü, biçimlendirme, doğrulama
    var telTur = form.tel_tur, telGrup = $('#tel-grup'), telInp = form.tel, dahInp = form.dahili, epInp = form.eposta;
    var telHata = $('#tel-hata'), dahHata = $('#dahili-hata'), epHata = $('#eposta-hata'), epOner = $('#eposta-oner');
    var METIN = {
      cep: ['Cep telefonu numarası', '0 (5__) ___ __ __', 'Kişisel numaran; yalnızca giriş yapmış üyelere gösterilir.'],
      sabit: ['İş / sabit hat numarası', '0 (___) ___ __ __', 'Alan kodu ile birlikte yaz (örn. 0 212 ...).'],
      dahili: ['Santral (ana hat) numarası', '0 (___) ___ __ __', 'Santral numarasını yaz, dahili numarayı aşağıdaki kutuya ekle.']
    };
    function turDegisti() {
      var t = telTur.value;
      telGrup.hidden = !t; $('#dahili-grup').hidden = t !== 'dahili';
      telInp.required = !!t; dahInp.required = t === 'dahili'; epInp.required = !t;
      $('#eposta-zorunlu').hidden = !!t;
      telInp.value = ''; dahInp.value = ''; telHata.textContent = ''; dahHata.textContent = '';
      if (t) { $('#tel-etiket').textContent = METIN[t][0]; telInp.placeholder = METIN[t][1]; $('#tel-ipucu').textContent = METIN[t][2]; }
    }
    telTur.addEventListener('change', turDegisti); turDegisti();
    function telDogrula(bos) {
      var t = telTur.value; if (!t) return true;
      var d = telTemiz(telInp.value);
      if (!d) { telHata.textContent = bos ? 'Telefon numarasını yaz.' : ''; return !bos; }
      var ok = t === 'cep' ? RE_CEP.test(d) : RE_SABIT.test(d);
      telHata.textContent = ok ? '' : (t === 'cep' ? 'Geçerli bir cep telefonu yaz: 0 ile başlayan 11 hane (örn. 0 532 123 45 67).' : 'Geçerli bir sabit hat yaz: alan kodu (2, 3 ya da 4 ile başlar) + 7 haneli numara.');
      return ok;
    }
    telInp.addEventListener('input', function () { telInp.value = telFormat(telTemiz(telInp.value)); if (telHata.textContent) telDogrula(false); });
    telInp.addEventListener('blur', function () { telDogrula(false); });
    dahInp.addEventListener('input', function () { dahInp.value = dahInp.value.replace(/\D/g, '').slice(0, 6); dahHata.textContent = ''; });
    function epDogrula(zorunlu) {
      var v = epInp.value.trim(); epOner.textContent = '';
      if (!v) { epHata.textContent = zorunlu ? 'Telefon vermedin, e-posta adresi zorunlu.' : ''; return !zorunlu; }
      var hata = epostaKontrol(v); epHata.textContent = hata;
      if (!hata) {
        var dom = v.split('@')[1].toLowerCase();
        if (ALAN_ONERI[dom]) {
          var duz = v.split('@')[0] + '@' + ALAN_ONERI[dom];
          epOner.appendChild(document.createTextNode('Bunu mu demek istedin: ')); epOner.appendChild(h('button', { type: 'button', text: duz, onclick: function () { epInp.value = duz; epOner.textContent = ''; } })); epOner.appendChild(document.createTextNode('?'));
        }
      }
      return !hata;
    }
    epInp.addEventListener('blur', function () { epDogrula(!telTur.value); });
    epInp.addEventListener('input', function () { if (epHata.textContent) epDogrula(!telTur.value); });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var v = function (n) { return (form.elements[n].value || '').trim(); };
      var bad = [].slice.call(form.querySelectorAll('[required]')).filter(function (x) { return !x.value.trim(); });
      [].slice.call(form.querySelectorAll('.bad')).forEach(function (x) { x.classList.remove('bad'); });
      if (bad.length) { bad.forEach(function (x) { x.classList.add('bad'); }); bad[0].focus(); if (!telTur.value && !epInp.value.trim()) epDogrula(true); return msg(out, 'Zorunlu alanları doldur.', 'err'); }
      var t = telTur.value, tOk = telDogrula(true), eOk = epDogrula(!t);
      if (t === 'dahili' && !/^[0-9]{1,6}$/.test(dahInp.value)) { dahHata.textContent = 'Dahili numarayı yaz (en çok 6 rakam).'; dahInp.classList.add('bad'); dahInp.focus(); return msg(out, 'Dahili numarayı kontrol et.', 'err'); }
      if (!tOk) { telInp.classList.add('bad'); telInp.focus(); return msg(out, 'Telefon numarasını kontrol et.', 'err'); }
      if (!eOk) { epInp.classList.add('bad'); epInp.focus(); return msg(out, 'E-posta adresini kontrol et.', 'err'); }
      var btn = $('button[type=submit]', form); btn.disabled = true; msg(out, 'Gönderiliyor…');
      var tur = form.tur.value;
      var ins = await sb.from('ilanlar').insert({ tur: tur, baslik: v('baslik'), sehir: v('sehir'), ilce: v('ilce'),
        pozisyon: tur === 'is' ? (v('pozisyon') || null) : null, ucret: tur === 'is' ? (v('ucret') || null) : null, aciklama: v('aciklama') || null }).select('id').single();
      if (ins.error) { btn.disabled = false; return msg(out, trErr(ins.error), 'err'); }
      var c = await sb.from('ilan_iletisim').insert({ ilan_id: ins.data.id, tel_tur: t || null, tel: t ? telTemiz(telInp.value) : null,
        dahili: t === 'dahili' ? dahInp.value : null, eposta: epInp.value.trim().toLowerCase() || null });
      btn.disabled = false;
      if (c.error) { await sb.from('ilanlar').delete().eq('id', ins.data.id); return msg(out, trErr(c.error), 'err'); }
      form.reset(); tog(); turDegisti(); ilceDoldur(null);
      msg(out, 'İlanın alındı ve onay bekliyor. Yönetici onayladıktan sonra sitede yayınlanır. Durumunu ' + (tur === 'is' ? '"İş ilanları"' : '"Devir ilanları"') + ' sayfasındaki "Senin ilanların" bölümünde görebilir, istersen oradan sebep seçerek kaldırabilirsin.', 'ok');
    });
  }

  // ---------- Instagram paylaşımları (resmî embed; yalnızca yönetici ekler) ----------
  var IG_TUR = { p: 1, reel: 1, tv: 1 };
  function parseIg(u) {
    var m = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,20})/i.exec((u || '').trim());
    if (!m) return null;
    var t = m[1].toLowerCase(); if (t === 'reels') t = 'reel';
    return { tur: t, kod: m[2] };
  }
  function igCard(x, onDel) {
    if (!IG_TUR[x.tur] || !/^[A-Za-z0-9_-]{5,20}$/.test(x.kod)) return null;   // yalnızca doğrulanmış kodlar iframe'e girer
    var base = 'https://www.instagram.com/' + x.tur + '/' + x.kod + '/';
    var card = h('article', { class: 'ig' });
    if (x.baslik) card.appendChild(h('p', { class: 'ig-title', text: x.baslik }));
    card.appendChild(h('iframe', { class: 'ig-frame', src: base + 'embed/', loading: 'lazy', title: 'Instagram paylaşımı', scrolling: 'no',
      sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox', referrerpolicy: 'strict-origin-when-cross-origin' }));
    var acts = h('div', { class: 'acts' }, h('a', { class: 'act', href: base, target: '_blank', rel: 'noopener', text: 'Instagram\'da aç' }));
    if (onDel) acts.appendChild(h('button', { type: 'button', class: 'act', text: 'Kaldır', onclick: onDel }));
    card.appendChild(acts);
    return card;
  }
  async function mountIg(el) {
    if (!sb) return notReady(el);
    var lim = parseInt(el.getAttribute('data-limit') || '6', 10), withMore = el.getAttribute('data-more') === '1';
    var sec = el.closest('#ig-sec'), admin = !!(profile && profile.is_admin), from = 0;
    var btn = null;
    if (withMore && !el.__btn) {
      btn = h('button', { type: 'button', class: 'btn ghost', text: 'Daha fazla', hidden: true });
      el.parentNode.insertBefore(btn, el.nextSibling); el.__btn = btn;
    }
    async function load() {
      var r = await sb.from('paylasimlar').select('id,tur,kod,baslik,created_at').order('created_at', { ascending: false }).range(from, from + lim - 1);
      if (from === 0) clear(el);
      if (r.error) { el.appendChild(h('p', { class: 'note', text: 'Paylaşımlar yüklenemedi.' })); return; }
      var rows = r.data || [];
      rows.forEach(function (x) {
        var c = igCard(x, admin ? function () {
          if (!confirm('Bu paylaşım kaldırılsın mı?')) return;
          sb.from('paylasimlar').delete().eq('id', x.id).then(function (d) { if (!d.error) c.remove(); else alert(trErr(d.error)); });
        } : null);
        if (c) el.appendChild(c);
      });
      if (from === 0 && !rows.length) { if (sec) { sec.hidden = true; return; } el.appendChild(h('p', { class: 'muted', text: 'Henüz paylaşım yok.' })); return; }
      if (from === 0 && sec) sec.hidden = false;
      from += lim;
      if (el.__btn) el.__btn.hidden = rows.length < lim;
    }
    if (el.__btn) el.__btn.onclick = load;
    el.__reload = function () { from = 0; return load(); };
    await load();
  }

  // ---------- yönetim ----------
  async function mountAdmin(el) {
    if (!sb) return notReady(el);
    if (!profile || !profile.is_admin) { clear(el); el.appendChild(h('p', { class: 'note', text: 'Bu sayfa yalnızca yöneticiler içindir.' })); return; }
    var igf = $('#ig-form', el), igl = $('#ig-admin-list', el);
    if (igf) igf.addEventListener('submit', async function (e) {
      e.preventDefault();
      var out = $('.msg', igf), p = parseIg(igf.url.value);
      if (!p) return msg(out, 'Geçerli bir Instagram gönderi bağlantısı yapıştır (…/p/KOD/ ya da …/reel/KOD/).', 'err');
      msg(out, 'Ekleniyor…');
      var r = await sb.from('paylasimlar').insert({ tur: p.tur, kod: p.kod, baslik: igf.baslik.value.trim() || null });
      if (r.error) return msg(out, /duplicate|unique/i.test(r.error.message) ? 'Bu paylaşım zaten eklenmiş.' : trErr(r.error), 'err');
      igf.reset(); msg(out, 'Eklendi. Ana sayfada görünür.', 'ok');
      if (igl && igl.__reload) igl.__reload();
    });
    var ilanBox = $('#adm-ilan', el), repBox = $('#adm-rep', el);
    async function loadIlan() {
      clear(ilanBox);
      var r = await sb.from('ilanlar').select('id,tur,baslik,sehir,ilce,pozisyon,ucret,aciklama,created_at,profiles!ilanlar_author_id_fkey(username),ilan_iletisim(iletisim,tel_tur,tel,dahili,eposta)').eq('durum', 'beklemede').order('created_at');
      if (r.error) return ilanBox.appendChild(h('p', { class: 'note', text: trErr(r.error) }));
      if (!(r.data || []).length) return ilanBox.appendChild(h('p', { class: 'muted', text: 'Onay bekleyen ilan yok.' }));
      r.data.forEach(function (l) {
        var card = ilanCard(l);
        var set = async function (durum) { var u = await sb.from('ilanlar').update({ durum: durum }).eq('id', l.id); if (!u.error) card.remove(); else alert(trErr(u.error)); };
        card.insertBefore(h('div', { class: 'meta', text: (l.tur === 'is' ? 'İŞ İLANI' : 'DEVİR İLANI') + ' · gönderen @' + ((l.profiles && l.profiles.username) || '?') }), card.firstChild);
        card.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', text: 'Onayla', onclick: function () { set('yayinda'); } }), h('button', { class: 'btn ghost', type: 'button', text: 'Reddet', onclick: function () { set('reddedildi'); } })));
        ilanBox.appendChild(card);
      });
    }
    async function loadRep() {
      clear(repBox);
      var r = await sb.from('reports').select('id,post_id,created_at,posts(id,body,profiles!posts_author_id_fkey(username))').order('created_at');
      if (r.error) return repBox.appendChild(h('p', { class: 'note', text: trErr(r.error) }));
      if (!(r.data || []).length) return repBox.appendChild(h('p', { class: 'muted', text: 'Bildirilen gönderi yok.' }));
      r.data.forEach(function (x) {
        var row = h('article', { class: 'tw' }, h('div', { class: 'meta', text: '@' + ((x.posts && x.posts.profiles && x.posts.profiles.username) || '?') + ' · bildirildi ' + when(x.created_at) }),
          h('div', { class: 'tw-body', text: (x.posts && x.posts.body) || '(silinmiş)' }),
          h('div', { class: 'acts' },
            h('button', { class: 'act', type: 'button', text: 'Gönderiyi sil', onclick: async function () { if (!confirm('Gönderi kalıcı silinsin mi?')) return; var d = await sb.from('posts').delete().eq('id', x.post_id); if (!d.error) row.remove(); else alert(trErr(d.error)); } }),
            h('button', { class: 'act', type: 'button', text: 'Bildirimi kapat', onclick: async function () { var d = await sb.from('reports').delete().eq('id', x.id); if (!d.error) row.remove(); } })));
        repBox.appendChild(row);
      });
    }
    loadIlan(); loadRep();
  }

  // ---------- başlat ----------
  async function init() {
    await loadMe();
    mountAuthWidget();
    var m;
    if ((m = $('#auth-box'))) mountAuth(m);
    if ((m = $('#akis'))) mountFeed(m);
    document.querySelectorAll('[data-ref]').forEach(function (e) { if (e.id === 'yorumlar') mountFeed(e); });
    document.querySelectorAll('[data-tur].ilanlar').forEach(mountIlan);
    document.querySelectorAll('.igs[data-limit]').forEach(mountIg);
    if ((m = $('#ilan-form'))) mountIlanForm(m);
    if ((m = $('#yonetim'))) mountAdmin(m);
  }
  // Diğer betiklerin (icerik.js) kullanacağı ortak araçlar
  window.ED = {
    get sb() { return sb; }, get me() { return me; }, get profile() { return profile; }, config: C,
    h: h, $: $, clear: clear, msg: msg, trErr: trErr, when: when, loginLink: loginLink, BASE: BASE, mountFeed: mountFeed, notReady: notReady
  };
  window.ED.ready = new Promise(function (resolve) {
    function go() { init().then(resolve, resolve); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  });
})();
