# WhatsApp Gateway API - POSV2

> Integrasi WhatsApp dengan Node.js + Express + WhatsApp Web.js.
> Sistem ini mendukung notifikasi otomatis untuk ekosistem **JEZ Store**.

**Copyright © 2026 Muhammad Royyan Zamzami**

---

## 🚀 Fitur Utama

- **Auto-Scan QR** — Generate QR Code via API dalam format Base64.
- **Auto-Responder** — Cek poin pelanggan otomatis via database `jez_erp`.
- **Anti-Crash** — Penanganan error `Execution Context Destroyed` saat navigasi.
- **Persistence** — Sesi tersimpan otomatis menggunakan `LocalAuth`.

---

## ⚙️ Instalasi

**1. Clone Repository:**
```bash
git clone https://github.com/muhammadroyyan11/wa-api-wwebjs.git
cd wa-api-wwebjs
```

**2. Install Dependencies:**
```bash
npm install
```

**3. Jalankan Server:**
```bash
node app.js
```

Server berjalan di: `http://localhost:3000`

---

## 🔌 Dokumentasi API & Cara Hit

### 🔹 1. Mendapatkan QR Code

Digunakan untuk proses login awal. Jika perangkat sudah terkoneksi, API akan memberitahu bahwa perangkat sudah siap.

- **URL:** `http://localhost:3000/get-qr`
- **Method:** `GET`

**Cara Hit (JavaScript/Fetch):**
```javascript
// Contoh di React/Web Frontend
const loadQR = async () => {
  try {
    const response = await fetch('http://localhost:3000/get-qr');
    const data = await response.json();

    if (data.status) {
      // data.qr berisi string Base64 image
      document.getElementById('qr-container').src = data.qr;
    } else {
      console.log("Status:", data.message); // "Connected"
    }
  } catch (err) {
    console.error("Gagal mengambil QR:", err);
  }
};
```

---

### 🔹 2. Mengirim Pesan WhatsApp

Endpoint untuk mengirim notifikasi manual atau pesan sistem.

- **URL:** `http://localhost:3000/send-message`
- **Method:** `POST`

**Body (JSON):**
```json
{
  "phone": "08123456789",
  "message": "Halo! Pesanan Anda di JEZ Store sudah siap."
}
```

---

### 🔹 3. Cek Status Koneksi

Mengecek apakah sesi WhatsApp masih aktif.

- **URL:** `http://localhost:3000/wa-status`
- **Method:** `GET`

**Response:**
```json
{
  "ready": true
}
```

---

## 🤖 Logika Bot (Auto-Response)

Bot memiliki fitur otomatis **tanpa perlu di-hit API** untuk fungsi berikut:

| Input    | Hasil                                              |
|----------|----------------------------------------------------|
| `Menu`   | Menampilkan Menu Utama                             |
| `1`      | Masuk ke mode `WAITING_PHONE` (Cek Poin)           |
| Nomor HP | Menampilkan Nama & Poin dari DB `jez_erp`          |
| `2`      | Memberikan link CS WhatsApp                        |

---

## 🛠 Maintenance

- **Commit Format:** `[POSV2] - <keterangan>`
- **Clear Session:** Jika terjadi kendala login, hapus folder `.wwebjs_auth` dan restart server.

```bash
rm -rf .wwebjs_auth
node app.js
```