// Google Sheets Integration for WoofCrafts POS System
// This stores order data and products in Google Sheets
// 
// IMPORTANT: This uses Google Apps Script as a web app to write to sheets
// See GOOGLE_SHEETS_SETUP.md for setup instructions

const SHEETS_CONFIG = {
    spreadsheetId: '16mQItKuqHE3EQ3c9RFS2uIRGpi6EgBVQhLL_9D9EeGg', // Get this from your Google Sheets URL
    webAppUrl: 'https://script.google.com/macros/s/AKfycbzbLvxYjdKEtk15okVg65QriE_NfjaShbm-7Cu1RCPg_auO8JdsWdSsx6oFtQxGIleo/exec', // Get this from Google Apps Script deployment (see GOOGLE_SHEETS_SETUP.md)
    // Legacy API key (only used for read operations if needed)
    apiKey: 'AIzaSyAD38FRzpAwx7Sy98-AhTZ3XL7G_SlBm_s',
    range: 'Orders!A:H', // Sheet name and range (added Order ID column)
    productsRange: 'Products!A:E' // Products sheet range
};

/**
 * Save order to Google Sheets using Google Apps Script web app
 * @param {Object} orderDetails - Order information
 */
async function saveOrderToSheets(orderDetails) {
    // Check if Sheets is configured
    if (!SHEETS_CONFIG.webAppUrl || SHEETS_CONFIG.webAppUrl === '') {
        console.warn('Google Sheets Web App URL not configured. See GOOGLE_SHEETS_SETUP.md for setup instructions.');
        console.log('Order data (not saved):', orderDetails);
        return;
    }

    try {
        // First, ensure Orders sheet exists and has headers
        await initializeSheets();

        console.log('Saving order to Google Sheets via Web App...', {
            orderId: orderDetails.orderId,
            customerEmail: orderDetails.customerEmail
        });

        // Send order to Google Apps Script web app
        const response = await fetch(SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'saveOrder',
                orderDetails: orderDetails
            })
        });

        // Get response as text first to handle both JSON and HTML responses
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            // If response is not JSON, it might be an HTML error page
            console.error('Web app returned non-JSON response:', responseText.substring(0, 500));
            throw new Error(`Web app returned invalid response. Make sure the web app is properly deployed and accessible. Response: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok || !responseData.success) {
            console.error('Sheets Web App error response:', responseData);
            throw new Error(`Sheets error: ${responseData.error || response.statusText}`);
        }

        console.log('Order saved to Google Sheets successfully:', responseData);
        return responseData;
    } catch (error) {
        console.error('Error saving to Google Sheets:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            orderDetails: orderDetails
        });
        // Re-throw so the calling code can handle it appropriately
        // The app.js already has a try-catch that won't block email sending
        throw error;
    }
}

/**
 * Initialize Google Sheets - creates headers if sheet doesn't exist
 * Uses Google Apps Script web app if configured, otherwise skips
 */
async function initializeSheets() {
    // If web app is not configured, skip initialization
    if (!SHEETS_CONFIG.webAppUrl || SHEETS_CONFIG.webAppUrl === '') {
        console.log('Google Sheets Web App not configured. Skipping initialization.');
        return;
    }

    try {
        console.log('Initializing Google Sheets...');
        
        // Call the web app to initialize sheets
        const response = await fetch(SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'initializeSheets'
            })
        });

        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.warn('Web app returned non-JSON response during initialization:', responseText.substring(0, 200));
            return; // Non-critical, continue anyway
        }

        if (response.ok && responseData.success) {
            console.log('Google Sheets initialized successfully');
        } else {
            console.warn('Sheets initialization warning:', responseData.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error initializing Google Sheets:', error);
        // Don't throw - allow order saving to continue
    }
}

/**
 * Load all products from Google Sheets
 * @returns {Array} Array of product objects
 */
async function loadProductsFromSheets() {
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        console.log('Google Sheets not configured. Loading from localStorage fallback.');
        const storedProducts = localStorage.getItem('woofcrafts_products');
        return storedProducts ? JSON.parse(storedProducts) : [];
    }

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Products!A2:E?key=${SHEETS_CONFIG.apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            // If Products sheet doesn't exist, return empty array
            if (response.status === 400) {
                console.log('Products sheet not found. Will create on first save.');
                return [];
            }
            throw new Error(`Sheets API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.values || data.values.length === 0) {
            return [];
        }

        // Convert sheet rows to product objects
        const products = data.values.map(row => ({
            id: row[0] || '',
            name: row[1] || '',
            price: parseFloat(row[2]) || 0,
            category: row[3] || 'general',
            image: row[4] || ''
        })).filter(p => p.id && p.name); // Filter out invalid products

        console.log(`Loaded ${products.length} products from Google Sheets`);
        return products;
    } catch (error) {
        console.error('Error loading products from Google Sheets:', error);
        // Fallback to localStorage
        const storedProducts = localStorage.getItem('woofcrafts_products');
        return storedProducts ? JSON.parse(storedProducts) : [];
    }
}

