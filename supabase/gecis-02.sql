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
