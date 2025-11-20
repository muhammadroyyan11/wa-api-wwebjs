# WhatsApp Web.js API

Integrasi WhatsApp dengan Node.js + Express + WhatsApp Web.js\
**Copyright © Muhammad Royyan Zamzami**

------------------------------------------------------------------------

## Deskripsi Project

Project ini adalah backend sederhana berbasis **Node.js + Express** yang
menggunakan **whatsapp-web.js** untuk menghubungkan aplikasi web Anda
dengan WhatsApp Web.

Fitur utama:

-   Generate QR untuk login WhatsApp\
-   Cek status koneksi WhatsApp\
-   Mendapatkan informasi profil WhatsApp (nama & nomor)\
-   Logout / reset session WhatsApp\
-   API berjalan lokal agar dapat diakses aplikasi Laravel

------------------------------------------------------------------------

## Instalasi

Clone repository:

``` bash
git clone https://github.com/muhammadroyyan11/wa-api-wwebjs.git
cd wa-api-wwebjs
```

Install dependencies:

``` bash
npm install
```

Library utama yang digunakan:

``` bash
npm install whatsapp-web.js qrcode-terminal express cors
```

Generate QR berbentuk gambar PNG:

``` bash
npm install qrcode
```

Jalankan server:

``` bash
node index.js
```

Server berjalan di:

    http://localhost:3000

------------------------------------------------------------------------

## API Endpoint Lengkap + Contoh Penggunaan

Berikut daftar endpoint yang tersedia BESERTA contoh request & response.

------------------------------------------------------------------------

### 🔹 1. GET /get-qr

Mengambil QR Code login WhatsApp dalam bentuk Base64 PNG.

**Contoh Request**\
GET http://localhost:3000/get-qr

**Contoh Response**

``` json
{
  "status": true,
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

Jika sudah login:

``` json
{
  "status": false,
  "message": "Device already connected."
}
```

------------------------------------------------------------------------

### 2. GET /wa-status

Cek apakah perangkat WA sudah terkoneksi.

**Contoh Request**\
GET http://localhost:3000/wa-status

**Contoh Response**

``` json
{
  "ready": true
}
```

Jika belum:

``` json
{
  "ready": false
}
```

------------------------------------------------------------------------

### 3. GET /wa-profile

Mengambil nama & nomor WhatsApp yang sudah login.

**Contoh Request**\
GET http://localhost:3000/wa-profile

**Contoh Response**

``` json
{
  "status": true,
  "name": "Muhammad Royyan",
  "number": "628123456789"
}
```

Jika belum login:

``` json
{
  "status": false,
  "message": "WhatsApp belum terkoneksi",
  "name": null,
  "number": null
}
```

------------------------------------------------------------------------

### 4. POST /send-message

Mengirim pesan WhatsApp ke nomor tertentu.

**Contoh Request**\
POST http://localhost:3000/send-message\
Content-Type: application/json

**Body:**

``` json
{
  "phone": "6281234567890",
  "message": "Hello ini pesan dari API!"
}
```

**Contoh Response**

``` json
{
  "status": true,
  "message": "Pesan berhasil dikirim!"
}
```

Jika gagal:

``` json
{
  "status": false,
  "error": "Nomor tidak ditemukan"
}
```

------------------------------------------------------------------------

### 5. GET /logout

Reset sesi WhatsApp & generate QR baru.

**Contoh Request**\
GET http://localhost:3000/logout

**Contoh Response**

``` json
{
  "status": true,
  "message": "Berhasil logout"
}
```
