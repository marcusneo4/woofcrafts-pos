// Email Configuration for WoofCrafts POS System
require('dotenv').config();
const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.log('❌ Email configuration error:', error.message);
        console.log('💡 Make sure you have created a .env file with your email credentials');
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

module.exports = transporter;
