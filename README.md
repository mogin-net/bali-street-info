# bali-street-info

## Setup Commands

```
# Install
> supabase start
> npm install

# Run
> npm run web dev
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

# NPM
> npx i [package name] -w web     # Add dependencies to web package
```

## Konsep dan Pembagian fungsi file Ari:

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
