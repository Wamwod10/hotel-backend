import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function sendEmail(to, subject, text) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // ⚠️ bu oddiy parol emas, Gmail App Password bo‘lishi kerak
      },
    });

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
    console.error("❌ Email yuborishda xatolik:", err);
    throw err;
  }
}

export default sendEmail;
