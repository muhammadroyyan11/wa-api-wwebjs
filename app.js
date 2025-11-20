const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// VAR
let latestQR = null;
let waReady = false;

let waUserNumber = null;
let waUserName = null;

// WA CLIENT CONFIG
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

// EVENT: QR MUNCUL
client.on("qr", (qr) => {
    latestQR = qr;
    waReady = false;
    console.log("QR Code updated, silakan scan ulang.");
});

// EVENT: SIAP DIPAKAI
client.on("ready", () => {
    waReady = true;
    latestQR = null;
    console.log("WhatsApp Connected & Ready!");

    waUserNumber = client.info.wid.user;
    waUserName = client.info.pushname;

    console.log("Nomor:", waUserNumber);
    console.log("Nama:", waUserName);
});

// EVENT: CLIENT DISCONNECT
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

// GET QR
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

// SEND MESSAGE API
app.post("/send-message", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            status: false,
            error: "Phone dan message wajib diisi"
        });
    }

    let number = phone.replace(/\D/g, '') + "@c.us";

    try {
        await client.sendMessage(number, message);

        res.json({
            status: true,
            message: "Pesan berhasil dikirim!"
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.toString()
        });
    }
});

// WA STATUS
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


// START SERVER
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`WA API port ${PORT}`);
});
