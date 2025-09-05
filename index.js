import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import sendEmail from "./gmail.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

// Frontenddagi .env da siz VITE_API_BASE_URL deb yozgan ekansiz, backend uchun esa oddiy BASE_URL.
// Shuning uchun bu yerda BASE_URL o‘zgaruvchisini o‘qib olamiz.
const BASE_URL = process.env.BASE_URL || "https://khamsahotel.uz";

if (!process.env.OCTO_SHOP_ID || !process.env.OCTO_SECRET || !process.env.EMAIL_USER) {
  console.error("❌ .env fayldagi muhim qiymatlar yetishmayapti.");
  process.exit(1);
}

const OCTO_API_URL = "https://secure.octo.uz/prepare_payment";
const SHOP_ID = process.env.OCTO_SHOP_ID;
const SECRET_KEY = process.env.OCTO_SECRET;
const EUR_TO_UZS = 14000;

app.use(
  cors({
    origin: [
      "https://khamsahotel.uz",
      "https://www.khamsahotel.uz",
      // Agar frontendingiz renderda joylashgan bo‘lsa, quyidagilarni ham qo‘shing:
      "https://your-frontend-url.onrender.com"
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

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

app.post("/payment-callback", async (req, res) => {
  try {
    const { total_sum, description, custom_data } = req.body;

    if (custom_data?.email) {
      const amount = Math.round(total_sum / EUR_TO_UZS);

      await sendEmail(
        custom_data.email,
        "To'lov tasdiqlandi - Khamsa Hotel",
        `Hurmatli mijoz, siz "${description}" uchun ${amount} EUR miqdorida to'lov amalga oshirdingiz. Rahmat!`
      );

      await sendEmail(
        process.env.EMAIL_USER,
        "Yangi to'lov - Khamsa Hotel",
        `Mijoz ${custom_data.email} ${description} uchun ${amount} EUR to'lov qildi.`
      );
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("❌ Callback xatosi:", error);
    res.status(500).json({ error: "Callback ishlamadi" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend ishga tushdi: ${BASE_URL} (port ${PORT})`);
});
