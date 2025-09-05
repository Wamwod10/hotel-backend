import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password bo‘lishi kerak
  },
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
    console.error("❌ Email yuborishda xatolik:", err);
    throw err;
  }
}

export default sendEmail;
