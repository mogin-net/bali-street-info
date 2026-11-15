# Rekomendasi Skema Database Supabase

Dokumen ini merangkum skema yang disarankan untuk fitur laporan penutupan jalan. Skema disesuaikan dengan kebutuhan frontend saat ini: kategori, akses kendaraan, deskripsi, titik awal dan akhir ruas, status jalan, serta konfirmasi kondisi jalan.

> Ini adalah rancangan, bukan migrasi siap-jalankan. Aktifkan PostGIS di project Supabase sebelum memakai tipe `geometry`, dan sesuaikan schema tipe PostGIS dengan konfigurasi project.

## Ringkasan perubahan

- Gunakan `UUID` sebagai primary key dan `NOT NULL` untuk semua ID.
- Simpan waktu sebagai `TIMESTAMPTZ`, bukan `DATE`, agar jam laporan dan konfirmasi tidak hilang.
- Pisahkan kondisi jalan (`ditutup` atau `dibuka`) dari kedaluwarsa laporan. Kedaluwarsa ditentukan oleh `expires_at`.
- Simpan titik awal/akhir laporan sebagai geometri, bukan angka tanpa satuan.
- Gunakan geometri garis untuk menggambarkan ruas jalan yang terdampak dan bentuk jalan OSM.
- Tambahkan foreign key, batasan unik, dan indeks yang sesuai.
- Samakan nilai kategori database dengan nilai yang dikirim frontend: huruf kecil.

## 1. `reports`

Satu baris mewakili satu laporan.

| Kolom | Tipe yang disarankan | Aturan | Keterangan |
|---|---|---|---|
| `uuid` | `UUID` | Primary key, `NOT NULL`, default `gen_random_uuid()` | ID laporan |
| `title` | `TEXT` | `NOT NULL` | Judul untuk daftar dan detail. Form saat ini belum meminta judul, jadi dapat dibuat otomatis di backend |
| `category` | enum kategori | `NOT NULL`, default `lainnya` | Gunakan nilai `perbaikan`, `upacara`, `bencana`, `event`, `lainnya` |
| `is_car_forbidden` | `BOOLEAN` | `NOT NULL`, default `TRUE` | Apakah mobil dilarang lewat |
| `is_motorcycle_forbidden` | `BOOLEAN` | `NOT NULL`, default `TRUE` | Apakah motor dilarang lewat |
| `description` | `TEXT` | Nullable | Deskripsi opsional; frontend membatasi 280 karakter |
| `road_status` | enum status jalan | `NOT NULL`, default `ditutup` | Status jalan: `ditutup` atau `dibuka` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, default `now()` | Waktu pembuatan laporan |
| `expires_at` | `TIMESTAMPTZ` | Nullable | Batas waktu laporan dianggap kedaluwarsa |
| `created_by` | `UUID` | Nullable atau `NOT NULL`, foreign key ke `auth.users(id)` | Isi jika laporan dibatasi untuk pengguna masuk |

Kategori perlu mengikuti ejaan dan kapitalisasi nilai yang dikirim frontend. Frontend saat ini mengirim nilai huruf kecil, seperti `perbaikan`, bukan `Perbaikan`.

Jangan simpan `expired` sebagai `road_status`: itu mencampur kondisi jalan dengan masa berlaku laporan. Laporan yang melewati `expires_at` dapat dianggap kedaluwarsa melalui query atau view tanpa mengubah status apakah jalan ditutup atau dibuka.

## 2. `streets`

Satu baris mewakili satu jalan atau OSM way.

| Kolom | Tipe yang disarankan | Aturan | Keterangan |
|---|---|---|---|
| `uuid` | `UUID` | Primary key, `NOT NULL`, default `gen_random_uuid()` | ID internal jalan |
| `osm_way_id` | `BIGINT` | `NOT NULL`, unik | ID way dari OpenStreetMap |
| `name` | `VARCHAR(150)` | `NOT NULL` | Nama jalan |
| `geom` | `geometry(LineString, 4326)` | `NOT NULL` | Bentuk garis jalan, bukan satu titik |

`POINT` hanya menyimpan satu posisi. Untuk menggambarkan bentuk jalan pada peta, gunakan `LineString`. EPSG:4326 memakai koordinat longitude/latitude.

## 3. `report_street_segments`

Satu baris mewakili ruas terdampak pada satu laporan. `sequence` memungkinkan satu laporan mencakup beberapa ruas.

| Kolom | Tipe yang disarankan | Aturan | Keterangan |
|---|---|---|---|
| `report_uuid` | `UUID` | `NOT NULL`, foreign key ke `reports.uuid` | Laporan pemilik ruas |
| `street_uuid` | `UUID` | `NOT NULL`, foreign key ke `streets.uuid` | Jalan yang terdampak |
| `sequence` | `INTEGER` | `NOT NULL` | Urutan ruas dalam laporan |
| `start_point` | `geometry(Point, 4326)` | `NOT NULL` | Titik awal yang dipilih pelapor |
| `end_point` | `geometry(Point, 4326)` | `NOT NULL` | Titik akhir yang dipilih pelapor |
| `segment_geom` | `geometry(LineString, 4326)` | Nullable | Bentuk ruas terdampak yang mengikuti jalan; dapat diisi dari data jalan |

Gunakan primary key gabungan `(report_uuid, sequence)`. Frontend saat ini meminta titik awal dan akhir. Titik tersebut tidak selalu cukup untuk menggambarkan ruas yang melengkung, sehingga `segment_geom` disediakan untuk garis jalan sebenarnya.

