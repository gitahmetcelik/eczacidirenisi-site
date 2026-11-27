-- Eczacı Direnişi: üyelik, akış, yorum ve ilan sistemi
-- Supabase panelinde SQL Editor'a yapıştırıp bir kez çalıştırın. Baştan çalıştırmak güvenlidir (idempotent değildir: tabloları siler).
-- UYARI: Aşağıdaki "drop" satırları var olan tabloları siler. Canlı veri varsa çalıştırmayın.

drop table if exists public.reklam_sayac cascade;
drop table if exists public.reklamlar cascade;
drop function if exists public.reklam_say(bigint, text) cascade;
drop function if exists public.hesabimi_sil() cascade;
drop function if exists public.ilan_yenile(bigint) cascade;
drop function if exists public.ilan_sure_baslat() cascade;
drop function if exists public.ilan_sure_sifirla() cascade;
drop table if exists public.ilce_listesi cascade;
drop function if exists public.ilce_kontrol() cascade;
drop function if exists public.ilan_kaldirma_tarihi() cascade;
drop table if exists public.konular cascade;
drop table if exists public.yazilar cascade;
drop function if exists public.set_updated_at() cascade;
drop table if exists public.paylasimlar cascade;
drop table if exists public.reports cascade;
drop table if exists public.likes cascade;
drop table if exists public.posts cascade;
drop table if exists public.ilan_iletisim cascade;
drop table if exists public.ilanlar cascade;
drop table if exists public.profiles cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.hiz_siniri() cascade;

-- ---------- Profiller ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]{3,20}$'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Yönetici olup olmadığını RLS'e takılmadan kontrol eder
create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Kayıt olunca profili otomatik oluşturur (kullanıcı adı kayıt formundan gelir)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username) values (new.id, new.raw_user_meta_data->>'username');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy "profiller herkese açık" on public.profiles for select using (true);
create policy "kendi kullanıcı adını değiştir" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
-- is_admin hiçbir şekilde istemciden değiştirilemez; yalnızca username güncellenebilir
revoke insert, update on public.profiles from anon, authenticated;
grant update (username) on public.profiles to authenticated;

-- ---------- Gönderiler (akış, yanıt ve yazı yorumları) ----------
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  parent_id bigint references public.posts(id) on delete cascade,   -- doluysa yanıt
  ref text check (char_length(ref) <= 40),                          -- doluysa bir yazının yorumu (yazı kodu)
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_parent_idx on public.posts (parent_id);
create index posts_ref_idx on public.posts (ref);

-- Hız sınırı: aynı kullanıcı dakikada en fazla 6 gönderi
create function public.hiz_siniri() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'posts' then
    if (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '1 minute') >= 6 then
      raise exception 'hiz_siniri';
    end if;
  elsif tg_table_name = 'ilanlar' then
    if (select count(*) from public.ilanlar where author_id = new.author_id and created_at > now() - interval '1 day') >= 3 then
      raise exception 'hiz_siniri';
    end if;
  end if;
  return new;
end $$;
create trigger posts_hiz before insert on public.posts for each row execute function public.hiz_siniri();

alter table public.posts enable row level security;
create policy "gönderiler herkese açık" on public.posts for select using (true);
create policy "üye gönderi yazar" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "kendi gönderini ya da yönetici siler" on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());
revoke update on public.posts from anon, authenticated;

-- ---------- Beğeniler ----------
create table public.likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
create policy "beğeniler herkese açık" on public.likes for select using (true);
create policy "üye beğenir" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "üye beğeniyi geri alır" on public.likes for delete to authenticated using (user_id = auth.uid());

-- ---------- Bildirimler (şikâyet) ----------
create table public.reports (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
alter table public.reports enable row level security;
create policy "üye bildirir" on public.reports for insert to authenticated with check (user_id = auth.uid());
create policy "yönetici bildirimleri görür" on public.reports for select to authenticated using (public.is_admin());
create policy "yönetici bildirimi kapatır" on public.reports for delete to authenticated using (public.is_admin());

-- ---------- İlanlar ----------
create table public.ilanlar (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  tur text not null check (tur in ('is', 'devir')),
  baslik text not null check (char_length(btrim(baslik)) between 3 and 120),
  sehir text not null check (char_length(btrim(sehir)) between 2 and 40),
  ilce text check (char_length(ilce) <= 40),
  pozisyon text check (char_length(pozisyon) <= 80),
  ucret text check (char_length(ucret) <= 60),
  aciklama text check (char_length(aciklama) <= 1200),
  durum text not null default 'beklemede' check (durum in ('beklemede', 'yayinda', 'reddedildi')),
  created_at timestamptz not null default now()
);
create index ilanlar_tur_idx on public.ilanlar (tur, durum, created_at desc);
create trigger ilanlar_hiz before insert on public.ilanlar for each row execute function public.hiz_siniri();

alter table public.ilanlar enable row level security;
create policy "yayındaki ilanlar herkese açık" on public.ilanlar for select
  using (durum = 'yayinda' or author_id = auth.uid() or public.is_admin());
create policy "üye ilan verir (onaya düşer)" on public.ilanlar for insert to authenticated
  with check (author_id = auth.uid() and durum = 'beklemede');
create policy "yönetici ilan durumunu değiştirir" on public.ilanlar for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "kendi ilanını ya da yönetici siler" on public.ilanlar for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());
revoke update on public.ilanlar from anon, authenticated;
grant update (durum) on public.ilanlar to authenticated;

-- İletişim bilgisi ayrı tutulur: yalnızca giriş yapmış üyeler görür
create table public.ilan_iletisim (
  ilan_id bigint primary key references public.ilanlar(id) on delete cascade,
  iletisim text not null check (char_length(btrim(iletisim)) between 3 and 120)
);
alter table public.ilan_iletisim enable row level security;
create policy "üyeler iletişimi görür" on public.ilan_iletisim for select to authenticated
  using (exists (select 1 from public.ilanlar i where i.id = ilan_id));
create policy "ilan sahibi iletişim ekler" on public.ilan_iletisim for insert to authenticated
  with check (exists (select 1 from public.ilanlar i where i.id = ilan_id and i.author_id = auth.uid()));

-- ---------- API erişimi (açık yetkiler) ----------
-- Proje "Grant API access to new tables automatically" kapalı kurulduysa tablolar API'ye bu yetkiler olmadan görünmez.
-- Satır düzeyindeki asıl koruma yukarıdaki RLS politikalarıdır; buradakiler yalnızca tablo/sütun yetkisidir.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.likes, public.ilanlar to anon, authenticated;
-- ziyaretçi (anon) de tabloyu sorgulayabilir ama RLS yüzünden hiçbir satır göremez (iletişim yalnızca üyelere açık)
grant select on public.ilan_iletisim to anon, authenticated;
grant insert, delete on public.posts, public.ilanlar to authenticated;
grant insert, delete on public.likes to authenticated;
grant select, insert, delete on public.reports to authenticated;
grant insert on public.ilan_iletisim to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- (profiles.username ve ilanlar.durum için sütun yetkileri yukarıda verildi)

