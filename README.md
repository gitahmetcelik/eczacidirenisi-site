# Eczacı Direnişi sitesi

Eczacılara yönelik topluluk sitesi: gündem, köşe yazıları, akış, iş ve devir ilanları, yönetim paneli ve reklam alanları. Arayüz Türkçedir. Bu, örnek bir çalışmadır; resmî site değildir.

## 1 dakikada dene (veritabanı gerekmez)

[Node.js](https://nodejs.org) 18 ya da üstü yeterli. Kurulacak paket yok.

```bash
npm run demo
```

Tarayıcıda `http://localhost:4322` adresini aç.

| Demo hesabı | E-posta | Şifre |
|---|---|---|
| Yönetici | `yonetici@ornek.test` | `demo-parola-123` |
| Üye | `uye@ornek.test` | `demo-parola-123` |

Demo, gerçek veritabanı yerine tarayıcıda çalışan sahte bir taklit kullanır. Yazdıkların yalnızca kendi tarayıcında kalır. Sıfırlamak için tarayıcı konsolunda `__fakedb.reset()` yazıp sayfayı yenile. Taklit, gerçek erişim kurallarını birebir uygulamaz.

> **Dikkat:** `npm start` ise `assets/config.js` içindeki **gerçek** Supabase projesine bağlanır. Orada yazdıkların gerçek veritabanına gider. Denemek için `npm run demo` kullan.

## Nasıl çalışıyor?

```
build.mjs ──► docs/   (boş sayfa kabukları, GitHub Pages bunu yayınlar)
                 │
   tarayıcıda assets/*.js ──► Supabase (üyelik, veritabanı, görsel deposu)
```

- Sayfalar `build.mjs` ile üretilir; framework ve bağımlılık yoktur.
- İçerik tarayıcıda Supabase'den çekilir.
- Güvenlik tarayıcıda değil, veritabanındaki satır düzeyi erişim kurallarındadır (RLS).

## Klasörler

| Yol | İçerik |
|---|---|
| `build.mjs` | Tüm sayfaların şablonu ve metinleri |
| `style.css` | Tasarım; açık ve koyu tema renkleri en üstte |
| `assets/app.js` | Üyelik, akış, yorum, ilan, bildirim, hesap |
| `assets/icerik.js` | Haber ve yazılar, konular, içerik editörü |
| `assets/reklam.js` | Reklam alanları, reklam yönetimi, AdSense |
| `assets/config.js` | Supabase adresi ve herkese açık (publishable) anahtar |
| `site.json` | Bölüm anahtarları ve yasal sayfalardaki işletmeci bilgileri |
| `lists.json` | Şehir, pozisyon ve ücret listeleri |
| `ads.json` | Google AdSense ayarı (boşsa kapalı) |
| `eski-adresler.json` | Eski yazı adreslerinin yönlendirme listesi |
| `supabase/` | Veritabanı kurulumu, geçiş dosyası, sunucu işlevi |
| `tools/demo/` | Veritabanısız demo |
| `serve.mjs` | `docs/` için yerel sunucu |
| `docs/` | **Üretilen çıktı. Elle düzenleme**; `npm run build` ile yeniden oluşur |

## Geliştirme

1. Kaynak dosyayı düzenle (`docs/` içindekini değil).
2. `npm run demo` ile dene.
3. Üretilen `docs/` değişikliklerini kaynakla birlikte commit'le.

Not: `lists.json` ve ilan seçenekleri veritabanı kısıtlamalarında da yazılıdır. Birini değiştirirsen `supabase/` tarafını da güncelle.

## Kendi Supabase projenle kurmak

1. [supabase.com](https://supabase.com) üzerinde proje aç.
2. SQL Editor'de `supabase/schema.sql` dosyasını çalıştır. **Dikkat:** bu dosya var olan tabloları siler; yalnızca boş projede kullan.
3. İstersen örnek içerik için `supabase/seed-yazilar.sql` dosyasını çalıştır.
4. `assets/config.js` içine kendi proje adresini ve **publishable** anahtarını yaz. `sb_secret_...` anahtarını depoya asla koyma.
5. Authentication ayarlarında site adresini ekle ve kendi SMTP servisini bağla (hazır e-posta servisi çok kısıtlıdır).
6. Sitede üye ol, sonra kendini yönetici yap:
   ```sql
   update public.profiles set is_admin = true where username = 'KULLANICI_ADIN';
   ```
7. "Siteden çek" özelliği için `supabase/functions/link-onizleme` işlevini yayınla. İşlev yöneticiyi kendisi doğrular; "Verify JWT" ayarı kapalıdır.

**Var olan veritabanını güncellemek:** `schema.sql` yerine yalnızca `supabase/gecis-02.sql` dosyasını bir kez çalıştır.

## Yayın

GitHub Pages, `main` dalındaki `docs/` klasörünü yayınlar: **`main` dalına gönderilen her şey canlıya çıkar.** Yeni işleri ayrı dalda yap. Farklı bir adreste yayınlayacaksan `build.mjs` içindeki `SITE_URL` değerini değiştir.

## Şu anki durum

- Reklam sistemi, ilan süresi, sebepli bildirim, köşe yazıları, hesap sayfası ve yasal sayfalar yalnızca demo ile denendi.
- `supabase/gecis-02.sql` henüz gerçek bir veritabanında **çalıştırılmadı**. Canlıya almadan önce çalıştırılıp sınanmalı.
- Yasal sayfalar **taslaktır**. Sarı işaretli alanlar doldurulmalı ve metinler hukukçuya okutulmalı.
- İlan yayını ve üyeli paylaşım alanı için yayından önce hukuki değerlendirme gerekiyor. Gerekirse `site.json` ile kapatılabilir.
- Otomatik test yoktur.
