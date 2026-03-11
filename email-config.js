// Email Configuration for WoofCrafts POS System
require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Create and optionally verify the Nodemailer transporter used for sending emails.
 * @returns {import('nodemailer').Transporter} Configured Nodemailer transporter instance.
 * @throws {Error} When mandatory environment variables are missing.
 */
function createEmailTransporter() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
        throw new Error('[EmailConfig] EMAIL_USER and EMAIL_PASS must be set in the environment');
    }

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    const shouldVerifyOnBoot = String(process.env.EMAIL_VERIFY_ON_BOOT || 'true').toLowerCase() === 'true';

    if (shouldVerifyOnBoot) {
        transporter.verify((error) => {
            if (error) {
                console.log('[EmailConfig] ❌ Email configuration error:', error.message);
                console.log('[EmailConfig] 💡 Check EMAIL_HOST/PORT/USER/PASS and app-password settings.');
            } else {
                console.log('[EmailConfig] ✅ Email server is ready to send messages');
            }
        });
    }

    return transporter;
}

module.exports = createEmailTransporter();