-- ---------- Serbest metin engeli: şehir, pozisyon ve ücret yalnızca listeden seçilebilir ----------
-- Liste değişirse lists.json ile BİRLİKTE güncellenmelidir. (Var olan bir veritabanına eklerken satırların sonuna "not valid" ekleyin.)
alter table public.ilanlar add constraint ilanlar_sehir_liste check (sehir in ('Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'));
alter table public.ilanlar add constraint ilanlar_pozisyon_liste check (pozisyon is null or pozisyon in ('Eczacı', 'Sorumlu eczacı', 'Yardımcı eczacı', 'Eczane teknisyeni / kalfa', 'Stajyer', 'Diğer'));
alter table public.ilanlar add constraint ilanlar_ucret_liste check (ucret is null or ucret in ('Görüşülür', 'Asgari ücret', '30.000 – 40.000 TL', '40.000 – 50.000 TL', '50.000 – 60.000 TL', '60.000 TL ve üzeri'));


-- ---------- Ana sayfa paylaşımları (Instagram bağlantısı; yalnızca yönetici ekler) ----------
create table public.paylasimlar (
  id bigint generated always as identity primary key,
  tur text not null default 'p' check (tur in ('p', 'reel', 'tv')),
  kod text not null unique check (kod ~ '^[A-Za-z0-9_-]{5,20}$'),
  baslik text check (char_length(baslik) <= 160),
  ekleyen uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.paylasimlar enable row level security;
create policy "paylaşımlar herkese açık" on public.paylasimlar for select using (true);
create policy "yönetici paylaşım ekler" on public.paylasimlar for insert to authenticated with check (public.is_admin());
create policy "yönetici paylaşım siler" on public.paylasimlar for delete to authenticated using (public.is_admin());
revoke update on public.paylasimlar from anon, authenticated;
grant select on public.paylasimlar to anon, authenticated;
grant insert, delete on public.paylasimlar to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- Yazılar: haber, özel yazı, siteden çekilen bağlantı ve Instagram'dan içe aktarılan paylaşımlar ----------
create function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.yazilar (
  id bigint generated always as identity primary key,
  tur text not null default 'yazi' check (tur in ('yazi', 'haber', 'baglanti', 'instagram')),
  kod text unique check (kod is null or kod ~ '^[A-Za-z0-9_-]{3,40}$'),
  baslik text not null check (char_length(btrim(baslik)) between 1 and 200),
  ozet text check (char_length(ozet) <= 500),
  govde text check (char_length(govde) <= 30000),
  gorsel_url text check (gorsel_url is null or (char_length(gorsel_url) <= 600 and gorsel_url ~ '^(https://|assets/)')),
  gorsel_alt text check (char_length(gorsel_alt) <= 200),
  gorsel_konum text not null default 'ust' check (gorsel_konum in ('ust', 'alt', 'sol', 'sag')),
  link_url text check (link_url is null or (char_length(link_url) <= 800 and link_url ~ '^https?://')),
  link_etiket text check (char_length(link_etiket) <= 60),
  link_dogrudan boolean not null default false,
  kaynak_site text check (char_length(kaynak_site) <= 80),
  temalar text[] not null default '{}',
  yayin_tarihi timestamptz not null default now(),
  yayinda boolean not null default true,
  gundemde boolean not null default true,
  one_cikan boolean not null default false,
  olusturan uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index yazilar_tarih_idx on public.yazilar (yayin_tarihi desc);
create index yazilar_gundem_idx on public.yazilar (yayinda, gundemde, yayin_tarihi desc);
create index yazilar_temalar_idx on public.yazilar using gin (temalar);
create trigger yazilar_updated before update on public.yazilar for each row execute function public.set_updated_at();

alter table public.yazilar enable row level security;
create policy "yayındaki yazılar herkese açık" on public.yazilar for select using (yayinda or public.is_admin());
create policy "yönetici yazı ekler" on public.yazilar for insert to authenticated with check (public.is_admin());
create policy "yönetici yazı günceller" on public.yazilar for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "yönetici yazı siler" on public.yazilar for delete to authenticated using (public.is_admin());
grant select on public.yazilar to anon, authenticated;
grant insert, update, delete on public.yazilar to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Görseller (Storage): herkese açık okuma, yalnızca yönetici yükler/siler; 5 MB, yalnızca JPEG/PNG/WebP
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gorseller', 'gorseller', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "gorseller yönetici yükler" on storage.objects;
drop policy if exists "gorseller yönetici günceller" on storage.objects;
drop policy if exists "gorseller yönetici siler" on storage.objects;
create policy "gorseller yönetici yükler" on storage.objects for insert to authenticated with check (bucket_id = 'gorseller' and public.is_admin());
create policy "gorseller yönetici günceller" on storage.objects for update to authenticated using (bucket_id = 'gorseller' and public.is_admin());
create policy "gorseller yönetici siler" on storage.objects for delete to authenticated using (bucket_id = 'gorseller' and public.is_admin());

-- ---------- Konular (yönetimden eklenir/düzenlenir) ----------
create table public.konular (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  ad text not null check (char_length(btrim(ad)) between 2 and 80),
  aciklama text check (char_length(aciklama) <= 300),
  sira integer not null default 100,
  created_at timestamptz not null default now()
);
alter table public.konular enable row level security;
create policy "konular herkese açık" on public.konular for select using (true);
create policy "yönetici konu ekler" on public.konular for insert to authenticated with check (public.is_admin());
create policy "yönetici konu günceller" on public.konular for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "yönetici konu siler" on public.konular for delete to authenticated using (public.is_admin());
grant select on public.konular to anon, authenticated;
grant insert, update, delete on public.konular to authenticated;
grant usage, select on all sequences in schema public to authenticated;
insert into public.konular (slug, ad, aciklama, sira) values
 ('yok-tartismasi', $q$YÖK Başkanı tartışması$q$, $q$YÖK Başkanı Erol Özvar'ın açıklamalarına verilen tepkiler ve cevaplar.$q$, 10),
 ('gida-takviyesi', $q$Gıda takviyesi ve internet satışı$q$, $q$Kontrolsüz internet satışı, gıda takviyelerinin denetimi ve halk sağlığı.$q$, 20),
 ('cumartesi-kapansin', $q$Cumartesi kapanışı ve nöbet$q$, $q$#EczanelerCumartesiKapansın kampanyası ve çalışma düzeni tartışması.$q$, 30),
 ('atama-kadro', $q$Atama, kadro ve işsizlik$q$, $q$Eczacı ve diş hekimi atamaları, kadro sayıları, işsizlik.$q$, 40),
 ('oda-secimleri', $q$Oda, TEB ve seçimler$q$, $q$Eczacı odaları, Türk Eczacıları Birliği ve seçim süreçleri.$q$, 50),
 ('yeni-fakulteler', $q$Yeni eczacılık fakülteleri$q$, $q$Açılan yeni fakülteler, kontenjanlar ve mesleğin geleceği.$q$, 60),
 ('ucret-sgk', $q$Ücret, zam ve SGK$q$, $q$Çalışma koşulları, ücretler, sigortasız çalıştırma ve ilaç fiyatları.$q$, 70),
 ('vatan-gazi', $q$Gaziler ve vatan$q$, $q$Gazilerin hakları, şehitler ve vatansever mesajlar.$q$, 80)
on conflict (slug) do nothing;

-- ---------- İlçe listesi: il → ilçe eşleşmesi (973 ilçe) ve ilanda doğrulama ----------
create table public.ilce_listesi (il text not null, ilce text not null, primary key (il, ilce));
alter table public.ilce_listesi enable row level security;
create policy "ilçe listesi herkese açık" on public.ilce_listesi for select using (true);
grant select on public.ilce_listesi to anon, authenticated;
insert into public.ilce_listesi (il, ilce) select $q$Adana$q$, unnest(array[$q$Aladağ$q$, $q$Ceyhan$q$, $q$Çukurova$q$, $q$Feke$q$, $q$İmamoğlu$q$, $q$Karaisalı$q$, $q$Karataş$q$, $q$Kozan$q$, $q$Pozantı$q$, $q$Saimbeyli$q$, $q$Sarıçam$q$, $q$Seyhan$q$, $q$Tufanbeyli$q$, $q$Yumurtalık$q$, $q$Yüreğir$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Adıyaman$q$, unnest(array[$q$Besni$q$, $q$Çelikhan$q$, $q$Gerger$q$, $q$Gölbaşı$q$, $q$Kahta$q$, $q$Merkez$q$, $q$Samsat$q$, $q$Sincik$q$, $q$Tut$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Afyonkarahisar$q$, unnest(array[$q$Başmakçı$q$, $q$Bayat$q$, $q$Bolvadin$q$, $q$Çay$q$, $q$Çobanlar$q$, $q$Dazkırı$q$, $q$Dinar$q$, $q$Emirdağ$q$, $q$Evciler$q$, $q$Hocalar$q$, $q$İhsaniye$q$, $q$İscehisar$q$, $q$Kızılören$q$, $q$Merkez$q$, $q$Sandıklı$q$, $q$Sinanpaşa$q$, $q$Sultandağı$q$, $q$Şuhut$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Ağrı$q$, unnest(array[$q$Diyadin$q$, $q$Doğubayazıt$q$, $q$Eleşkirt$q$, $q$Hamur$q$, $q$Merkez$q$, $q$Patnos$q$, $q$Taşlıçay$q$, $q$Tutak$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Aksaray$q$, unnest(array[$q$Ağaçören$q$, $q$Eskil$q$, $q$Gülağaç$q$, $q$Güzelyurt$q$, $q$Merkez$q$, $q$Ortaköy$q$, $q$Sarıyahşi$q$, $q$Sultanhanı$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Amasya$q$, unnest(array[$q$Göynücek$q$, $q$Gümüşhacıköy$q$, $q$Hamamözü$q$, $q$Merkez$q$, $q$Merzifon$q$, $q$Suluova$q$, $q$Taşova$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Ankara$q$, unnest(array[$q$Akyurt$q$, $q$Altındağ$q$, $q$Ayaş$q$, $q$Bala$q$, $q$Beypazarı$q$, $q$Çamlıdere$q$, $q$Çankaya$q$, $q$Çubuk$q$, $q$Elmadağ$q$, $q$Etimesgut$q$, $q$Evren$q$, $q$Gölbaşı$q$, $q$Güdül$q$, $q$Haymana$q$, $q$Kahramankazan$q$, $q$Kalecik$q$, $q$Keçiören$q$, $q$Kızılcahamam$q$, $q$Mamak$q$, $q$Nallıhan$q$, $q$Polatlı$q$, $q$Pursaklar$q$, $q$Sincan$q$, $q$Şereflikoçhisar$q$, $q$Yenimahalle$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Antalya$q$, unnest(array[$q$Akseki$q$, $q$Aksu$q$, $q$Alanya$q$, $q$Demre$q$, $q$Döşemealtı$q$, $q$Elmalı$q$, $q$Finike$q$, $q$Gazipaşa$q$, $q$Gündoğmuş$q$, $q$İbradı$q$, $q$Kaş$q$, $q$Kemer$q$, $q$Kepez$q$, $q$Konyaaltı$q$, $q$Korkuteli$q$, $q$Kumluca$q$, $q$Manavgat$q$, $q$Muratpaşa$q$, $q$Serik$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Ardahan$q$, unnest(array[$q$Çıldır$q$, $q$Damal$q$, $q$Göle$q$, $q$Hanak$q$, $q$Merkez$q$, $q$Posof$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Artvin$q$, unnest(array[$q$Ardanuç$q$, $q$Arhavi$q$, $q$Borçka$q$, $q$Hopa$q$, $q$Kemalpaşa$q$, $q$Merkez$q$, $q$Murgul$q$, $q$Şavşat$q$, $q$Yusufeli$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Aydın$q$, unnest(array[$q$Bozdoğan$q$, $q$Buharkent$q$, $q$Çine$q$, $q$Didim$q$, $q$Efeler$q$, $q$Germencik$q$, $q$İncirliova$q$, $q$Karacasu$q$, $q$Karpuzlu$q$, $q$Koçarlı$q$, $q$Köşk$q$, $q$Kuşadası$q$, $q$Kuyucak$q$, $q$Nazilli$q$, $q$Söke$q$, $q$Sultanhisar$q$, $q$Yenipazar$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Balıkesir$q$, unnest(array[$q$Altıeylül$q$, $q$Ayvalık$q$, $q$Balya$q$, $q$Bandırma$q$, $q$Bigadiç$q$, $q$Burhaniye$q$, $q$Dursunbey$q$, $q$Edremit$q$, $q$Erdek$q$, $q$Gömeç$q$, $q$Gönen$q$, $q$Havran$q$, $q$İvrindi$q$, $q$Karesi$q$, $q$Kepsut$q$, $q$Manyas$q$, $q$Marmara$q$, $q$Savaştepe$q$, $q$Sındırgı$q$, $q$Susurluk$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bartın$q$, unnest(array[$q$Amasra$q$, $q$Kurucaşile$q$, $q$Merkez$q$, $q$Ulus$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Batman$q$, unnest(array[$q$Beşiri$q$, $q$Gercüş$q$, $q$Hasankeyf$q$, $q$Kozluk$q$, $q$Merkez$q$, $q$Sason$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bayburt$q$, unnest(array[$q$Aydıntepe$q$, $q$Demirözü$q$, $q$Merkez$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bilecik$q$, unnest(array[$q$Bozüyük$q$, $q$Gölpazarı$q$, $q$İnhisar$q$, $q$Merkez$q$, $q$Osmaneli$q$, $q$Pazaryeri$q$, $q$Söğüt$q$, $q$Yenipazar$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bingöl$q$, unnest(array[$q$Adaklı$q$, $q$Genç$q$, $q$Karlıova$q$, $q$Kiğı$q$, $q$Merkez$q$, $q$Solhan$q$, $q$Yayladere$q$, $q$Yedisu$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bitlis$q$, unnest(array[$q$Adilcevaz$q$, $q$Ahlat$q$, $q$Güroymak$q$, $q$Hizan$q$, $q$Merkez$q$, $q$Mutki$q$, $q$Tatvan$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bolu$q$, unnest(array[$q$Dörtdivan$q$, $q$Gerede$q$, $q$Göynük$q$, $q$Kıbrıscık$q$, $q$Mengen$q$, $q$Merkez$q$, $q$Mudurnu$q$, $q$Seben$q$, $q$Yeniçağa$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Burdur$q$, unnest(array[$q$Ağlasun$q$, $q$Altınyayla$q$, $q$Bucak$q$, $q$Çavdır$q$, $q$Çeltikçi$q$, $q$Gölhisar$q$, $q$Karamanlı$q$, $q$Kemer$q$, $q$Merkez$q$, $q$Tefenni$q$, $q$Yeşilova$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Bursa$q$, unnest(array[$q$Büyükorhan$q$, $q$Gemlik$q$, $q$Gürsu$q$, $q$Harmancık$q$, $q$İnegöl$q$, $q$İznik$q$, $q$Karacabey$q$, $q$Keles$q$, $q$Kestel$q$, $q$Mudanya$q$, $q$Mustafakemalpaşa$q$, $q$Nilüfer$q$, $q$Orhaneli$q$, $q$Orhangazi$q$, $q$Osmangazi$q$, $q$Yenişehir$q$, $q$Yıldırım$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Çanakkale$q$, unnest(array[$q$Ayvacık$q$, $q$Bayramiç$q$, $q$Biga$q$, $q$Bozcaada$q$, $q$Çan$q$, $q$Eceabat$q$, $q$Ezine$q$, $q$Gelibolu$q$, $q$Gökçeada$q$, $q$Lapseki$q$, $q$Merkez$q$, $q$Yenice$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Çankırı$q$, unnest(array[$q$Atkaracalar$q$, $q$Bayramören$q$, $q$Çerkeş$q$, $q$Eldivan$q$, $q$Ilgaz$q$, $q$Kızılırmak$q$, $q$Korgun$q$, $q$Kurşunlu$q$, $q$Merkez$q$, $q$Orta$q$, $q$Şabanözü$q$, $q$Yapraklı$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Çorum$q$, unnest(array[$q$Alaca$q$, $q$Bayat$q$, $q$Boğazkale$q$, $q$Dodurga$q$, $q$İskilip$q$, $q$Kargı$q$, $q$Laçin$q$, $q$Mecitözü$q$, $q$Merkez$q$, $q$Oğuzlar$q$, $q$Ortaköy$q$, $q$Osmancık$q$, $q$Sungurlu$q$, $q$Uğurludağ$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Denizli$q$, unnest(array[$q$Acıpayam$q$, $q$Babadağ$q$, $q$Baklan$q$, $q$Bekilli$q$, $q$Beyağaç$q$, $q$Bozkurt$q$, $q$Buldan$q$, $q$Çal$q$, $q$Çameli$q$, $q$Çardak$q$, $q$Çivril$q$, $q$Güney$q$, $q$Honaz$q$, $q$Kale$q$, $q$Merkezefendi$q$, $q$Pamukkale$q$, $q$Sarayköy$q$, $q$Serinhisar$q$, $q$Tavas$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Diyarbakır$q$, unnest(array[$q$Bağlar$q$, $q$Bismil$q$, $q$Çermik$q$, $q$Çınar$q$, $q$Çüngüş$q$, $q$Dicle$q$, $q$Eğil$q$, $q$Ergani$q$, $q$Hani$q$, $q$Hazro$q$, $q$Kayapınar$q$, $q$Kocaköy$q$, $q$Kulp$q$, $q$Lice$q$, $q$Silvan$q$, $q$Sur$q$, $q$Yenişehir$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Düzce$q$, unnest(array[$q$Akçakoca$q$, $q$Cumayeri$q$, $q$Çilimli$q$, $q$Gölyaka$q$, $q$Gümüşova$q$, $q$Kaynaşlı$q$, $q$Merkez$q$, $q$Yığılca$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Edirne$q$, unnest(array[$q$Enez$q$, $q$Havsa$q$, $q$İpsala$q$, $q$Keşan$q$, $q$Lalapaşa$q$, $q$Meriç$q$, $q$Merkez$q$, $q$Süloğlu$q$, $q$Uzunköprü$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Elazığ$q$, unnest(array[$q$Ağın$q$, $q$Alacakaya$q$, $q$Arıcak$q$, $q$Baskil$q$, $q$Karakoçan$q$, $q$Keban$q$, $q$Kovancılar$q$, $q$Maden$q$, $q$Merkez$q$, $q$Palu$q$, $q$Sivrice$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Erzincan$q$, unnest(array[$q$Çayırlı$q$, $q$İliç$q$, $q$Kemah$q$, $q$Kemaliye$q$, $q$Merkez$q$, $q$Otlukbeli$q$, $q$Refahiye$q$, $q$Tercan$q$, $q$Üzümlü$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Erzurum$q$, unnest(array[$q$Aşkale$q$, $q$Aziziye$q$, $q$Çat$q$, $q$Hınıs$q$, $q$Horasan$q$, $q$İspir$q$, $q$Karaçoban$q$, $q$Karayazı$q$, $q$Köprüköy$q$, $q$Narman$q$, $q$Oltu$q$, $q$Olur$q$, $q$Palandöken$q$, $q$Pasinler$q$, $q$Pazaryolu$q$, $q$Şenkaya$q$, $q$Tekman$q$, $q$Tortum$q$, $q$Uzundere$q$, $q$Yakutiye$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Eskişehir$q$, unnest(array[$q$Alpu$q$, $q$Beylikova$q$, $q$Çifteler$q$, $q$Günyüzü$q$, $q$Han$q$, $q$İnönü$q$, $q$Mahmudiye$q$, $q$Mihalgazi$q$, $q$Mihalıççık$q$, $q$Odunpazarı$q$, $q$Sarıcakaya$q$, $q$Seyitgazi$q$, $q$Sivrihisar$q$, $q$Tepebaşı$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Gaziantep$q$, unnest(array[$q$Araban$q$, $q$İslahiye$q$, $q$Karkamış$q$, $q$Nizip$q$, $q$Nurdağı$q$, $q$Oğuzeli$q$, $q$Şahinbey$q$, $q$Şehitkamil$q$, $q$Yavuzeli$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Giresun$q$, unnest(array[$q$Alucra$q$, $q$Bulancak$q$, $q$Çamoluk$q$, $q$Çanakçı$q$, $q$Dereli$q$, $q$Doğankent$q$, $q$Espiye$q$, $q$Eynesil$q$, $q$Görele$q$, $q$Güce$q$, $q$Keşap$q$, $q$Merkez$q$, $q$Piraziz$q$, $q$Şebinkarahisar$q$, $q$Tirebolu$q$, $q$Yağlıdere$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Gümüşhane$q$, unnest(array[$q$Kelkit$q$, $q$Köse$q$, $q$Kürtün$q$, $q$Merkez$q$, $q$Şiran$q$, $q$Torul$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Hakkâri$q$, unnest(array[$q$Çukurca$q$, $q$Derecik$q$, $q$Merkez$q$, $q$Şemdinli$q$, $q$Yüksekova$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Hatay$q$, unnest(array[$q$Altınözü$q$, $q$Antakya$q$, $q$Arsuz$q$, $q$Belen$q$, $q$Defne$q$, $q$Dörtyol$q$, $q$Erzin$q$, $q$Hassa$q$, $q$İskenderun$q$, $q$Kırıkhan$q$, $q$Kumlu$q$, $q$Payas$q$, $q$Reyhanlı$q$, $q$Samandağ$q$, $q$Yayladağı$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Iğdır$q$, unnest(array[$q$Aralık$q$, $q$Karakoyunlu$q$, $q$Merkez$q$, $q$Tuzluca$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Isparta$q$, unnest(array[$q$Aksu$q$, $q$Atabey$q$, $q$Eğirdir$q$, $q$Gelendost$q$, $q$Gönen$q$, $q$Keçiborlu$q$, $q$Merkez$q$, $q$Senirkent$q$, $q$Sütçüler$q$, $q$Şarkikaraağaç$q$, $q$Uluborlu$q$, $q$Yalvaç$q$, $q$Yenişarbademli$q$]);
insert into public.ilce_listesi (il, ilce) select $q$İstanbul$q$, unnest(array[$q$Adalar$q$, $q$Arnavutköy$q$, $q$Ataşehir$q$, $q$Avcılar$q$, $q$Bağcılar$q$, $q$Bahçelievler$q$, $q$Bakırköy$q$, $q$Başakşehir$q$, $q$Bayrampaşa$q$, $q$Beşiktaş$q$, $q$Beykoz$q$, $q$Beylikdüzü$q$, $q$Beyoğlu$q$, $q$Büyükçekmece$q$, $q$Çatalca$q$, $q$Çekmeköy$q$, $q$Esenler$q$, $q$Esenyurt$q$, $q$Eyüpsultan$q$, $q$Fatih$q$, $q$Gaziosmanpaşa$q$, $q$Güngören$q$, $q$Kadıköy$q$, $q$Kağıthane$q$, $q$Kartal$q$, $q$Küçükçekmece$q$, $q$Maltepe$q$, $q$Pendik$q$, $q$Sancaktepe$q$, $q$Sarıyer$q$, $q$Silivri$q$, $q$Sultanbeyli$q$, $q$Sultangazi$q$, $q$Şile$q$, $q$Şişli$q$, $q$Tuzla$q$, $q$Ümraniye$q$, $q$Üsküdar$q$, $q$Zeytinburnu$q$]);
insert into public.ilce_listesi (il, ilce) select $q$İzmir$q$, unnest(array[$q$Aliağa$q$, $q$Balçova$q$, $q$Bayındır$q$, $q$Bayraklı$q$, $q$Bergama$q$, $q$Beydağ$q$, $q$Bornova$q$, $q$Buca$q$, $q$Çeşme$q$, $q$Çiğli$q$, $q$Dikili$q$, $q$Foça$q$, $q$Gaziemir$q$, $q$Güzelbahçe$q$, $q$Karabağlar$q$, $q$Karaburun$q$, $q$Karşıyaka$q$, $q$Kemalpaşa$q$, $q$Kınık$q$, $q$Kiraz$q$, $q$Konak$q$, $q$Menderes$q$, $q$Menemen$q$, $q$Narlıdere$q$, $q$Ödemiş$q$, $q$Seferihisar$q$, $q$Selçuk$q$, $q$Tire$q$, $q$Torbalı$q$, $q$Urla$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kahramanmaraş$q$, unnest(array[$q$Afşin$q$, $q$Andırın$q$, $q$Çağlayancerit$q$, $q$Dulkadiroğlu$q$, $q$Ekinözü$q$, $q$Elbistan$q$, $q$Göksun$q$, $q$Nurhak$q$, $q$Onikişubat$q$, $q$Pazarcık$q$, $q$Türkoğlu$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Karabük$q$, unnest(array[$q$Eflani$q$, $q$Eskipazar$q$, $q$Merkez$q$, $q$Ovacık$q$, $q$Safranbolu$q$, $q$Yenice$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Karaman$q$, unnest(array[$q$Ayrancı$q$, $q$Başyayla$q$, $q$Ermenek$q$, $q$Kazımkarabekir$q$, $q$Merkez$q$, $q$Sarıveliler$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kars$q$, unnest(array[$q$Akyaka$q$, $q$Arpaçay$q$, $q$Digor$q$, $q$Kağızman$q$, $q$Merkez$q$, $q$Sarıkamış$q$, $q$Selim$q$, $q$Susuz$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kastamonu$q$, unnest(array[$q$Abana$q$, $q$Ağlı$q$, $q$Araç$q$, $q$Azdavay$q$, $q$Bozkurt$q$, $q$Cide$q$, $q$Çatalzeytin$q$, $q$Daday$q$, $q$Devrekani$q$, $q$Doğanyurt$q$, $q$Hanönü$q$, $q$İhsangazi$q$, $q$İnebolu$q$, $q$Küre$q$, $q$Merkez$q$, $q$Pınarbaşı$q$, $q$Seydiler$q$, $q$Şenpazar$q$, $q$Taşköprü$q$, $q$Tosya$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kayseri$q$, unnest(array[$q$Akkışla$q$, $q$Bünyan$q$, $q$Develi$q$, $q$Felahiye$q$, $q$Hacılar$q$, $q$İncesu$q$, $q$Kocasinan$q$, $q$Melikgazi$q$, $q$Özvatan$q$, $q$Pınarbaşı$q$, $q$Sarıoğlan$q$, $q$Sarız$q$, $q$Talas$q$, $q$Tomarza$q$, $q$Yahyalı$q$, $q$Yeşilhisar$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kırıkkale$q$, unnest(array[$q$Bahşili$q$, $q$Balışeyh$q$, $q$Çelebi$q$, $q$Delice$q$, $q$Karakeçili$q$, $q$Keskin$q$, $q$Merkez$q$, $q$Sulakyurt$q$, $q$Yahşihan$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kırklareli$q$, unnest(array[$q$Babaeski$q$, $q$Demirköy$q$, $q$Kofçaz$q$, $q$Lüleburgaz$q$, $q$Merkez$q$, $q$Pehlivanköy$q$, $q$Pınarhisar$q$, $q$Vize$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kırşehir$q$, unnest(array[$q$Akçakent$q$, $q$Akpınar$q$, $q$Boztepe$q$, $q$Çiçekdağı$q$, $q$Kaman$q$, $q$Merkez$q$, $q$Mucur$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kilis$q$, unnest(array[$q$Elbeyli$q$, $q$Merkez$q$, $q$Musabeyli$q$, $q$Polateli$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kocaeli$q$, unnest(array[$q$Başiskele$q$, $q$Çayırova$q$, $q$Darıca$q$, $q$Derince$q$, $q$Dilovası$q$, $q$Gebze$q$, $q$Gölcük$q$, $q$İzmit$q$, $q$Kandıra$q$, $q$Karamürsel$q$, $q$Kartepe$q$, $q$Körfez$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Konya$q$, unnest(array[$q$Ahırlı$q$, $q$Akören$q$, $q$Akşehir$q$, $q$Altınekin$q$, $q$Beyşehir$q$, $q$Bozkır$q$, $q$Cihanbeyli$q$, $q$Çeltik$q$, $q$Çumra$q$, $q$Derbent$q$, $q$Derebucak$q$, $q$Doğanhisar$q$, $q$Emirgazi$q$, $q$Ereğli$q$, $q$Güneysınır$q$, $q$Hadim$q$, $q$Halkapınar$q$, $q$Hüyük$q$, $q$Ilgın$q$, $q$Kadınhanı$q$, $q$Karapınar$q$, $q$Karatay$q$, $q$Kulu$q$, $q$Meram$q$, $q$Sarayönü$q$, $q$Selçuklu$q$, $q$Seydişehir$q$, $q$Taşkent$q$, $q$Tuzlukçu$q$, $q$Yalıhüyük$q$, $q$Yunak$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Kütahya$q$, unnest(array[$q$Altıntaş$q$, $q$Aslanapa$q$, $q$Çavdarhisar$q$, $q$Domaniç$q$, $q$Dumlupınar$q$, $q$Emet$q$, $q$Gediz$q$, $q$Hisarcık$q$, $q$Merkez$q$, $q$Pazarlar$q$, $q$Simav$q$, $q$Şaphane$q$, $q$Tavşanlı$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Malatya$q$, unnest(array[$q$Akçadağ$q$, $q$Arapgir$q$, $q$Arguvan$q$, $q$Battalgazi$q$, $q$Darende$q$, $q$Doğanşehir$q$, $q$Doğanyol$q$, $q$Hekimhan$q$, $q$Kale$q$, $q$Kuluncak$q$, $q$Pütürge$q$, $q$Yazıhan$q$, $q$Yeşilyurt$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Manisa$q$, unnest(array[$q$Ahmetli$q$, $q$Akhisar$q$, $q$Alaşehir$q$, $q$Demirci$q$, $q$Gölmarmara$q$, $q$Gördes$q$, $q$Kırkağaç$q$, $q$Köprübaşı$q$, $q$Kula$q$, $q$Salihli$q$, $q$Sarıgöl$q$, $q$Saruhanlı$q$, $q$Selendi$q$, $q$Soma$q$, $q$Şehzadeler$q$, $q$Turgutlu$q$, $q$Yunusemre$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Mardin$q$, unnest(array[$q$Artuklu$q$, $q$Dargeçit$q$, $q$Derik$q$, $q$Kızıltepe$q$, $q$Mazıdağı$q$, $q$Midyat$q$, $q$Nusaybin$q$, $q$Ömerli$q$, $q$Savur$q$, $q$Yeşilli$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Mersin$q$, unnest(array[$q$Akdeniz$q$, $q$Anamur$q$, $q$Aydıncık$q$, $q$Bozyazı$q$, $q$Çamlıyayla$q$, $q$Erdemli$q$, $q$Gülnar$q$, $q$Mezitli$q$, $q$Mut$q$, $q$Silifke$q$, $q$Tarsus$q$, $q$Toroslar$q$, $q$Yenişehir$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Muğla$q$, unnest(array[$q$Bodrum$q$, $q$Dalaman$q$, $q$Datça$q$, $q$Fethiye$q$, $q$Kavaklıdere$q$, $q$Köyceğiz$q$, $q$Marmaris$q$, $q$Menteşe$q$, $q$Milas$q$, $q$Ortaca$q$, $q$Seydikemer$q$, $q$Ula$q$, $q$Yatağan$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Muş$q$, unnest(array[$q$Bulanık$q$, $q$Hasköy$q$, $q$Korkut$q$, $q$Malazgirt$q$, $q$Merkez$q$, $q$Varto$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Nevşehir$q$, unnest(array[$q$Acıgöl$q$, $q$Avanos$q$, $q$Derinkuyu$q$, $q$Gülşehir$q$, $q$Hacıbektaş$q$, $q$Kozaklı$q$, $q$Merkez$q$, $q$Ürgüp$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Niğde$q$, unnest(array[$q$Altunhisar$q$, $q$Bor$q$, $q$Çamardı$q$, $q$Çiftlik$q$, $q$Merkez$q$, $q$Ulukışla$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Ordu$q$, unnest(array[$q$Akkuş$q$, $q$Altınordu$q$, $q$Aybastı$q$, $q$Çamaş$q$, $q$Çatalpınar$q$, $q$Çaybaşı$q$, $q$Fatsa$q$, $q$Gölköy$q$, $q$Gülyalı$q$, $q$Gürgentepe$q$, $q$İkizce$q$, $q$Kabadüz$q$, $q$Kabataş$q$, $q$Korgan$q$, $q$Kumru$q$, $q$Mesudiye$q$, $q$Perşembe$q$, $q$Ulubey$q$, $q$Ünye$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Osmaniye$q$, unnest(array[$q$Bahçe$q$, $q$Düziçi$q$, $q$Hasanbeyli$q$, $q$Kadirli$q$, $q$Merkez$q$, $q$Sumbas$q$, $q$Toprakkale$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Rize$q$, unnest(array[$q$Ardeşen$q$, $q$Çamlıhemşin$q$, $q$Çayeli$q$, $q$Derepazarı$q$, $q$Fındıklı$q$, $q$Güneysu$q$, $q$Hemşin$q$, $q$İkizdere$q$, $q$İyidere$q$, $q$Kalkandere$q$, $q$Merkez$q$, $q$Pazar$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Sakarya$q$, unnest(array[$q$Adapazarı$q$, $q$Akyazı$q$, $q$Arifiye$q$, $q$Erenler$q$, $q$Ferizli$q$, $q$Geyve$q$, $q$Hendek$q$, $q$Karapürçek$q$, $q$Karasu$q$, $q$Kaynarca$q$, $q$Kocaali$q$, $q$Pamukova$q$, $q$Sapanca$q$, $q$Serdivan$q$, $q$Söğütlü$q$, $q$Taraklı$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Samsun$q$, unnest(array[$q$19 Mayıs$q$, $q$Alaçam$q$, $q$Asarcık$q$, $q$Atakum$q$, $q$Ayvacık$q$, $q$Bafra$q$, $q$Canik$q$, $q$Çarşamba$q$, $q$Havza$q$, $q$İlkadım$q$, $q$Kavak$q$, $q$Ladik$q$, $q$Salıpazarı$q$, $q$Tekkeköy$q$, $q$Terme$q$, $q$Vezirköprü$q$, $q$Yakakent$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Siirt$q$, unnest(array[$q$Baykan$q$, $q$Eruh$q$, $q$Kurtalan$q$, $q$Merkez$q$, $q$Pervari$q$, $q$Şirvan$q$, $q$Tillo$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Sinop$q$, unnest(array[$q$Ayancık$q$, $q$Boyabat$q$, $q$Dikmen$q$, $q$Durağan$q$, $q$Erfelek$q$, $q$Gerze$q$, $q$Merkez$q$, $q$Saraydüzü$q$, $q$Türkeli$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Sivas$q$, unnest(array[$q$Akıncılar$q$, $q$Altınyayla$q$, $q$Divriği$q$, $q$Doğanşar$q$, $q$Gemerek$q$, $q$Gölova$q$, $q$Gürün$q$, $q$Hafik$q$, $q$İmranlı$q$, $q$Kangal$q$, $q$Koyulhisar$q$, $q$Merkez$q$, $q$Suşehri$q$, $q$Şarkışla$q$, $q$Ulaş$q$, $q$Yıldızeli$q$, $q$Zara$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Şanlıurfa$q$, unnest(array[$q$Akçakale$q$, $q$Birecik$q$, $q$Bozova$q$, $q$Ceylanpınar$q$, $q$Eyyübiye$q$, $q$Halfeti$q$, $q$Haliliye$q$, $q$Harran$q$, $q$Hilvan$q$, $q$Karaköprü$q$, $q$Siverek$q$, $q$Suruç$q$, $q$Viranşehir$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Şırnak$q$, unnest(array[$q$Beytüşşebap$q$, $q$Cizre$q$, $q$Güçlükonak$q$, $q$İdil$q$, $q$Merkez$q$, $q$Silopi$q$, $q$Uludere$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Tekirdağ$q$, unnest(array[$q$Çerkezköy$q$, $q$Çorlu$q$, $q$Ergene$q$, $q$Hayrabolu$q$, $q$Kapaklı$q$, $q$Malkara$q$, $q$Marmaraereğlisi$q$, $q$Muratlı$q$, $q$Saray$q$, $q$Süleymanpaşa$q$, $q$Şarköy$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Tokat$q$, unnest(array[$q$Almus$q$, $q$Artova$q$, $q$Başçiftlik$q$, $q$Erbaa$q$, $q$Merkez$q$, $q$Niksar$q$, $q$Pazar$q$, $q$Reşadiye$q$, $q$Sulusaray$q$, $q$Turhal$q$, $q$Yeşilyurt$q$, $q$Zile$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Trabzon$q$, unnest(array[$q$Akçaabat$q$, $q$Araklı$q$, $q$Arsin$q$, $q$Beşikdüzü$q$, $q$Çarşıbaşı$q$, $q$Çaykara$q$, $q$Dernekpazarı$q$, $q$Düzköy$q$, $q$Hayrat$q$, $q$Köprübaşı$q$, $q$Maçka$q$, $q$Of$q$, $q$Ortahisar$q$, $q$Sürmene$q$, $q$Şalpazarı$q$, $q$Tonya$q$, $q$Vakfıkebir$q$, $q$Yomra$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Tunceli$q$, unnest(array[$q$Çemişgezek$q$, $q$Hozat$q$, $q$Mazgirt$q$, $q$Merkez$q$, $q$Nazımiye$q$, $q$Ovacık$q$, $q$Pertek$q$, $q$Pülümür$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Uşak$q$, unnest(array[$q$Banaz$q$, $q$Eşme$q$, $q$Karahallı$q$, $q$Merkez$q$, $q$Sivaslı$q$, $q$Ulubey$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Van$q$, unnest(array[$q$Bahçesaray$q$, $q$Başkale$q$, $q$Çaldıran$q$, $q$Çatak$q$, $q$Edremit$q$, $q$Erciş$q$, $q$Gevaş$q$, $q$Gürpınar$q$, $q$İpekyolu$q$, $q$Muradiye$q$, $q$Özalp$q$, $q$Saray$q$, $q$Tuşba$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Yalova$q$, unnest(array[$q$Altınova$q$, $q$Armutlu$q$, $q$Çınarcık$q$, $q$Çiftlikköy$q$, $q$Merkez$q$, $q$Termal$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Yozgat$q$, unnest(array[$q$Akdağmadeni$q$, $q$Aydıncık$q$, $q$Boğazlıyan$q$, $q$Çandır$q$, $q$Çayıralan$q$, $q$Çekerek$q$, $q$Kadışehri$q$, $q$Merkez$q$, $q$Saraykent$q$, $q$Sarıkaya$q$, $q$Sorgun$q$, $q$Şefaatli$q$, $q$Yenifakılı$q$, $q$Yerköy$q$]);
insert into public.ilce_listesi (il, ilce) select $q$Zonguldak$q$, unnest(array[$q$Alaplı$q$, $q$Çaycuma$q$, $q$Devrek$q$, $q$Ereğli$q$, $q$Gökçebey$q$, $q$Kilimli$q$, $q$Kozlu$q$, $q$Merkez$q$]);
create function public.ilce_kontrol() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ilce is not null and btrim(new.ilce) <> '' then
    if not exists (select 1 from public.ilce_listesi where il = new.sehir and ilce = new.ilce) then raise exception 'gecersiz_ilce'; end if;
  end if;
  return new;
end $$;
create trigger ilanlar_ilce before insert or update of sehir, ilce on public.ilanlar for each row execute function public.ilce_kontrol();

-- ---------- İlan iletişimi: kişisel/iş/dahili telefon ve e-posta ayrı alanlar ----------
alter table public.ilan_iletisim alter column iletisim drop not null;
alter table public.ilan_iletisim drop constraint if exists ilan_iletisim_iletisim_check;
alter table public.ilan_iletisim add constraint ilan_iletisim_eski_metin check (iletisim is null or char_length(btrim(iletisim)) between 3 and 120);
alter table public.ilan_iletisim add column tel_tur text check (tel_tur in ('cep', 'sabit', 'dahili'));
alter table public.ilan_iletisim add column tel text;
alter table public.ilan_iletisim add column dahili text;
alter table public.ilan_iletisim add column eposta text;
-- cep: 05XX (geçerli operatör önekleri) · sabit/dahili: alan kodu 2/3/4 ile başlayan 11 haneli numara ya da 0850
alter table public.ilan_iletisim add constraint ilan_iletisim_tel_bicim check (
  tel is null or
  (tel_tur = 'cep' and tel ~ '^05(0[15-7]|5[1-59]|3[0-9]|4[0-9])[0-9]{7}$') or
  (tel_tur in ('sabit', 'dahili') and (tel ~ '^0[234][0-9]{2}[2-9][0-9]{6}$' or tel ~ '^0850[0-9]{7}$')));
alter table public.ilan_iletisim add constraint ilan_iletisim_tel_tur_cift check ((tel is null) = (tel_tur is null));
alter table public.ilan_iletisim add constraint ilan_iletisim_dahili_kural check (
  (tel_tur is distinct from 'dahili' and dahili is null) or (tel_tur = 'dahili' and dahili is not null and dahili ~ '^[0-9]{1,6}$'));
alter table public.ilan_iletisim add constraint ilan_iletisim_eposta_bicim check (
  eposta is null or (char_length(eposta) <= 120
    and eposta ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$'
    and eposta !~ '\.\.' and eposta !~ '^\.|\.@'
    and eposta !~* '@(mailinator|guerrillamail|10minutemail|tempmail|temp-mail|yopmail|trashmail|sharklasers|getnada|dispostable|maildrop|throwawaymail|fakeinbox)\.'));
-- en az bir ulaşma yolu: telefon yoksa e-posta zorunlu
alter table public.ilan_iletisim add constraint ilan_iletisim_en_az_biri check (tel is not null or eposta is not null or iletisim is not null);

-- ---------- İlanı veren kişi, sebep seçerek ilanını kaldırabilir ----------
alter table public.ilanlar drop constraint if exists ilanlar_durum_check;
alter table public.ilanlar add constraint ilanlar_durum_check check (durum in ('beklemede', 'yayinda', 'reddedildi', 'kaldirildi'));
alter table public.ilanlar add column kaldirma_nedeni text check (kaldirma_nedeni is null or kaldirma_nedeni in ($q$Pozisyon doldu / eleman bulundu$q$, $q$Devir gerçekleşti$q$, $q$Vazgeçtim$q$, $q$İlanda hata var, yenisini vereceğim$q$, $q$Diğer$q$));
alter table public.ilanlar add column kaldirma_tarihi timestamptz;
alter table public.ilanlar add constraint ilanlar_kaldirma_sebepli check (durum <> 'kaldirildi' or kaldirma_nedeni is not null);
create function public.ilan_kaldirma_tarihi() returns trigger language plpgsql set search_path = public as $$
begin
  if new.durum = 'kaldirildi' and old.durum is distinct from 'kaldirildi' then new.kaldirma_tarihi = now(); end if;
  return new;
end $$;
create trigger ilanlar_kaldirma before update on public.ilanlar for each row execute function public.ilan_kaldirma_tarihi();
drop policy if exists "yönetici ilan durumunu değiştirir" on public.ilanlar;
create policy "ilan durumu: yönetici her şeyi, sahibi yalnızca kaldırır" on public.ilanlar for update to authenticated
  using (public.is_admin() or (author_id = auth.uid() and durum in ('beklemede', 'yayinda')))
  with check (public.is_admin() or (author_id = auth.uid() and durum = 'kaldirildi' and kaldirma_nedeni is not null));
grant update (durum, kaldirma_nedeni) on public.ilanlar to authenticated;
-- Sahibi yayindaki ilanini silemez (sebepsiz kaldirmayi engellemek icin); yalnizca onaysiz ilanini silebilir
drop policy if exists "kendi ilanını ya da yönetici siler" on public.ilanlar;
create policy "ilan silme: yönetici ya da sahibi (yalnızca onaysız)" on public.ilanlar for delete to authenticated
  using (public.is_admin() or (author_id = auth.uid() and durum = 'beklemede'));

-- ---------- İlk yönetici ----------
-- Kayıt olduktan sonra kendi kullanıcı adınızla çalıştırın:
--   update public.profiles set is_admin = true where username = 'KULLANICI_ADINIZ';

-- Geçiş 02: kendi reklamlarımız, ilan süresi ve yeni alanlar, sebepli bildirim, akış kategorisi, köşe yazarı, üyelik silme.
-- Var olan veritabanına BİR KEZ çalıştırılır (SQL Editor). Veri silmez. Tek işlemdir: hata olursa hiçbir değişiklik kalmaz.
-- Önce schema.sql kurulmuş olmalıdır.
begin;

-- ---------- Akış kategorisi ----------
alter table public.posts add column kategori text check (kategori is null or kategori in
  ($q$Genel$q$, $q$Çalışma koşulları$q$, $q$Mevzuat ve SGK$q$, $q$Eylem ve duyuru$q$, $q$Soru-cevap$q$));
create index posts_kategori_idx on public.posts (kategori, created_at desc);

-- ---------- Köşe yazarı ----------
alter table public.yazilar add column yazar_adi text check (yazar_adi is null or char_length(btrim(yazar_adi)) between 2 and 80);

-- ---------- İlan: yeni alanlar ve 60 günlük süre ----------
alter table public.ilanlar add column calisma_sekli text check (calisma_sekli is null or calisma_sekli in
  ($q$Tam zamanlı$q$, $q$Yarı zamanlı$q$, $q$Dönemsel / vekâlet$q$, $q$Staj$q$));
alter table public.ilanlar add column ruhsat text check (ruhsat is null or ruhsat in ($q$Ruhsatlı$q$, $q$Ruhsatsız$q$));
alter table public.ilanlar add column bitis_tarihi timestamptz;
-- Yayındaki eski ilanlara bugünden itibaren 60 gün tanınır
update public.ilanlar set bitis_tarihi = now() + interval '60 days' where durum = 'yayinda';

-- Süre, ilan yayına alındığı anda başlar. İstemci bu sütunu değiştiremez (sütun yetkisi verilmez).
create function public.ilan_sure_baslat() returns trigger language plpgsql set search_path = public as $$
begin
  if new.durum = 'yayinda' and old.durum is distinct from 'yayinda' then new.bitis_tarihi = now() + interval '60 days'; end if;
  return new;
end $$;
create trigger ilanlar_sure before update on public.ilanlar for each row execute function public.ilan_sure_baslat();

-- Yeni eklenen ilanda istemcinin gönderdiği süre yok sayılır
create function public.ilan_sure_sifirla() returns trigger language plpgsql set search_path = public as $$
begin new.bitis_tarihi = null; return new; end $$;
create trigger ilanlar_sure_ekle before insert on public.ilanlar for each row execute function public.ilan_sure_sifirla();

-- Sahibi, süresi dolmuş ya da 10 günden az kalmış yayındaki ilanını 60 gün uzatır
create function public.ilan_yenile(p_id bigint) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare yeni timestamptz;
begin
  update public.ilanlar set bitis_tarihi = now() + interval '60 days'
   where id = p_id and author_id = auth.uid() and durum = 'yayinda'
     and (bitis_tarihi is null or bitis_tarihi < now() + interval '10 days')
  returning bitis_tarihi into yeni;
  if yeni is null then raise exception 'ilan_uzatilamaz'; end if;
  return yeni;
end $$;
revoke all on function public.ilan_yenile(bigint) from public, anon;
grant execute on function public.ilan_yenile(bigint) to authenticated;

-- Süresi dolan ilan herkese kapanır (iletişim bilgisi de bu kurala bağlıdır)
drop policy "yayındaki ilanlar herkese açık" on public.ilanlar;
create policy "yayındaki ilanlar herkese açık" on public.ilanlar for select
  using ((durum = 'yayinda' and (bitis_tarihi is null or bitis_tarihi > now())) or author_id = auth.uid() or public.is_admin());

-- ---------- Sebepli bildirim: gönderi ya da ilan ----------
alter table public.reports alter column post_id drop not null;
alter table public.reports add column ilan_id bigint references public.ilanlar(id) on delete cascade;
alter table public.reports add column sebep text check (sebep is null or sebep in
  ($q$Dolandırıcılık şüphesi$q$, $q$Hakaret ya da kişilik hakkı$q$, $q$Kişisel veri paylaşımı$q$, $q$Yanlış ya da yanıltıcı bilgi$q$, $q$İzinsiz reklam$q$, $q$Diğer$q$));
alter table public.reports add constraint reports_tek_hedef check (num_nonnulls(post_id, ilan_id) = 1);
alter table public.reports add constraint reports_ilan_tek unique (ilan_id, user_id);

-- ---------- Kendi reklamlarımız (yalnızca yönetici yönetir) ----------
create table public.reklamlar (
  id bigint generated always as identity primary key,
  ad_veren text not null check (char_length(btrim(ad_veren)) between 2 and 80),
  yer text not null check (yer in ('ust', 'alt', 'icerik', 'sol', 'sag')),
  gorsel_url text not null check (char_length(gorsel_url) <= 600 and gorsel_url ~ '^https://'),
  baglanti text not null check (char_length(baglanti) <= 800 and baglanti ~ '^https://'),
  aktif boolean not null default true,
  baslangic timestamptz not null default now(),
  bitis timestamptz,
  created_at timestamptz not null default now()
);
alter table public.reklamlar enable row level security;
create policy "yayındaki reklamlar herkese açık" on public.reklamlar for select
  using ((aktif and baslangic <= now() and (bitis is null or bitis > now())) or public.is_admin());
create policy "yönetici reklam ekler" on public.reklamlar for insert to authenticated with check (public.is_admin());
create policy "yönetici reklam günceller" on public.reklamlar for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "yönetici reklam siler" on public.reklamlar for delete to authenticated using (public.is_admin());
grant select on public.reklamlar to anon, authenticated;
grant insert, update, delete on public.reklamlar to authenticated;

-- Sayaçlar ayrı tabloda: yalnızca yönetici okur. Kişisel veri tutulmaz. Sayılar yaklaşıktır (dışarıdan şişirilebilir).
create table public.reklam_sayac (
  reklam_id bigint primary key references public.reklamlar(id) on delete cascade,
  gosterim bigint not null default 0,
  tiklama bigint not null default 0
);
alter table public.reklam_sayac enable row level security;
create policy "yönetici sayaçları görür" on public.reklam_sayac for select to authenticated using (public.is_admin());
grant select on public.reklam_sayac to authenticated;

create function public.reklam_say(p_id bigint, p_tur text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tur not in ('gosterim', 'tiklama') then return; end if;
  if not exists (select 1 from public.reklamlar where id = p_id and aktif and baslangic <= now() and (bitis is null or bitis > now())) then return; end if;
  insert into public.reklam_sayac (reklam_id, gosterim, tiklama)
  values (p_id, (p_tur = 'gosterim')::int, (p_tur = 'tiklama')::int)
  on conflict (reklam_id) do update set gosterim = reklam_sayac.gosterim + excluded.gosterim, tiklama = reklam_sayac.tiklama + excluded.tiklama;
end $$;
revoke all on function public.reklam_say(bigint, text) from public;
grant execute on function public.reklam_say(bigint, text) to anon, authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ---------- Üye kendi hesabını siler (profil, gönderi, beğeni ve ilanları birlikte silinir) ----------
create function public.hesabimi_sil() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'oturum_yok'; end if;
  if public.is_admin() then raise exception 'yonetici_silinemez'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.hesabimi_sil() from public, anon;
grant execute on function public.hesabimi_sil() to authenticated;

commit;
