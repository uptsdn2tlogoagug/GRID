# GRID — Manajemen Foto GPS

Versi perapihan dari aplikasi generator foto GPS berbasis HTML, CSS, JavaScript, dan Google Apps Script.

## Isi paket

- `index.html` — aplikasi utama (dashboard, generator, galeri, database, dan akun).
- `code.js` — backend Google Apps Script untuk penyimpanan Google Drive.
- `manifest.webmanifest` — metadata instalasi aplikasi.
- `sw.js` — service worker untuk cache shell aplikasi saat offline.
- `icon-192.png`, `icon-512.png` — ikon aplikasi.

## Fitur yang dirapikan / ditambahkan

- Desain ulang dashboard, navigasi, kartu statistik, formulir, galeri, dan tampilan mobile.
- Validasi koordinat latitude/longitude agar berada pada rentang yang benar.
- Validasi metadata dan batas ukuran foto di sisi backend.
- Pemulihan backup memeriksa keberadaan file gambar di Google Drive sebelum mengganti indeks.
- Ekspor metadata galeri ke CSV (dapat dibuka dengan Excel).
- Manifest dan service worker ditambahkan agar referensi PWA tidak mengarah ke file yang hilang.
- Database, pengelolaan akun, backup, generator, dan fitur inti sebelumnya tetap dipertahankan.

## Cara menjalankan

1. Ekstrak seluruh isi ZIP ke satu folder.
2. Buka `index.html` melalui hosting HTTPS atau server lokal. Untuk GPS browser, PWA, dan service worker, gunakan HTTPS (localhost juga didukung untuk pengembangan).
3. Untuk database Google Drive, buka project Google Apps Script yang digunakan sebelumnya, ganti isi script dengan `code.js`, lalu sesuaikan `FOLDER_ID` dan `KODE`.
4. Jalankan fungsi `izin()` sekali dari editor Apps Script untuk memberikan izin Drive.
5. Deploy sebagai Web App dengan akses yang sesuai kebutuhan organisasi. Masukkan URL `/exec` dan kode rahasia yang sama pada menu **Database**.
6. Uji koneksi, buat satu backup, lalu coba simpan satu foto sebelum memindahkan penggunaan ke perangkat lain.

## Catatan keamanan penting

- Ganti nilai `KODE` bawaan pada `code.js` dengan kode acak yang kuat sebelum deploy.
- Jangan membagikan URL Web App dan kode rahasia kepada pihak yang tidak berwenang.
- Kunci masuk di halaman depan HTML adalah pengunci antarmuka di sisi browser, bukan sistem autentikasi server. Jangan mengandalkannya untuk melindungi data sensitif. Untuk penggunaan multi-petugas yang membutuhkan kontrol akses nyata, backend perlu dihubungkan ke autentikasi server-side dan pemeriksaan peran pada setiap aksi.
- Fitur peran akun yang sudah ada masih mengelola data akun, tetapi belum menjadi pembatas akses server untuk seluruh operasi foto.
- Service worker hanya menyimpan shell aplikasi; permintaan database dan data foto tidak dimasukkan ke cache offline.
