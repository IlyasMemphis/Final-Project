const nodemailer = require("nodemailer");

async function sendEmail({ to, subject, html }) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true, // для Gmail всегда true
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to,
        subject,
        html
    });
}

module.exports = sendEmail;
