// Test if .env file is loading correctly
require('dotenv').config();

console.log('\n=== Testing .env Configuration ===\n');

console.log('EMAIL_HOST:', process.env.EMAIL_HOST || '❌ NOT SET');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || '❌ NOT SET');
console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌ NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ SET (hidden)' : '❌ NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || '❌ NOT SET');

console.log('\n=================================\n');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('❌ ERROR: Email credentials not loaded from .env file\n');
    console.log('Possible solutions:');
    console.log('1. Make sure .env file exists in project root');
    console.log('2. Check .env file format (no quotes around values)');
    console.log('3. Restart the server after creating .env');
    console.log('4. Try removing spaces from the App Password\n');
} else {
    console.log('✅ All email credentials loaded successfully!\n');
}
