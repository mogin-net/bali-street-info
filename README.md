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

## How to set up the backend

```
1. Jalankan supabase start dan supabase status
    untuk melihat Authentication Keys

2. Kemudian di root, buatlah file .env.local,
    kemudian di dalamnya diisi:
    SUPABASE_URL=<Project URL>
    SUPABASE_SECRET_KEY=<Authentication Keys>

3. Kemudian jalankan supabase migration up terlebih
    dahulu di folder root terminal bash/wsl pada vscode langsung, tunggu sampai prosesnya selesai.


3. Setelah selesai proses migrationnya, pada
    terminal bash/wsl tadi, pastikan sedang berada di folder root, exp:~/programming/bali-street-info .
    Kemudian jalankan edge function untuk mengambil data jalan ini: supabase functions serve import-osm-streets --no-verify-jwt --env-file .env.local.

4. Tunggu sampai prosesnya selesai, jika sudah
    jalan fungsinya, maka jalankan proses pengambilan data jalan dengan menggunakan ini di terminal bash/wsl baru(terminal kedua):
    set -a
    source .env.local
    set +a

    curl -i -X POST \
    'http://127.0.0.1:54321/functions/v1/import-osm-streets' \
    -H "apikey: ${SUPABASE_SECRET_KEY}"

5. Tunggu sampai prosesnya selesai(Karena ini
    memakan waktu yang cukup lama), kemudian setelah  terdapat pemberitahuan "....success" maka prosesnya dinyatakan berhasil. tinggal di lihat hasilnya di tabel streets di supabase lokal dan bisa test di webnya langsung dengan menjalankan:
    npm run dev -w web

```
