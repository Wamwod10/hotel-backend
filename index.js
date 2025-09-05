import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const BASE_URL = process.env.BASE_URL || "https://khamsahotel.uz";

if (
  !process.env.OCTO_SHOP_ID ||
  !process.env.OCTO_SECRET ||
  !process.env.EMAIL_USER ||
  !process.env.EMAIL_PASS
) {
  console.error("❌ .env fayldagi muhim qiymatlar yetishmayapti.");
  process.exit(1);
}

const OCTO_API_URL = "https://secure.octo.uz/prepare_payment";
const SHOP_ID = process.env.OCTO_SHOP_ID;
const SECRET_KEY = process.env.OCTO_SECRET;
const EUR_TO_UZS = 14000;

// Nodemailer konfiguratsiyasi
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL orqali
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password bo‘lishi kerak!
  },
});

// SMTP server bilan bog'lanishni tekshirish
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP konfiguratsiyasi xatosi:", error);
  } else {
    console.log("✅ SMTP server bilan ulanish muvaffaqiyatli.");
  }
});

async function sendEmail(to, subject, text) {
  if (!to || !subject || !text) {
    console.warn("⚠️ sendEmail: to, subject yoki text yo‘q");
    return;
  }

  try {
    const mailOptions = {
      from: `"Khamsa Hotel" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email yuborildi:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email yuborishda xatolik:", err.message);
    console.error(err);
    throw err;
  }
}

app.use(
  cors({
    origin: [
      "https://khamsahotel.uz",
      "https://www.khamsahotel.uz",
      "https://your-frontend-url.onrender.com", // kerak bo‘lsa frontend URL ni o‘zgartiring
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // callback uchun qo‘shimcha

// To‘lov yaratish endpointi
app.post("/create-payment", async (req, res) => {
  try {
    const { amount, description = "Mehmonxona to'lovi", email } = req.body;

    if (!amount || typeof amount !== "number") {
      return res.status(400).json({ error: "Noto‘g‘ri amount qiymati" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email kiritilishi shart" });
    }

    const amountUZS = Math.round(amount * EUR_TO_UZS);

    const body = {
      octo_shop_id: Number(SHOP_ID),
      octo_secret: SECRET_KEY,
      shop_transaction_id: Date.now().toString(),
      auto_capture: true,
      test: false,
      init_time: new Date().toISOString().replace("T", " ").substring(0, 19),
      total_sum: amountUZS,
      currency: "UZS",
      description: `${description} (${amount} EUR)`,
      return_url: `${BASE_URL}/success`,
      notify_url: `${BASE_URL}/payment-callback`,
      language: "uz",
      custom_data: { email },
    };

    const response = await fetch(OCTO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("❌ Octo noto‘g‘ri javob:", text);
      return res.status(500).json({ error: "Octo noto‘g‘ri javob" });
    }

    if (data.error === 0 && data.data?.octo_pay_url) {
      return res.json({ paymentUrl: data.data.octo_pay_url });
    } else {
      return res.status(400).json({ error: data.errMessage || "Octo xatosi" });
    }
  } catch (error) {
    console.error("❌ To'lov yaratishda xato:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Callback endpoint (to‘lov tasdiqlangandan keyin Octo tomonidan chaqiriladi)
app.post("/payment-callback", async (req, res) => {
  console.log("📩 Callback body:", req.body);

  try {
    const { total_sum, description, custom_data } = req.body;

    if (!custom_data || !custom_data.email) {
      console.warn("⚠️ Callbackda custom_data.email mavjud emas!", req.body);
      return res.status(400).json({ error: "custom_data.email mavjud emas" });
    }

    const amount = Math.round(total_sum / EUR_TO_UZS);

    // Mijozga tasdiq xabari
    await sendEmail(
      custom_data.email,
      "To'lov tasdiqlandi - Khamsa Hotel",
      `Hurmatli mijoz, siz "${description}" uchun ${amount} EUR miqdorida to'lov amalga oshirdingiz. Rahmat!`
    );

    // Administratorga xabar
    await sendEmail(
      process.env.EMAIL_USER,
      "Yangi to'lov - Khamsa Hotel",
      `Mijoz ${custom_data.email} ${description} uchun ${amount} EUR to'lov qildi.`
    );

    res.json({ status: "ok" });
  } catch (error) {
    console.error("❌ Callback xatosi:", error);
    res.status(500).json({ error: "Callback ishlamadi" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend ishga tushdi: ${BASE_URL} (port ${PORT})`);
});
