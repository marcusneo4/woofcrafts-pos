// Google Sheets Integration for WoofCrafts POS System
// This stores order data in Google Sheets

// Google Sheets API Configuration
// You'll need to set up a Google Cloud Project and enable Sheets API
const SHEETS_CONFIG = {
    spreadsheetId: '16mQItKuqHE3EQ3c9RFS2uIRGpi6EgBVQhLL_9D9EeGg', // Get this from your Google Sheets URL
    apiKey: 'AIzaSyAD38FRzpAwx7Sy98-AhTZ3XL7G_SlBm_s', // Get from Google Cloud Console
    range: 'Orders!A:H' // Sheet name and range (added Order ID column)
};

/**
 * Save order to Google Sheets
 * @param {Object} orderDetails - Order information
 */
async function saveOrderToSheets(orderDetails) {
    // Check if Sheets is configured
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        console.log('Google Sheets not configured. Order data:', orderDetails);
        return;
    }

    try {
        const timestamp = new Date().toISOString();
        const itemsText = orderDetails.items.map(item => 
            `${item.name} (Qty: ${item.quantity})`
        ).join('; ');

        // Prepare row data
        const rowData = [
            timestamp,
            orderDetails.orderId || 'N/A',
            orderDetails.customerName,
            orderDetails.customerEmail,
            orderDetails.customerPhone || '',
            itemsText,
            `$${orderDetails.total.toFixed(2)}`,
            orderDetails.discountAmount > 0 ? `${orderDetails.discountPercent}%` : 'None'
        ];

        // Use Google Sheets API v4 to append row
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/${SHEETS_CONFIG.range}:append?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                values: [rowData]
            })
        });

        if (!response.ok) {
            throw new Error(`Sheets API error: ${response.statusText}`);
        }

        console.log('Order saved to Google Sheets successfully');
        return await response.json();
    } catch (error) {
        console.error('Error saving to Google Sheets:', error);
        // Don't throw - allow email to still be sent even if Sheets fails
    }
}

/**
 * Initialize Google Sheets - creates headers if sheet doesn't exist
 * Call this once to set up your sheet
 */
async function initializeSheets() {
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        console.log('Please configure Google Sheets first');
        return;
    }

    try {
        // Check if headers exist, if not create them
        const headers = [
            ['Timestamp', 'Order ID', 'Customer Name', 'Email', 'Phone', 'Items', 'Total', 'Discount']
        ];

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Orders!A1:H1?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
        
        const checkResponse = await fetch(url);
        if (!checkResponse.ok) {
            // Sheet might not exist, create headers
            const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Orders!A1:H1?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
            await fetch(createUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: headers })
            });
            console.log('Google Sheets headers created');
        }
    } catch (error) {
        console.error('Error initializing Google Sheets:', error);
    }
}

