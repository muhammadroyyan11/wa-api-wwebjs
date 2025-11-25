const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(cors());

// ========================================================
//   KONFIGURASI DATABASE
// ========================================================
const db = mysql.createPool({
    host: "103.245.39.246",
    user: "sneaker_app",
    password: "nnvJUxV6daN#CVJv",
    database: "jez_erp"
});

// ========================================================
//  WHATSAPP CLIENT SETUP
// ========================================================
let latestQR = null;
let waReady = false;

let waUserNumber = null;
let waUserName = null;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

// ========================================================
//            STATE PER USER
// ========================================================
let userState = {}; // contoh: userState["62812xxxx"] = "WAITING_PHONE";

// ========================================================
//            MENU UTAMA
// ========================================================
function getMainMenu() {
    return `
*📌 MENU UTAMA JEZ STORE*

1️⃣ Cek Poin
2️⃣ Hubungi Customer Service
3️⃣ Informasi Toko

Ketik angka pilihan:
1, 2, atau 3
    `;
}

// ========================================================
//            EVENT QR
// ========================================================
client.on("qr", (qr) => {
    latestQR = qr;
    waReady = false;
    console.log("QR Code updated, silakan scan ulang.");
});

// ========================================================
//            EVENT READY
// ========================================================
client.on("ready", () => {
    waReady = true;
    latestQR = null;
    console.log("WhatsApp Connected & Ready!");

    waUserNumber = client.info.wid.user;
    waUserName = client.info.pushname;

    console.log("Nomor:", waUserNumber);
    console.log("Nama:", waUserName);
});

// ========================================================
//            EVENT DISCONNECT
// ========================================================
client.on("disconnected", async (reason) => {
    console.log(" WhatsApp Disconnected:", reason);

    waReady = false;
    latestQR = null;

    const sessionPath = path.join(__dirname, ".wwebjs_auth");

    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log("Session dihapus, QR akan muncul kembali!");
    }

    setTimeout(() => {
        console.log("Restarting WhatsApp Client...");
        client.initialize();
    }, 1000);
});

client.initialize();

// ========================================================
//              HANDLE PESAN MASUK
// ========================================================
client.on('message', async (msg) => {
    const from = msg.from;

    // ============================================
    //   Hanya respon untuk chat personal
    // ============================================
    if (msg.from.endsWith("@g.us")) {
        return; // abaikan chat grup
    }

    const text = msg.body.trim().toLowerCase();

    // ============================================
    //   Jika user state sedang menunggu no HP
    // ============================================
    if (userState[from] === "WAITING_PHONE") {

        let phone = text.replace(/\D/g, "");

        // if (phone.startsWith("0")) {
        //     phone = "62" + phone.substring(1);
        // }

        if (phone.length < 9) {
            return msg.reply("❌ Nomor HP tidak valid. Masukkan ulang:");
        }

        try {
            const [rows] = await db.query(
                "SELECT * FROM ts_customers WHERE cust_phone = ? LIMIT 1",
                [phone]
            );

            if (rows.length === 0) {
                userState[from] = "IDLE";
                return msg.reply("❌ Nomor HP tidak ditemukan.");
            }

            const cust = rows[0];

            userState[from] = "IDLE";

            return msg.reply(
`🎉 *Cek Poin Berhasil!*

Nama : ${cust.cust_name}
HP   : ${cust.cust_phone}
Poin : *${cust.cust_point ?? 0}*

Terima kasih sudah menjadi pelanggan kami!`
            );

        } catch (err) {
            console.error(err);
            return msg.reply("⚠️ Terjadi kesalahan server.");
        }
    }

    // ============================================
    //   Pesan pertama user → kirim MENU
    // ============================================
    if (text !== "1" && text !== "2" && text !== "3") {
        return msg.reply(getMainMenu());
    }

    // ============================================
    //   MENU PILIHAN USER
    // ============================================

    // 1️⃣ CEK POIN
    if (text === "1") {
        userState[from] = "WAITING_PHONE";
        return msg.reply("Masukkan nomor HP yang terdaftar:");
    }

    // 2️⃣ CS
    if (text === "2") {
        return msg.reply("👨‍💼 *Menghubungkan ke Customer Service...*\nSilakan tunggu sebentar.");
    }

    // 3️⃣ Info toko
    if (text === "3") {
        return msg.reply(
`🏬 *Informasi Toko JEZ Store*

⏰ Jam Operasional:
Senin - Minggu, 09.00 - 21.00

📍 Alamat:
Jl. Contoh No. 123, Jakarta

Terima kasih!`
        );
    }
});

// ========================================================
//          API ENDPOINTS (JANGAN DIUBAH)
// ========================================================
app.get("/get-qr", async (req, res) => {
    if (waReady) {
        return res.json({
            status: false,
            message: "Device sudah terhubung."
        });
    }

    if (!latestQR) {
        return res.json({
            status: false,
            message: "Menunggu QR baru..."
        });
    }

    const qrImage = await qrcode.toDataURL(latestQR);

    res.json({
        status: true,
        qr: qrImage
    });
});

app.post("/send-message", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            status: false,
            error: "Phone dan message wajib diisi"
        });
    }

    // ============================
    // KONVERSI NOMOR KE FORMAT 62
    // ============================
    let cleaned = phone.replace(/\D/g, ""); // hapus semua non-digit

    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1);
    } else if (cleaned.startsWith("62")) {
        cleaned = cleaned;
    } else if (cleaned.startsWith("8")) {
        cleaned = "62" + cleaned;
    }

    let number = cleaned + "@c.us";

    // ============================

    try {
        await client.sendMessage(number, message);

        res.json({
            status: true,
            message: "Pesan berhasil dikirim!",
            to: cleaned
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.toString()
        });
    }
});

app.get("/wa-status", (req, res) => {
    res.json({
        ready: waReady
    });
});

app.get("/wa-profile", (req, res) => {

    if (!client.info) {
        return res.json({
            status: false,
            message: "WhatsApp belum terkoneksi",
            name: null,
            number: null
        });
    }

    const waUserNumber = client.info.wid.user;
    const waUserName = client.info.pushname;

    res.json({
        status: true,
        name: waUserName,
        number: waUserNumber
    });
});

// ========================================================
//   START SERVER
// ========================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`WA API running on port ${PORT}`);
});
