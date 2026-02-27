const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE CONFIG ---
const db = mysql.createPool({
    host: "103.245.39.246",
    user: "sneaker_app",
    password: "nnvJUxV6daN#CVJv",
    database: "jez_erp",
    waitForConnections: true,
    connectionLimit: 5
});

// --- STATE MANAGEMENT ---
let userState = {}; 
let lastMenuSent = {}; 
let latestQR = null;
let waReady = false;

// --- GLOBAL ERROR HANDLER ---
process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) return;
    console.error('Unhandled Rejection:', reason);
});

// --- FUNCTION: SEND MENU ---
const sendMenu = async (msg) => {
    const from = msg.from;
    const now = Date.now();
    
    // Cooldown 1 menit agar tidak spam menu otomatis
    if (lastMenuSent[from] && (now - lastMenuSent[from] < 60000) && !['menu','help'].includes(msg.body.toLowerCase())) {
        return; 
    }

    const menuText = `*📌 MENU UTAMA JEZ STORE*

1️⃣ *Cek Poin*
2️⃣ *Hubungi Customer Service*
3️⃣ *Informasi Toko*

_Ketik angka (1, 2, atau 3) untuk memilih._
_Ketik *Menu* kapan saja untuk kembali ke sini._`;

    try {
        await client.sendMessage(from, menuText);
        lastMenuSent[from] = now;
        userState[from] = "IDLE";
    } catch (e) {
        console.error("Error sending menu:", e.message);
    }
};

// --- WHATSAPP CLIENT INIT ---
const client = new Client({
    // LocalAuth menyimpan sesi di folder .wwebjs_auth agar tidak scan ulang
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
            "--disable-session-crashed-bubble"
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

// --- MESSAGE LOGIC (AUTO RESPONDER) ---
client.on('message', async (msg) => {
    if (msg.from.endsWith("@g.us") || msg.fromMe) return;

    try {
        const from = msg.from;
        const text = msg.body.trim();
        const lowerText = text.toLowerCase();
        
        if (!userState[from]) userState[from] = "IDLE";

        // 1. Logic Cek Poin (Waiting Phone)
        if (userState[from] === "WAITING_PHONE") {
            if (lowerText === 'batal' || lowerText === 'menu') {
                userState[from] = "IDLE";
                return await msg.reply("Permintaan dibatalkan.");
            }

            let phone = text.replace(/\D/g, "");
            if (phone.startsWith("62")) phone = "0" + phone.substring(2);

            if (phone.length < 9) {
                return await msg.reply("Nomor tidak valid. Masukkan nomor HP (atau ketik *Batal*):");
            }

            const [rows] = await db.query("SELECT cust_name, cust_point FROM ts_customers WHERE cust_phone = ? LIMIT 1", [phone]);
            userState[from] = "IDLE";
            
            if (rows.length === 0) {
                return await msg.reply("Nomor tidak ditemukan. Ketik *1* untuk coba lagi atau *Menu* untuk kembali.");
            }
            
            const cust = rows[0];
            return await msg.reply(`*Cek Poin*\n\nNama: ${cust.cust_name}\nPoin: *${cust.cust_point ?? 0}*`);
        }

        // 2. Logic Pilihan Menu
        if (text === "1") {
            userState[from] = "WAITING_PHONE";
            return await msg.reply("📞 Silakan masukkan nomor HP Anda:");
        } 
        
        if (text === "2") {
            return await msg.reply("👨‍💼 Hubungi CS: wa.me/628123456789");
        } 
        
        if (text === "3") {
            return await msg.reply("🏬 *JEZ Store*\nBuka: 09:00 - 21:00\nLokasi: Cabang Terdekat Anda.");
        }

        // 3. Logic Trigger Menu
        const triggers = ['menu', 'help', 'halo', 'hi', 'start', 'p'];
        if (triggers.includes(lowerText)) {
            return await sendMenu(msg);
        }

    } catch (error) {
        if (!error.message.includes('Execution context')) {
            console.error("Error in message handler:", error);
        }
    }
});

client.initialize();

// --- REST API ENDPOINTS ---

// 1. Get QR Code for Login
app.get("/get-qr", async (req, res) => {
    if (waReady) return res.json({ status: false, message: "Connected" });
    if (!latestQR) return res.json({ status: false, message: "Wait QR..." });
    const qrImage = await qrcode.toDataURL(latestQR);
    res.json({ status: true, qr: qrImage });
});

// 2. Check Status
app.get("/wa-status", (req, res) => {
    res.json({ ready: waReady });
});

// 3. Send Message (Digunakan oleh Laravel/POSV2)
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
            // Jika frame lepas/detached, coba lagi sampai 3x
            if (e.message.includes('detached Frame') && retryCount < 3) {
                console.log(`[RETRY] Detached frame detected, retrying (${retryCount + 1}/3)...`);
                await new Promise(r => setTimeout(r, 2000));
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

// --- START SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`📡 WhatsApp API Gateway running on port ${PORT}`);
});