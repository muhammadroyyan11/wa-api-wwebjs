const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { exec } = require('child_process');

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE ---
const db = mysql.createPool({
    host: "103.245.39.246",
    user: "sneaker_app",
    password: "nnvJUxV6daN#CVJv",
    database: "jez_erp",
    waitForConnections: true,
    connectionLimit: 5
});

// --- GLOBAL ERROR HANDLER ---
process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) return;
    console.error('Unhandled Rejection:', reason);
});

// --- STATE MANAGEMENT ---
let userState = {}; 
let lastMenuSent = {}; // Untuk mencegah spam menu (cooldown)

const sendMenu = async (msg) => {
    const from = msg.from;
    const now = Date.now();
    
    // Cooldown 1 menit: Jangan kirim menu jika sudah dikirim dalam 60 detik terakhir
    // kecuali user memang mengetik "menu"
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
        await msg.reply(menuText);
        lastMenuSent[from] = now;
        userState[from] = "IDLE";
    } catch (e) {
        console.error("Error sending menu:", e.message);
    }
};

let latestQR = null;
let waReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    }
});

// --- EVENTS ---
client.on("qr", (qr) => {
    latestQR = qr;
    waReady = false;
    qrcodeTerminal.generate(qr, { small: true });
});

client.on("ready", () => {
    waReady = true;
    console.log("WhatsApp Ready!");
});

// --- LOGIKA PESAN (FIXED) ---
client.on('message', async (msg) => {
    if (msg.from.endsWith("@g.us") || msg.fromMe) return;

    try {
        const from = msg.from;
        const text = msg.body.trim();
        const lowerText = text.toLowerCase();
        
        // Simpan state awal jika belum ada
        if (!userState[from]) userState[from] = "IDLE";

        // 1. JIKA SEDANG MENUNGGU NOMOR HP (CEK POIN)
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

        // 2. LOGIKA PILIHAN MENU (1, 2, 3)
        if (text === "1") {
            userState[from] = "WAITING_PHONE";
            return await msg.reply("📞 Silakan masukkan nomor HP Anda:");
        } 
        
        if (text === "2") {
            return await msg.reply("👨‍💼 Hubungi CS: wa.me/628123456789");
        } 
        
        if (text === "3") {
            return await msg.reply("🏬 *JEZ Store*\nBuka: 09:00 - 21:00\nLokasi: Jakarta.");
        }

        // 3. LOGIKA PEMICU MENU
        const triggers = ['menu', 'help', 'halo', 'hi', 'start', 'p'];
        if (triggers.includes(lowerText)) {
            return await sendMenu(msg);
        }

        // 4. JIKA CHAT RANDOM (Kaya "a", "l", "m")
        // JANGAN panggil sendMenu(msg) secara otomatis di sini agar tidak spam.
        // Kita diamkan saja atau beri tahu cara panggil menu.
        console.log(`Ignored message from ${from}: ${text}`);

    } catch (error) {
        if (!error.message.includes('Execution context')) {
            console.error("Error:", error);
        }
    }
});

client.initialize();

// --- API ---
app.get("/get-qr", async (req, res) => {
    if (waReady) return res.json({ status: false, message: "Connected" });
    if (!latestQR) return res.json({ status: false, message: "Wait QR..." });
    const qrImage = await qrcode.toDataURL(latestQR);
    res.json({ status: true, qr: qrImage });
});

app.listen(3000, () => console.log("📡 Server Running"));