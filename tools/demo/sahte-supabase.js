// SADECE DEMO/TEST: bellek içi (localStorage) sahte supabase-js. Erişim kurallarının (RLS) tam taklidi DEĞİLDİR; güvenlik testi sayılmaz.
(function () {
  var KEY = 'fakedb';
  var db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  db = db || { users: [], profiles: [], posts: [], likes: [], reports: [], ilanlar: [], ilan_iletisim: [], seq: 1, session: null, autoConfirm: false };
  db.paylasimlar = db.paylasimlar || [];
  db.yazilar = db.yazilar || [];
  db.konular = db.konular || [];
  db.reklamlar = db.reklamlar || [];
  db.reklam_sayac = db.reklam_sayac || [];

  // Demo başlangıç verisi (ilk açılışta bir kez). Hepsi uydurma örnektir; parolalar yalnızca bu sahte veritabanında geçer.
  if (!db.users.length) {
    var gun = function (n) { return new Date(Date.now() + n * 86400000).toISOString(); };
    db.seq = 100; db.autoConfirm = true;
    db.users.push({ id: 'u1', email: 'yonetici@ornek.test', password: 'demo-parola-123', confirmed: true }, { id: 'u2', email: 'uye@ornek.test', password: 'demo-parola-123', confirmed: true });
    db.profiles.push({ id: 'u1', username: 'demo_yonetici', is_admin: true }, { id: 'u2', username: 'demo_uye', is_admin: false });
    db.konular.push({ id: 1, slug: 'ornek-konu', ad: 'Örnek konu', aciklama: 'Demo için örnek konu.', sira: 10 });
    db.yazilar.push({ id: 2, tur: 'yazi', kod: null, baslik: 'ÖRNEK köşe yazısı', ozet: 'Demo için uydurma metin.', govde: 'Bu metin yalnızca görünümü denemek içindir.', yazar_adi: 'Örnek Yazar', gorsel_url: 'assets/logo.jpg', gorsel_konum: 'ust', temalar: ['ornek-konu'], yayinda: true, gundemde: true, one_cikan: true, link_dogrudan: false, yayin_tarihi: gun(-1) });
    db.ilanlar.push({ id: 3, tur: 'devir', author_id: 'u2', baslik: 'ÖRNEK devir ilanı', sehir: 'İzmir', ilce: 'Bornova', ruhsat: 'Ruhsatlı', aciklama: 'Gerçek bir ilan değildir.', durum: 'yayinda', bitis_tarihi: gun(55), created_at: gun(-5) });
    db.ilan_iletisim.push({ ilan_id: 3, eposta: 'ilan@ornek.test' });
    db.posts.push({ id: 4, author_id: 'u2', body: 'ÖRNEK paylaşım: akış böyle görünür.', kategori: 'Genel', parent_id: null, ref: null, created_at: gun(-0.1) });
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* depolama kapalı */ }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(db)); }
  function me() { return db.session; }
  function prof(id) { return db.profiles.find(function (p) { return p.id === id; }); }
  function isAdmin() { var p = me() && prof(me().id); return !!(p && p.is_admin); }
  function now() { return new Date().toISOString(); }
  var cbs = [];

  function embed(table, row, sel) {
    var r = Object.assign({}, row);
    if (/profiles(!\w+)?\(/.test(sel) && row.author_id) { var p = prof(row.author_id); r.profiles = p ? { username: p.username, is_admin: p.is_admin } : null; }
    if (/likes\(count\)/.test(sel)) r.likes = [{ count: db.likes.filter(function (l) { return l.post_id === row.id; }).length }];
    if (/replies:/.test(sel)) r.replies = [{ count: db.posts.filter(function (x) { return x.parent_id === row.id; }).length }];
    if (/ilan_iletisim\(/.test(sel)) { var c = db.ilan_iletisim.find(function (x) { return x.ilan_id === row.id; }); r.ilan_iletisim = me() && c ? Object.assign({}, c) : null; }
    if (table === 'reports' && /ilanlar\(/.test(sel)) { var ii = db.ilanlar.find(function (x) { return x.id === row.ilan_id; }); r.ilanlar = ii ? Object.assign({}, ii) : null; }
    if (table === 'reports' && /posts\(/.test(sel)) { var po = db.posts.find(function (x) { return x.id === row.post_id; }); r.posts = po ? Object.assign({}, po, { profiles: { username: (prof(po.author_id) || {}).username } }) : null; }
    return r;
  }
  function visible(table, r) {
    if (table === 'reklam_sayac') return isAdmin();
    if (table === 'reklamlar') return isAdmin() || (r.aktif && new Date(r.baslangic) <= Date.now() && (!r.bitis || new Date(r.bitis) > Date.now()));
    if (table === 'ilanlar') return (r.durum === 'yayinda' && (!r.bitis_tarihi || new Date(r.bitis_tarihi) > Date.now())) || (me() && r.author_id === me().id) || isAdmin();
    if (table === 'reports') return isAdmin();
    if (table === 'yazilar') return r.yayinda || isAdmin();
    return true;
  }
  function err(m) { return { data: null, error: { message: m } }; }

  function run(st) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var t = st.table, rows = db[t];
        if (!rows) return resolve(err('tablo yok: ' + t));
        var out;
        if (st.op === 'insert') {
          var u = me(); if (!u && t !== 'profiles') return resolve(err('new row violates row-level security policy'));
          var p = Object.assign({}, st.payload);
          if (t === 'posts') {
            p.author_id = u.id; if (!p.body || !p.body.trim() || p.body.length > 500) return resolve(err('check violation'));
            var recent = db.posts.filter(function (x) { return x.author_id === u.id && Date.now() - new Date(x.created_at) < 60000; }).length;
            if (recent >= 6) return resolve(err('hiz_siniri'));
            p.id = db.seq++; p.created_at = now(); p.parent_id = p.parent_id || null; p.ref = p.ref || null;
          } else if (t === 'likes') {
            p.user_id = u.id; if (db.likes.some(function (l) { return l.post_id === p.post_id && l.user_id === u.id; })) return resolve(err('duplicate key value violates unique constraint'));
          } else if (t === 'reports') {
            p.user_id = u.id; p.id = db.seq++; p.created_at = now();
            if (!!p.post_id === !!p.ilan_id) return resolve(err('check constraint reports_tek_hedef'));
            if (db.reports.some(function (l) { return l.post_id === p.post_id && l.ilan_id === p.ilan_id && l.user_id === u.id; })) return resolve(err('duplicate key value violates unique constraint'));
          } else if (t === 'ilanlar') {
            p.author_id = u.id; p.durum = 'beklemede'; p.id = db.seq++; p.created_at = now();
          } else if (t === 'paylasimlar') {
            if (!isAdmin()) return resolve(err('new row violates row-level security policy for table "paylasimlar"'));
            if (db.paylasimlar.some(function (x) { return x.kod === p.kod; })) return resolve(err('duplicate key value violates unique constraint'));
            p.id = db.seq++; p.created_at = now();
          } else if (t === 'konular') {
            if (!isAdmin()) return resolve(err('new row violates row-level security policy for table "konular"'));
            if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug || '')) return resolve(err('check constraint slug'));
            if (db.konular.some(function (x) { return x.slug === p.slug; })) return resolve(err('duplicate key value violates unique constraint'));
            p.id = db.seq++; p.created_at = now();
          } else if (t === 'yazilar') {
            if (!isAdmin()) return resolve(err('new row violates row-level security policy for table "yazilar"'));
            if (!p.baslik || !String(p.baslik).trim()) return resolve(err('check constraint baslik'));
            if (p.gorsel_url && !/^(https:\/\/|assets\/)/.test(p.gorsel_url)) return resolve(err('check constraint gorsel_url'));
            if (p.kod && db.yazilar.some(function (x) { return x.kod === p.kod; })) return resolve(err('duplicate key value violates unique constraint'));
            p = Object.assign({ tur: 'yazi', kod: null, gorsel_konum: 'ust', yayinda: true, gundemde: true, one_cikan: false, link_dogrudan: false, temalar: [], yayin_tarihi: now() }, p);
            p.id = db.seq++; p.created_at = now(); p.updated_at = now();
          } else if (t === 'reklamlar') {
            if (!isAdmin()) return resolve(err('new row violates row-level security policy'));
            p = Object.assign({ aktif: true, baslangic: now(), bitis: null }, p); p.id = db.seq++; p.created_at = now();
          } else if (t === 'ilan_iletisim') {
            var il =db.ilanlar.find(function (x) { return x.id === p.ilan_id && x.author_id === u.id; }); if (!il) return resolve(err('new row violates row-level security policy'));
          }
          db[t].push(p); save(); out = [embed(t, p, st.sel)];
          if (!st.sel) return resolve({ data: null, error: null });
        } else {
          var matched = rows.filter(function (r) { return st.filters.every(function (f) { return f(r); }); });
          if (st.op === 'select') matched = matched.filter(function (r) { return visible(t, r); });
          if (st.op === 'delete') {
            var u2 = me(); if (!u2) return resolve(err('permission denied'));
            matched = matched.filter(function (r) { return isAdmin() || r.author_id === u2.id || r.user_id === u2.id; });
            var ids = matched.map(function (r) { return r.id; });
            db[t] = rows.filter(function (r) { return matched.indexOf(r) < 0; });
            if (t === 'posts') { db.posts = db.posts.filter(function (r) { return ids.indexOf(r.parent_id) < 0; }); db.reports = db.reports.filter(function (r) { return ids.indexOf(r.post_id) < 0; }); }
            save(); return resolve({ data: null, error: null });
          }
          if (st.op === 'update') {
            if (t === 'ilanlar' && !isAdmin()) {   // sahibi yalnızca kendi ilanını sebep belirterek kaldırabilir
              var uu = me(); var P = st.payload || {};
              matched = matched.filter(function (r) { return uu && r.author_id === uu.id && (r.durum === 'beklemede' || r.durum === 'yayinda'); });
              if (!(P.durum === 'kaldirildi' && P.kaldirma_nedeni)) matched = [];
              if (!matched.length) { return resolve(st.sel ? { data: [], error: null } : { data: null, error: null }); }
              matched.forEach(function (r) { Object.assign(r, P, { kaldirma_tarihi: now() }); }); save();
              return resolve({ data: matched.map(function (r) { return embed(t, r, st.sel); }), error: null });
            }
            if (!isAdmin()) return resolve(err('permission denied for update'));
            if (t === 'yazilar' && st.payload.gorsel_url && !/^(https:\/\/|assets\/)/.test(st.payload.gorsel_url)) return resolve(err('check constraint gorsel_url'));
            matched.forEach(function (r) { if (t === 'ilanlar' && st.payload.durum === 'yayinda' && r.durum !== 'yayinda') r.bitis_tarihi = new Date(Date.now() + 60 * 86400000).toISOString(); Object.assign(r, st.payload, { updated_at: now() }); }); save();
            if (!st.sel) return resolve({ data: null, error: null });
            out = matched.map(function (r) { return embed(t, r, st.sel); });
            if (st.single) return resolve(out.length === 1 ? { data: out[0], error: null } : err('beklenen tek satır'));
            return resolve({ data: out, error: null });
          }
          if (st.order && st.order.length) { matched = matched.slice().sort(function (a, b) { for (var i = 0; i < st.order.length; i++) { var c = st.order[i][0], d = st.order[i][1]; var x = a[c], y = b[c]; var cmp = (typeof x === 'string' && typeof y === 'string') ? x.localeCompare(y, 'tr') : (x > y ? 1 : x < y ? -1 : 0); if (cmp) return cmp * d; } return 0; }); }
          if (st.range) matched = matched.slice(st.range[0], st.range[1] + 1);
          if (st.limit) matched = matched.slice(0, st.limit);
          out = matched.map(function (r) { return embed(t, r, st.sel); });
        }
        if (st.single) return resolve(out.length === 1 ? { data: out[0], error: null } : err('beklenen tek satır, gelen ' + out.length));
        if (st.maybe) return resolve({ data: out[0] || null, error: null });
        resolve({ data: out, error: null });
      }, 5);
    });
  }
  function Q(table) {
    var st = { table: table, op: 'select', filters: [], order: null, range: null, limit: null, payload: null, sel: '', single: false, maybe: false };
    var q = {
      select: function (s) { st.sel = s || ''; return q; }, insert: function (p) { st.op = 'insert'; st.payload = p; return q; },
      delete: function () { st.op = 'delete'; return q; }, update: function (p) { st.op = 'update'; st.payload = p; return q; },
      eq: function (c, v) { st.filters.push(function (r) { return r[c] === v; }); return q; },
      is: function (c, v) { st.filters.push(function (r) { return (r[c] == null ? null : r[c]) === v; }); return q; },
      contains: function (c, arr) { st.filters.push(function (r) { return Array.isArray(r[c]) && arr.every(function (x) { return r[c].indexOf(x) > -1; }); }); return q; },
      ilike: function (c, pat) { var re = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); st.filters.push(function (r) { return re.test(r[c] || ''); }); return q; },
      not: function (c, op, v) { st.filters.push(function (r) { return (r[c] == null ? null : r[c]) !== v; }); return q; },
      or: function (expr) { var m = /^bitis_tarihi\.is\.null,bitis_tarihi\.gt\.(.+)$/.exec(expr); if (!m) throw new Error('sahte or() desteklemiyor: ' + expr); st.filters.push(function (r) { return !r.bitis_tarihi || r.bitis_tarihi > m[1]; }); return q; },
      neq: function (c, v) { st.filters.push(function (r) { return r[c] !== v; }); return q; },
      in: function (c, a) { st.filters.push(function (r) { return a.indexOf(r[c]) > -1; }); return q; },
      order: function (c, o) { st.order = (st.order || []).concat([[c, o && o.ascending === false ? -1 : 1]]); return q; },
      range: function (a, b) { st.range = [a, b]; return q; }, limit: function (n) { st.limit = n; return q; },
      single: function () { st.single = true; return q; }, maybeSingle: function () { st.maybe = true; return q; },
      then: function (a, b) { return run(st).then(a, b); }
    };
    return q;
  }
  function sess() { return db.session ? { access_token: 'fake-token', user: { id: db.session.id, email: db.session.email } } : null; }
  // siteden çekme servisi ve görsel deposu için sahte yanıtlar
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, o) {
    if (String(url).indexOf('/functions/v1/link-onizleme') > -1) {
      var body = JSON.parse(o.body || '{}'), bad = /yok\.example/.test(body.url);
      var js = bad ? { error: 'Sayfa alınamadı (404)' } : { title: 'Örnek haber: Eczacılara yeni düzenleme', description: 'Kaynak sitenin özeti burada görünür. Bu bir test yanıtıdır.', image: 'https://gitahmetcelik.github.io/eczacidirenisi-site/assets/logo.jpg', site: 'ornek-haber.com', url: body.url, published: '2026-11-20T09:00:00Z' };
      return Promise.resolve(new Response(JSON.stringify(js), { status: bad ? 502 : 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(url, o);
  };
  window.supabase = { createClient: function () { return {
    from: Q,
    rpc: function (ad, arg) {
      var u = me();
      if (ad === 'reklam_say') { var s = db.reklam_sayac.find(function (x) { return x.reklam_id === arg.p_id; }); if (!s) { s = { reklam_id: arg.p_id, gosterim: 0, tiklama: 0 }; db.reklam_sayac.push(s); } s[arg.p_tur]++; save(); return Promise.resolve({ data: null, error: null }); }
      if (ad === 'ilan_yenile') { var l = db.ilanlar.find(function (x) { return u && x.id === arg.p_id && x.author_id === u.id && x.durum === 'yayinda' && (!x.bitis_tarihi || new Date(x.bitis_tarihi) < Date.now() + 10 * 86400000); }); if (!l) return Promise.resolve(err('ilan_uzatilamaz')); l.bitis_tarihi = new Date(Date.now() + 60 * 86400000).toISOString(); save(); return Promise.resolve({ data: l.bitis_tarihi, error: null }); }
      if (ad === 'hesabimi_sil') { if (!u) return Promise.resolve(err('oturum_yok')); if (isAdmin()) return Promise.resolve(err('yonetici_silinemez'));
        db.users = db.users.filter(function (x) { return x.id !== u.id; }); db.profiles = db.profiles.filter(function (x) { return x.id !== u.id; }); db.posts = db.posts.filter(function (x) { return x.author_id !== u.id; }); db.ilanlar = db.ilanlar.filter(function (x) { return x.author_id !== u.id; }); db.session = null; save(); return Promise.resolve({ data: null, error: null }); }
      return Promise.resolve(err('rpc yok: ' + ad));
    },
    storage: { from: function (b) { return {
      upload: function (path, blob) { if (!isAdmin()) return Promise.resolve(err('new row violates row-level security policy')); db.uploads = (db.uploads || []).concat([{ path: path, size: blob.size, type: blob.type }]); save(); return Promise.resolve({ data: { path: path }, error: null }); },
      getPublicUrl: function (path) { return { data: { publicUrl: 'https://gitahmetcelik.github.io/eczacidirenisi-site/assets/logo.jpg?u=' + encodeURIComponent(path) } }; } }; } },
    auth: {
      getSession: function () { return Promise.resolve({ data: { session: sess() } }); },
      signInWithPassword: function (o) { var u = db.users.find(function (x) { return x.email === o.email && x.password === o.password; });
        if (!u) return Promise.resolve(err('Invalid login credentials')); if (!u.confirmed) return Promise.resolve(err('Email not confirmed'));
        db.session = { id: u.id, email: u.email }; save(); return Promise.resolve({ data: { session: sess() }, error: null }); },
      signUp: function (o) { if (db.users.some(function (x) { return x.email === o.email; })) return Promise.resolve(err('User already registered'));
        var id = 'u' + (db.seq++); var u = { id: id, email: o.email, password: o.password, confirmed: !!db.autoConfirm };
        db.users.push(u); db.profiles.push({ id: id, username: o.options.data.username, is_admin: false });
        if (db.autoConfirm) db.session = { id: id, email: o.email }; save();
        return Promise.resolve({ data: { session: db.autoConfirm ? sess() : null }, error: null }); },
      signOut: function () { db.session = null; save(); return Promise.resolve({ error: null }); },
      resetPasswordForEmail: function () { return Promise.resolve({ error: null }); },
      updateUser: function () { return Promise.resolve({ error: null }); },
      onAuthStateChange: function (cb) { cbs.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; }
    }
  }; } };
  window.__fakedb = { get: function () { return db; }, save: save, reset: function () { localStorage.removeItem(KEY); }, fire: function (ev) { cbs.forEach(function (c) { c(ev); }); } };
})();
