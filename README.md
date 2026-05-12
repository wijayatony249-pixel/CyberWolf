# Cyberwolf - Realtime Cybersecurity Social Deduction

Cyberwolf adalah platform game multiplayer bertema cybersecurity yang memadukan mekanik *social deduction* klasik dengan estetika teknologi modern. Pemain berperan sebagai **Security Agent** atau **Malware** dalam duel strategi memperebutkan kontrol sistem.

## 🌐 Landing Page
Aplikasi ini kini dilengkapi dengan **Tactical Landing Page** yang berfungsi sebagai pusat informasi dan gerbang utama operasi:
- **Operation Overview**: Ringkasan mekanik permainan dan latar belakang cerita.
- **Tactical Unit Profiles**: Panduan mendalam mengenai 6 role unik beserta statistik tingkat kesulitannya.
- **Operation Procedure**: Panduan langkah-demi-langkah bagi pemain baru untuk memulai misi.
- **System Status**: Pemantauan status server dan jumlah pemain aktif secara real-time.

## 🛠️ Fitur Utama

### 1. Sistem Lobby & Koneksi
- **Realtime Lobby**: Sinkronisasi pemain secara instan menggunakan Socket.io.
- **Daftar Lobby Publik**: Lihat dan bergabung ke room yang sedang aktif langsung dari menu utama.
- **Room Privat**: Buat room rahasia yang hanya bisa dimasuki menggunakan token unik.
- **Kapasitas Kustom**: Creator bisa mengatur kapasitas room (6-12 pemain) dan aksesibilitas (Public/Private).
- **Riwayat Permainan**: Pantau hasil pertandingan sebelumnya untuk melihat siapa yang mendominasi sistem.
- **Sistem Bot**: Tambahkan bot cerdas untuk melengkapi slot pemain atau sekadar berlatih.

### 2. Role & Mekanik Gameplay
Terdapat 6 role unik dengan kemampuan taktis:
- **🦠 Malware**: Menginfeksi node target tiap malam untuk menguasai sistem secara total.
- **🕵️ Security Analyst**: Melakukan *deep scan* pada target untuk mendeteksi tanda-tanda infiltrasi.
- **🛡️ Firewall**: Memberikan proteksi enkripsi pada pemain agar kebal dari serangan malam.
- **🧑‍💻 System Admin**: Memiliki akses darurat ke perintah `Restore` dan `Force Delete`.
- **💣 Logic Bomb**: Perangkat peledak balik; jika mati, akan membawa target yang dikunci bersamanya.
- **🙂 Regular User**: Unit dasar yang fokus pada analisis log chat dan pengambilan keputusan voting.

### 3. Pengalaman Visual & Audio Premium
- **Cyberpunk Aesthetics**: Antarmuka gelap dengan aksen neon, *scanline effects*, dan tactical particles.
- **Cinematic Overlays**: Animasi pembukaan kartu role, transisi fase siang/malam, dan layar kemenangan yang dramatis.
- **Audio Imersif**: Musik latar yang beradaptasi dengan situasi (Mysterious Day, Dark Night, Intense Voting).
- **Easter Eggs**: Efek khusus seperti simulasi Windows XP Error & BSOD saat Malware berhasil mengambil alih sistem.

---

## 🚀 Cara Menjalankan di Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) (Versi 18+)
- Akun [Supabase](https://supabase.com/) (Kredensial URL & Anon Key)

### Langkah Instalasi
1. Clone repository ini.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Konfigurasi Environment:
   - Buat file `.env` berdasarkan `.env.example`.
   - Masukkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` Anda.
4. Jalankan aplikasi:
   ```bash
   npm start
   ```
5. Akses: `http://localhost:3000/landing` (Gerbang Utama) atau `http://localhost:3000` (Langsung ke App).

---

## 🎮 Prosedur Operasi
1. **Inisiasi**: Masuk melalui Landing Page dan pilih **Enter Operation**.
2. **Setup**: Buat atau gabung room. Creator memastikan tim siap (minimal 6 pemain).
3. **Analisa**: Gunakan fase Siang untuk berdiskusi di chat dan mencari pola perilaku Malware.
4. **Eksekusi**: Lakukan voting di siang hari atau gunakan skill khusus di malam hari.
5. **Kemenangan**: Capai objektif tim Anda sebelum integritas sistem mencapai 0%!

---

*Cyberwolf dikembangkan untuk memberikan pengalaman deduksi sosial yang intens dengan tema teknologi yang kental.*
