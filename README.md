# Cyberwolf - Realtime Social Deduction

Prototype game realtime bertema cybersecurity (mirip Werewolf) menggunakan `Node.js + Express + Socket.io`.

## Fitur yang sudah ada
- Login sederhana (username) + room code lobby.
- Token room otomatis saat pembuat room klik `Buat Room Otomatis`.
- Landing page menampilkan daftar lobby publik aktif untuk quick join.
- Realtime room sync antar player.
- Role assignment bisa dikustomisasi creator (jumlah Malware, Analyst, Defender, Logic Bomb, System Admin, dan User).
- Fase otomatis siang/malam dengan timer.
- Voting siang.
- Night action berbasis role.
- Status player alive/eliminated/protected.
- Chat global.
- Panel Status Operasi (ringkasan pemain + progres voting/aksi real-time).
- Win condition otomatis.

## Jalankan
```bash
npm install
npm start
```

Buka: `http://localhost:3000`

## Catatan
- Minimal player start: 6.
- Hanya pembuat room yang bisa menekan tombol mulai game.
- Durasi default: Siang 5 menit, Malam 50 detik (`server.js`, konstanta `CONFIG`).
- Creator bisa ubah durasi siang (1-15 menit) dan komposisi role di panel `Game Setup` saat fase lobby.
- Creator bisa mengatur akses lobby menjadi `public` atau `private`.
- Ini fondasi prototype. Untuk production disarankan tambah:
  - persistent database (MongoDB/MySQL)
  - auth JWT/Firebase
  - reconnect session
  - private chat channel khusus role
  - anti-cheat dan validasi lebih ketat
