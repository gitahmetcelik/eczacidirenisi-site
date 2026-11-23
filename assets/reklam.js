/* Google AdSense hazır alt yapısı: yan kenarlar ve içerik içi alanlar.
   Yayıncı kimliği (ads.json → "client") yoksa hiçbir şey yapmaz: reklam da, çerez bildirimi de eklenmez.
   Reklam çerezleri için kullanıcıdan izin alınır (KVKK). Yerleşimi görmek için adresin sonuna ?reklam=onizle ekle. */
(function () {
  'use strict';
  var A = window.ED_ADS || {}, root = document.documentElement, KEY = 'ed-cerez';
  var slots = [].slice.call(document.querySelectorAll('.ad-slot'));

  if (/[?&]reklam=onizle\b/.test(location.search)) {
    root.classList.add('ads-preview');
    slots.forEach(function (s) {
      s.textContent = 'Reklam alanı · ' + ({ sol: 'sol kenar', sag: 'sağ kenar', icerik: 'içerik içi' }[s.getAttribute('data-slot')] || '');
    });
    return;
  }

  var client = A.client || '';
  if (!/^ca-pub-\d{10,20}$/.test(client)) return;            // yapılandırılmamış: hiçbir şey yapma

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* tarayıcı depolaması kapalı */ } }

  function yukle() {
    if (document.getElementById('adsense-js')) return;
    var s = document.createElement('script');
    s.id = 'adsense-js'; s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    document.head.appendChild(s);
    var any = false;
    slots.forEach(function (el) {
      var id = (A.slots || {})[el.getAttribute('data-slot')];
      if (!/^\d{6,20}$/.test(id || '')) { el.remove(); return; }   // reklam birimi numarası girilmemiş konum boş kalır
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle'; ins.style.display = 'block';
      ins.setAttribute('data-ad-client', client); ins.setAttribute('data-ad-slot', id);
      if (el.closest('.rail')) { ins.style.width = '100%'; ins.style.minHeight = '600px'; ins.setAttribute('data-ad-format', 'vertical'); }
      else { ins.setAttribute('data-ad-format', 'auto'); ins.setAttribute('data-full-width-responsive', 'true'); }
      el.appendChild(ins); any = true;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* reklam betiği engellenmiş olabilir */ }
    });
    if (any) root.classList.add('ads-on');
  }

  function bildirim() {
    var b = document.createElement('div');
    b.className = 'cerez'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Çerez tercihleri');
    b.innerHTML = '<div class="wrap"><p>Bu site, reklam göstermek için Google AdSense kullanabilir. Reklam çerezlerine izin verirsen Google ve ortakları tarayıcında çerez kullanabilir. ' +
      'Reddedersen reklam gösterilmez ve reklam çerezi kullanılmaz. Ayrıntılar için <a href="' + (root.getAttribute('data-base') || './') + 'gizlilik.html">gizlilik sayfasına</a> bak.</p>' +
      '<div class="btns"><button class="btn" type="button" data-k="evet">Kabul et</button><button class="btn ghost" type="button" data-k="hayir">Reddet</button></div></div>';
    b.addEventListener('click', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!k) return;
      var yukluydu = !!document.getElementById('adsense-js');
      set(k); b.remove();
      if (k === 'evet') yukle(); else if (yukluydu) location.reload();   // izin geri alındıysa yüklenmiş reklamları temizle
    });
    document.body.appendChild(b);
  }

  var ac = document.getElementById('cerez-ac'), ay = document.getElementById('cerez-ayrac');
  if (ac) {
    ac.hidden = false; if (ay) ay.hidden = false;
    ac.addEventListener('click', function () { try { localStorage.removeItem(KEY); } catch (e) { /* yok say */ } if (!document.querySelector('.cerez')) bildirim(); });
  }
  var t = get();
  if (t === 'evet') yukle(); else if (t !== 'hayir') bildirim();
})();
