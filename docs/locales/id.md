# PopChat for Twitch

Ekstensi tidak resmi yang tidak disediakan atau didukung secara resmi oleh Twitch.

## Memasang paket lokal

1. Ekstrak ZIP runtime/toko ke folder tersendiri. File `manifest.json` berada di tingkat teratas ZIP.
2. Buka `chrome://extensions` di Chrome atau `edge://extensions` di Edge, lalu aktifkan mode pengembang.
3. Pilih “Muat yang belum dipaketkan”, lalu pilih folder hasil ekstraksi itu sendiri. Jika memakai ZIP kode sumber, pilih `popchat-for-twitch/extension` di dalam paket yang sudah diekstrak. Dalam kedua kasus, pilih folder yang langsung berisi `manifest.json`.
4. Saat pertama kali dipasang, halaman lokal ekstensi terbuka otomatis di tab baru. Baca informasinya, lalu pilih “Aktifkan” jika Anda setuju. Pilih “Jangan sekarang” untuk membiarkan ekstensi tetap nonaktif.
5. Muat ulang halaman Twitch jika perlu.

Popup ekstensi di toolbar menunjukkan status aktifnya. Pilih “Panduan dan pengaturan” untuk membuka halaman khusus, atau kembali ke tabnya jika sudah terbuka. Anda dapat mengaktifkan atau menonaktifkan fitur dari halaman itu kapan saja.

## Cara menggunakan

Di halaman siaran langsung Twitch, klik ikon roda gigi pada pemutar. Pilih “Popout” untuk jendela biasa atau “Popout (selalu di depan)” untuk jendela yang tetap berada di atas jendela lain. Pilih tata letak chat di bagian atas jendela kecil.

AUTO menyesuaikan tata letak dengan jendela; SIDE menaruh chat di kanan; BOTTOM menaruhnya di bawah video; HIDE menyembunyikan chat dengan tetap mempertahankan chat yang sudah dimuat. Pilih mode lain untuk menampilkannya lagi. “Muat ulang” menyegarkan chat resmi. “Jendela chat” membuka chat resmi saja secara terpisah.

Biarkan tab Twitch asal tetap terbuka saat memakai jendela yang selalu di depan. Menutup, memuat ulang, atau berpindah halaman di tab asal juga akan menutup jendela kecil. Menutup jendela kecil akan mengembalikan video ke tab asal.

## Cakupan dan batasan

Untuk Chrome dan Edge desktop dengan dukungan Document Picture-in-Picture (Chromium 116 atau lebih baru). Perangkat seluler, Firefox, VOD, dan klip berada di luar cakupan. Opsi hanya ditambahkan jika struktur menu Twitch dikenali; pembaruan Twitch dapat membuatnya tidak muncul. Menutup, memuat ulang, atau berpindah halaman di tab asal akan menutup jendela yang selalu di depan. Sebagian pengaturan dan lapisan tampilan pemutar Twitch tidak ikut berpindah bersama video. Login dan pengiriman pesan chat bergantung pada Twitch dan pengaturan browser.

Jendela yang selalu di depan memakai Document Picture-in-Picture. Fitur ini tidak menambahkan chat ke PiP biasa yang hanya menampilkan video.

## Privasi

Setelah diaktifkan, ekstensi menggunakan URL kanal saat ini, elemen video yang ada, serta struktur pemutar dan menu secara lokal untuk mengatur video dan chat. Chat resmi terhubung langsung ke Twitch dan dapat menggunakan sesi login Twitch Anda. Hanya pengaturan tampilan dan pilihan persetujuan Anda yang disimpan secara lokal; tidak ada data yang dikirim ke pengembang.

Sebelum diaktifkan, ekstensi tidak membaca URL kanal atau struktur pemutar dan menu serta tidak memuat chat resmi. Buka “Panduan dan pengaturan” dari popup ekstensi di toolbar, lalu pilih “Nonaktifkan” di halaman khusus untuk mencabut persetujuan. Chat tersemat dan jendela yang selalu di depan yang dikelola ekstensi akan ditutup, dan video dikembalikan ke tempat asalnya. Pengaturan tampilan Anda tetap disimpan.

Ekstensi ini tidak memiliki analitik, iklan, atau server sendiri. Nama kanal dibaca dari URL halaman saat ini hanya untuk menampilkan chat resmi yang sesuai. Hanya mode tata letak, lebar dan tinggi jendela, serta pilihan persetujuan Anda yang disimpan di penyimpanan lokal ekstensi, tanpa sinkronisasi. Ekstensi tidak menyimpan chat, riwayat penelusuran, nama kanal, nama pengguna, kredensial, atau cookie, dan tidak membaca isi bingkai chat resmi. Sematan resmi Twitch terhubung langsung ke Twitch dan menggunakan sesi Twitch jika diizinkan browser. Twitch menangani login dan chat sesuai kebijakannya sendiri. Ekstensi hanya menggunakan izin storage dan berjalan di halaman HTTPS pada www.twitch.tv serta player.twitch.tv.

## Memperbarui

Tutup jendela kecil. Ganti seluruh folder yang dimuat pada jalur yang sama seperti yang terdaftar di browser, jangan gabungkan file baru dengan file lama. Muat ulang ekstensi melalui pengelola ekstensi browser, lalu muat ulang semua halaman Twitch yang terbuka. Pembaruan biasa mempertahankan pengaturan tata letak tersimpan.

Pembaruan dan proses memulai browser tidak membuka halaman panduan secara otomatis. Pilihan persetujuan yang Anda simpan di versi 1.5.0 juga dipertahankan. Pengaturan tampilan lama saja tidak dianggap sebagai persetujuan. Saat memperbarui dari versi yang belum meminta persetujuan, buka “Panduan dan pengaturan” dari popup ekstensi di toolbar, baca informasinya, lalu pilih “Aktifkan” sebelum menggunakan fiturnya.