/**
 * Save a product to Google Sheets
 * @param {Object} product - Product object
 */
async function saveProductToSheets(product) {
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        console.log('Google Sheets not configured. Saving to localStorage fallback.');
        return;
    }

    try {
        // First, ensure Products sheet exists and has headers
        await initializeProductsSheet();

        // Check if product already exists (by ID)
        const existingProducts = await loadProductsFromSheets();
        const existingIndex = existingProducts.findIndex(p => p.id === product.id);

        const rowData = [
            product.id,
            product.name,
            product.price.toString(),
            product.category || 'general',
            product.image
        ];

        if (existingIndex !== -1) {
            // Update existing product (row index + 2 because of header and 0-based index)
            const rowNumber = existingIndex + 2;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Products!A${rowNumber}:E${rowNumber}?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
            
            await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [rowData] })
            });
            console.log('Product updated in Google Sheets');
        } else {
            // Append new product
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/${SHEETS_CONFIG.productsRange}:append?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
            
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: [rowData] })
            });
            console.log('Product saved to Google Sheets');
        }
    } catch (error) {
        console.error('Error saving product to Google Sheets:', error);
        // Don't throw - allow fallback to localStorage
    }
}

/**
 * Delete a product from Google Sheets
 * @param {string} productId - Product ID to delete
 */
async function deleteProductFromSheets(productId) {
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        console.log('Google Sheets not configured. Deleting from localStorage fallback.');
        return;
    }

    try {
        const products = await loadProductsFromSheets();
        const productIndex = products.findIndex(p => p.id === productId);
        
        if (productIndex === -1) {
            console.log('Product not found in Google Sheets');
            return;
        }

        // Note: Google Sheets API doesn't have a direct delete endpoint for rows
        // We'll need to use batchUpdate or clear the row
        // For simplicity, we'll clear the row content
        const rowNumber = productIndex + 2; // +2 for header and 0-based index
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Products!A${rowNumber}:E${rowNumber}?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
        
        await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [['', '', '', '', '']] }) // Clear row
        });
        console.log('Product deleted from Google Sheets');
    } catch (error) {
        console.error('Error deleting product from Google Sheets:', error);
    }
}

/**
 * Initialize Products sheet with headers
 */
async function initializeProductsSheet() {
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        return;
    }

    try {
        // Check if headers exist
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Products!A1:E1?key=${SHEETS_CONFIG.apiKey}`;
        const checkResponse = await fetch(url);
        
        if (!checkResponse.ok) {
            // Create headers
            const headers = [['ID', 'Name', 'Price', 'Category', 'Image']];
            const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Products!A1:E1?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
            
            await fetch(createUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: headers })
            });
            console.log('Products sheet headers created');
        }
    } catch (error) {
        console.error('Error initializing Products sheet:', error);
    }
}

/**
 * Save all products to Google Sheets (sync function)
 * @param {Array} products - Array of product objects
 */
async function saveAllProductsToSheets(products) {
    if (SHEETS_CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID') {
        console.log('Google Sheets not configured. Saving to localStorage fallback.');
        return;
    }

    try {
        await initializeProductsSheet();
        
        // Clear existing data (except header) and write all products
        // First, get current data to know how many rows to clear
        const existingProducts = await loadProductsFromSheets();
        
        // Prepare all product rows
        const rows = products.map(product => [
            product.id,
            product.name,
            product.price.toString(),
            product.category || 'general',
            product.image
        ]);

        // If we have products, write them all at once
        if (rows.length > 0) {
            // Clear existing data first (write empty rows)
            if (existingProducts.length > 0) {
                const clearRange = `Products!A2:E${existingProducts.length + 1}`;
                const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/${clearRange}?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
                await fetch(clearUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: [] })
                });
            }

            // Write all products
            const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.spreadsheetId}/values/Products!A2:E?valueInputOption=RAW&key=${SHEETS_CONFIG.apiKey}`;
            await fetch(writeUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: rows })
            });
            console.log(`Synced ${products.length} products to Google Sheets`);
        }
    } catch (error) {
        console.error('Error syncing products to Google Sheets:', error);
    }
}