Jika laporan boleh dibuat untuk jalan yang belum ada di katalog `streets`, tentukan alur untuk menambahkan/mencocokkan jalan tersebut terlebih dahulu, atau ubah `street_uuid` menjadi nullable dengan aturan yang jelas.

## 4. `report_confirmations`

Satu baris mewakili konfirmasi seorang pengguna terhadap kondisi jalan pada sebuah laporan.

| Kolom | Tipe yang disarankan | Aturan | Keterangan |
|---|---|---|---|
| `uuid` | `UUID` | Primary key, `NOT NULL`, default `gen_random_uuid()` | ID konfirmasi |
| `report_uuid` | `UUID` | `NOT NULL`, foreign key ke `reports.uuid` | Laporan yang dikonfirmasi |
| `user_id` | `UUID` | `NOT NULL`, foreign key ke `auth.users(id)` | Pengguna yang mengonfirmasi |
| `is_closed` | `BOOLEAN` | `NOT NULL` | `TRUE` berarti masih ditutup; `FALSE` berarti sudah dibuka |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, default `now()` | Waktu konfirmasi |

Tambahkan batasan unik `(report_uuid, user_id)` bila satu pengguna hanya boleh mengonfirmasi satu kali per laporan. Jumlah konfirmasi “Ditutup” dan “Dibuka” dapat dihitung dari kolom `is_closed`.

Tampilan detail perlu memiliki aturan untuk menentukan status terkini, misalnya berdasarkan jumlah suara atau keputusan admin. Jika konfirmasi boleh dilakukan tanpa akun, tentukan mekanisme pencegahan spam di backend; jangan mempercayai identitas yang dikirim bebas oleh browser.

## Relasi

```text
reports 1 ─── * report_street_segments * ─── 1 streets
reports 1 ─── * report_confirmations
auth.users 1 ─── * report_confirmations
auth.users 1 ─── * reports                 (jika created_by digunakan)
```

## Contoh data

Contoh berikut memakai ID ilustratif. Ganti ID OSM dan ID pengguna dengan nilai yang benar dari project. Di format WKT, koordinat ditulis sebagai **longitude latitude**; sedangkan UI umumnya menampilkan **latitude, longitude**.

### `reports`

| uuid | title | category | road_status | is_car_forbidden | is_motorcycle_forbidden | description | created_at |
|---|---|---|---|---:|---:|---|---|
| `b0000000-0000-4000-8000-000000000001` | Penutupan Total Jl. Hang Tuah | `upacara` | `ditutup` | `TRUE` | `TRUE` | Penutupan total ruas Jalan Hang Tuah untuk kendaraan dari kedua arah. | `2026-11-06 13:00:00+08` |
| `b0000000-0000-4000-8000-000000000002` | Jalan Segara Ayu Sudah Dibuka Kembali | `perbaikan` | `dibuka` | `FALSE` | `FALSE` | Ruas Jalan Segara Ayu sudah dibuka kembali dan dapat dilalui kendaraan. | `2026-11-06 14:00:00+08` |

### `streets`

| uuid | osm_way_id | name | geom |
|---|---:|---|---|
| `a0000000-0000-4000-8000-000000000001` | ID OSM yang valid | Jl. Hang Tuah | Garis jalan lengkap dari data OSM |
| `a0000000-0000-4000-8000-000000000002` | ID OSM yang valid | Jl. Segara Ayu | Garis jalan lengkap dari data OSM |

### `report_street_segments`

| report_uuid | street_uuid | sequence | start_point | end_point | segment_geom |
|---|---|---:|---|---|---|
| `b0000000-0000-4000-8000-000000000001` | `a0000000-0000-4000-8000-000000000001` | 1 | `POINT(115.257134 -8.674620)` | `POINT(115.258773 -8.674575)` | `LINESTRING(115.257134 -8.674620, 115.258098 -8.674638, 115.258773 -8.674575)` |
| `b0000000-0000-4000-8000-000000000002` | `a0000000-0000-4000-8000-000000000002` | 1 | `POINT(115.262359 -8.682447)` | `POINT(115.263111 -8.682483)` | `LINESTRING(115.262359 -8.682447, 115.262639 -8.682460, 115.263111 -8.682483)` |

### `report_confirmations`

| uuid | report_uuid | user_id | is_closed | created_at |
|---|---|---|---:|---|
| `c0000000-0000-4000-8000-000000000001` | `b0000000-0000-4000-8000-000000000001` | UUID pengguna Supabase | `TRUE` | `2026-11-06 13:20:00+08` |
| `c0000000-0000-4000-8000-000000000002` | `b0000000-0000-4000-8000-000000000001` | UUID pengguna Supabase lain | `FALSE` | `2026-11-06 13:35:00+08` |

## Catatan implementasi Supabase

- Aktifkan PostGIS dan pertimbangkan indeks spasial GiST untuk kolom geometri yang sering dipakai pencarian/peta.
- Buat indeks untuk foreign key dan waktu pembuatan laporan bila digunakan untuk filter atau pengurutan.
- Atur Row Level Security (RLS) pada tabel yang terekspos melalui Supabase API. Tentukan kebijakan baca, pembuatan laporan, dan konfirmasi berdasarkan kebutuhan aplikasi.
- Jangan menaruh `service_role` key di frontend.
- Skema ini belum otomatis menghubungkan frontend ke database. Form laporan dan tombol konfirmasi perlu diintegrasikan dengan Supabase; UI saat ini masih menggunakan data dummy/state lokal.
