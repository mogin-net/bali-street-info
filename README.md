# bali-street-info

```
# Install
> supabase start
> npm install

# Run
> npm run web dev


# Konsep dan Pembagian fungsi file Ari:
1. head.tsxdi folder di web/src/components/report
    file yang berisi bagian header dari laporan(tombol back dan "Keterangan halaman").

2. reportPopUp.tsx di web/src/components/report/partials
    File yang berisi code untuk bagian yang pop up setelah mengclick pilih lokasi penutupan.
    *Catatan tambahan, untuk bagian maps bisa di lihat di line 196.

3. reportList.tsx di web/src/components/report
    file yang berisi code untuk bagian list laporan, seperti lokasi jalan, kategori, dll.

4. reportLayout.tsx di web/src/components/report
file yang menjadi layout utama halaman reportnya, yang menggabungkan komponen head,reportList,dan reportPopUp.


4. report.tsx di web/src/pages/report
    Itu sebagai menarik data dari database dan meneruskan/mereturn layout yang sudah di buat di folder component

```
