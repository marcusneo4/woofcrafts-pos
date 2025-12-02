/**
 * Google Apps Script for WoofCrafts POS System
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/16mQItKuqHE3EQ3c9RFS2uIRGpi6EgBVQhLL_9D9EeGg
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click "Deploy" > "New deployment"
 * 5. Click the gear icon next to "Select type" and choose "Web app"
 * 6. Set:
 *    - Execute as: Me
 *    - Who has access: Anyone (or Anyone with Google account)
 * 7. Click "Deploy"
 * 8. Copy the Web App URL and update it in js/sheets.js (SHEETS_CONFIG.webAppUrl)
 * 9. Click "Authorize access" when prompted and allow permissions
 */

// Configuration
const SPREADSHEET_ID = '16mQItKuqHE3EQ3c9RFS2uIRGpi6EgBVQhLL_9D9EeGg';
const ORDERS_SHEET_NAME = 'Orders';
const PRODUCTS_SHEET_NAME = 'Products';

/**
 * Helper function to create CORS-enabled response
 */
function createCorsResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Main function to handle POST requests for saving orders
 */
function doPost(e) {
  try {
    // Handle empty post data
    if (!e.postData || !e.postData.contents) {
      return createCorsResponse({
        success: false,
        error: 'No data received'
      });
    }
    
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'saveOrder') {
      return saveOrder(data.orderDetails);
    } else if (data.action === 'initializeSheets') {
      return initializeSheets();
    } else {
      return createCorsResponse({
        success: false,
        error: 'Unknown action: ' + (data.action || 'none')
      });
    }
  } catch (error) {
    return createCorsResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return createCorsResponse({
    success: true,
    message: 'WoofCrafts Google Sheets Web App is running!',
    timestamp: new Date().toISOString(),
    spreadsheetId: SPREADSHEET_ID
  });
}

/**
 * Save order to Google Sheets
 */
function saveOrder(orderDetails) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(ORDERS_SHEET_NAME);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(ORDERS_SHEET_NAME);
      // Add headers
      sheet.getRange(1, 1, 1, 8).setValues([[
        'Timestamp', 'Order ID', 'Customer Name', 'Email', 'Phone', 'Items', 'Total', 'Discount'
      ]]);
      // Format header row
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      sheet.getRange(1, 1, 1, 8).setBackground('#f5f5f5');
    }
    
    // Ensure headers exist
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 8).setValues([[
        'Timestamp', 'Order ID', 'Customer Name', 'Email', 'Phone', 'Items', 'Total', 'Discount'
      ]]);
      sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      sheet.getRange(1, 1, 1, 8).setBackground('#f5f5f5');
    }
    
    // Prepare row data
    const timestamp = new Date().toISOString();
    const itemsText = orderDetails.items.map(item => 
      `${item.name} (Qty: ${item.quantity})`
    ).join('; ');
    
    const rowData = [
      timestamp,
      orderDetails.orderId || 'N/A',
      orderDetails.customerName || '',
      orderDetails.customerEmail || '',
      orderDetails.customerPhone || '',
      itemsText,
      `$${orderDetails.total.toFixed(2)}`,
      orderDetails.discountAmount > 0 ? `${orderDetails.discountPercent}%` : 'None'
    ];
    
    // Append row
    sheet.appendRow(rowData);
    
    return createCorsResponse({
      success: true,
      message: 'Order saved successfully',
      orderId: orderDetails.orderId,
      timestamp: timestamp
    });
    
  } catch (error) {
    return createCorsResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  }
}

/**
 * Initialize sheets with headers
 */
function initializeSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Initialize Orders sheet
    let ordersSheet = ss.getSheetByName(ORDERS_SHEET_NAME);
    if (!ordersSheet) {
      ordersSheet = ss.insertSheet(ORDERS_SHEET_NAME);
    }
    
    // Add headers if sheet is empty
    if (ordersSheet.getLastRow() === 0) {
      ordersSheet.getRange(1, 1, 1, 8).setValues([[
        'Timestamp', 'Order ID', 'Customer Name', 'Email', 'Phone', 'Items', 'Total', 'Discount'
      ]]);
      ordersSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
      ordersSheet.getRange(1, 1, 1, 8).setBackground('#f5f5f5');
    }
    
    return createCorsResponse({
      success: true,
      message: 'Sheets initialized successfully'
    });
    
  } catch (error) {
    return createCorsResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  }
}

