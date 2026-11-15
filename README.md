# bali-street-info

## Setup Commands

```
# Install
> supabase start
> npm install

# Run
> npm run dev -w web

```

## Useful Commands

```
# Supabase
> supabase migrate new            # Create new migration file
> supabase migrate up             # Run migration
> supabase db reset               # Clear DB
> supabase stop                   # Stop supabase container
> supabase status                 # Check supabase status

#How to Start the Fuction
> supabase functions serve "resolve-street" --no-verify-jwt

# NPM
> npx i [package name] -w web     # Add dependencies to web package > npm run dev -w web

```

## Konsep dan Pembagian fungsi file Ari

```
1. head.tsxdi folder di web/src/components/report
    file yang berisi bagian header dari laporan(tombol back dan "Keterangan halaman").

2. reportPopUp.tsx di web/src/components/report/partials
    File yang berisi code untuk bagian yang pop up setelah mengclick pilih lokasi penutupan.
    *Catatan tambahan, untuk bagian maps bisa di lihat di line 196.

3. mapPreview.tsx di web/src/components/report
    file yang berisi code untu bagian preview lokasi yang telah di pilih di list report

4. reportList.tsx di web/src/components/report
    file yang berisi code untuk bagian list laporan, seperti lokasi jalan, kategori, dll.

5. reportLayout.tsx di web/src/components/report
    file yang menjadi layout utama halaman reportnya, yang menggabungkan komponen head,reportList,dan reportPopUp.


6. report.tsx di web/src/pages/report
    Itu sebagai menarik data dari database dan meneruskan/mereturn layout yang sudah di buat di folder component


```

Fungsi yang perlu dipanggil dari terminal adalah **Edge Function** `resolve-street`, bukan RPC database secara langsung. Edge Function mencari ruas jalan di Overpass, lalu memanggil RPC `upsert_osm_street` untuk menyimpannya. RPC tersebut hanya mengizinkan `service_role`, jadi Edge Function perlu secret key backend. Alurnya ada di `index.ts` dan RPC-nya dibuat oleh `migrasi upsert`.

### 1. Jalankan Supabase lokal

Di direktori proyek:

```bash
supabase start
supabase status
```

Pastikan migrasi sudah diterapkan. Jika database lokal belum disiapkan, bisa jalankan:

```bash
supabase db reset
```

**Perhatian:** perintah itu mereset database lokal dan menjalankan ulang migrasi; data lokal yang ada akan terhapus.

### 2. Siapkan secret key untuk Edge Function

Dari hasil `supabase status`, ambil **service role key lokal**—bukan anon key. Buat file `.env.local` di root proyek:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=ISI_DENGAN_SERVICE_ROLE_KEY_LOKAL
```

Jangan commit file ini atau membagikan key-nya. Kode fungsi membaca `SUPABASE_SECRET_KEY` sebagai fallback jika `SUPABASE_SECRET_KEYS` tidak tersedia.

### 3. Jalankan Edge Function

```bash
supabase functions serve resolve-street \
  --no-verify-jwt \
  --env-file .env.local
```

Biarkan proses ini berjalan di terminal tersebut. `--no-verify-jwt` digunakan di sini untuk pemanggilan lokal tanpa token login.

### 4. Kirim koordinat untuk dicari

Buka terminal kedua, lalu kirim request POST. Contoh koordinat di sekitar Sanur:

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/resolve-street' \
  -H 'Content-Type: application/json' \
  -d '{"lat":-8.6925,"lng":115.263}'
```

Jika jalan ditemukan dalam batas pencarian, responsnya berisi `success: true` serta data ruas, termasuk UUID, OSM Way ID, nama, dan geometri. Fungsi mensyaratkan ruas berjarak **maksimal 5 meter** dari titik yang dikirim; jika tidak ada yang cocok, responsnya `404`.

### 5. Periksa hasil di database lokal

Jika `psql` tersedia, jalankan:

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -c "SELECT uuid, osm_way_id, name, ST_AsGeoJSON(coordinates) AS coordinates
      FROM public.streets
      ORDER BY dt_updated DESC
      LIMIT 5;"
```

Memanggil fungsi lagi untuk OSM Way ID yang sama akan memperbarui ruas yang sudah ada, bukan membuat baris duplikat.
