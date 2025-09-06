import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const BASE_URL = process.env.BASE_URL || "https://khamsahotel.uz";
const EUR_TO_UZS = 14000;

// ✅ .env dan muhim qiymatlarni olish
const { OCTO_SHOP_ID, OCTO_SECRET, EMAIL_USER, EMAIL_PASS } = process.env;

if (!OCTO_SHOP_ID || !OCTO_SECRET || !EMAIL_USER || !EMAIL_PASS) {
  console.error("❌ .env fayldagi muhim qiymatlar yo‘q!");
  process.exit(1);
}

// ✅ Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS, // ❗️ App password bo'lishi kerak
  },
});

// ✅ Email yuboruvchi funksiya
async function sendEmail(to, subject, text) {
  if (!to || !subject || !text) {
    console.warn("⚠️ sendEmail: to, subject yoki text yo‘q");
    return;
  }

  try {
    const mailOptions = {
      from: `"Khamsa Hotel" <${EMAIL_USER}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email yuborildi:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email yuborishda xatolik:", err);
  }
}

// ✅ Middleware
app.use(
  cors({
    origin: [
      "https://khamsahotel.uz",
      "https://www.khamsahotel.uz",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

// ✅ To‘lov yaratish
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

    const paymentData = {
      octo_shop_id: Number(OCTO_SHOP_ID),
      octo_secret: OCTO_SECRET,
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

    const response = await fetch("https://secure.octo.uz/prepare_payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
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
    console.error("❌ create-payment xato:", error);
    res.status(500).json({ error: "Server xatosi" });
  }
});

app.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    await sendEmail(to, subject, text);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Email yuborilmadi:", err);
    res.status(500).json({ success: false, error: "Email yuborilmadi" });
  }
});

// ✅ Payment success (email shu yerda yuboriladi)
app.post("/success", async (req, res) => {
  console.log("➡️ /success ga kelgan body:", req.body);

  try {
    const { total_sum, description, custom_data } = req.body || {};

    if (custom_data?.email) {
      const amount = Math.round(total_sum / EUR_TO_UZS);

      await sendEmail(
        custom_data.email,
        "Information For Invoice",
        `Thank you for choosing to stay with us via Khamsahotel.uz!  Please be informed that we are a SLEEP LOUNGE located inside the airport within the transit area. In order to stay with us you must be in possession of a valid boarding pass departing from airport Tashkent. If your flight commences from Tashkent, kindly verify with your airline first if you can check-in early for your flight as you'll need to go through passport control and security before you may access our lounge. IMPORTANT NOTE:  We will never ask you for your credit card details, or share any messages with links with you via Khamsahotel.uz for online payments or reconfirmation of your reservation with sleep ’n fly. In case of any doubt about your booking status with us please check via the Khamsahotel.uz website or app only, call Khamsahotel.uz, or contact us directly on  998 95 877 24 24 tel.whatshapp.telegram , qonoqhotel@mail.ru for Tashkent International Airport reservations.  Your Reservations Team`,
        "Информация Для Счета",
        `Спасибо, что решили остановиться у нас через Khamsahotel.uz! Обратите внимание, что мы являемся SLEEP LOUNGE, расположенным в транзитной зоне аэропорта. Чтобы остановиться у нас, у вас должен быть действительный посадочный талон на вылет из аэропорта Ташкента. Если ваш рейс начинается в Ташкенте, пожалуйста, сначала уточните у своей авиакомпании, можете ли вы зарегистрироваться на рейс заранее, так как вам нужно будет пройти паспортный контроль и проверку безопасности, прежде чем вы сможете попасть в наш зал ожидания.
         ВАЖНОЕ ПРИМЕЧАНИЕ: Мы никогда не попросим вас предоставить данные вашей кредитной карты или передать вам какие-либо сообщения со ссылками через Khamsahotel.uz для онлайн-платежей или повторного подтверждения вашего бронирования с sleep ’n fly. В случае возникновения сомнений относительно статуса вашего бронирования у нас, пожалуйста, проверьте его только через веб-сайт или приложение Khamsahotel.uz, позвоните в Khamsahotel.uz или свяжитесь с нами напрямую по телефону 998 95 877 24 24 tel.whatshapp.telegram, qonoqhotel@mail.ru для бронирования в          международном аэропорту Ташкента. Ваша команда по бронированию`
      );

      await sendEmail(
        EMAIL_USER,
        "Yangi to‘lov - Khamsa Hotel",
        `Mijoz ${custom_data.email} ${description} uchun ${amount} EUR to‘lov qildi.`
      );
    }

    res.json({ status: "success", message: "Email yuborildi" });
  } catch (error) {
    console.error("❌ /success xatolik:", error);
    res.status(500).json({ error: "Email yuborilmadi" });
  }
});

// ✅ Callback fallback uchun qolgan
app.post("/payment-callback", async (req, res) => {
  console.log("🔁 Callback body:", req.body);
  res.json({ status: "callback received" });
});

// ✅ Server ishga tushdi
app.listen(PORT, () => {
  console.log(`✅ Backend ishga tushdi: ${BASE_URL} (port ${PORT})`);
});
