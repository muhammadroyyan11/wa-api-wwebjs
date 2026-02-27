const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

let latestQR = null;
let waReady = false;

// --- GLOBAL ERROR HANDLER ---
process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) return;
    console.error('Unhandled Rejection:', reason);
});

// --- WHATSAPP CLIENT INIT ---
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-js/main/dist/wppconnect-wa.js',
    },
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox", 
            "--disable-setuid-sandbox", 
            "--disable-dev-shm-usage",
            "--disable-session-crashed-bubble",
            "--disable-accelerated-2d-canvas",
            "--no-zygote",
            "--disable-gpu"
        ]
    }
});

// --- CLIENT EVENTS ---
client.on("qr", (qr) => {
    latestQR = qr;
    waReady = false;
    console.log("QR Code received, please scan:");
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('✅ Sesi ditemukan! Sedang menyambungkan...');
});

client.on("ready", () => {
    waReady = true;
    latestQR = null;
    console.log("🚀 WhatsApp Ready & Connected!");
});

client.on('auth_failure', (msg) => {
    console.error('❌ Sesi gagal dimuat, silakan scan ulang:', msg);
    waReady = false;
});

// Info: client.on('message') sengaja tidak dipasang agar hemat resource

client.initialize();

// --- REST API ENDPOINTS ---

app.get("/get-qr", async (req, res) => {
    if (waReady) return res.json({ status: false, message: "Connected" });
    if (!latestQR) return res.json({ status: false, message: "Wait QR..." });
    const qrImage = await qrcode.toDataURL(latestQR);
    res.json({ status: true, qr: qrImage });
});

app.get("/wa-status", (req, res) => {
    res.json({ ready: waReady });
});

app.post("/send-message", async (req, res) => {
    const { phone, message } = req.body;

    if (!waReady) {
        return res.status(503).json({ status: false, error: "WhatsApp is Offline" });
    }

    const trySend = async (retryCount = 0) => {
        try {
            let number = phone.replace(/\D/g, "");
            if (number.startsWith("0")) number = "62" + number.substring(1);
            const chatId = number + "@c.us";

            await client.sendMessage(chatId, message);
            return { success: true };
        } catch (e) {
            // Logic Retry jika frame detached
            if ((e.message.includes('detached Frame') || e.message.includes('Execution context')) && retryCount < 3) {
                console.log(`[RETRY] Terjadi gangguan browser, mencoba lagi (${retryCount + 1}/3)...`);
                await new Promise(r => setTimeout(r, 3000)); // Jeda 3 detik
                return trySend(retryCount + 1);
            }
            throw e;
        }
    };

    try {
        await trySend();
        console.log(`[API] Pesan terkirim ke: ${phone}`);
        res.json({ status: true, message: "Pesan berhasil dikirim!" });
    } catch (e) {
        console.error("[API] Gagal kirim pesan:", e.message);
        res.status(500).json({ status: false, error: e.toString() });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`📡 WhatsApp API Gateway (Send Only) running on port ${PORT}`);
});