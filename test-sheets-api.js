// Quick test script for Google Sheets Web App
const SHEETS_CONFIG = {
    webAppUrl: 'https://script.google.com/macros/s/AKfycbzbLvxYjdKEtk15okVg65QriE_NfjaShbm-7Cu1RCPg_auO8JdsWdSsx6oFtQxGIleo/exec'
};

async function testWebApp() {
    console.log('🧪 Testing Google Sheets Web App...\n');
    
    // Test 1: GET request (should return success message)
    console.log('1. Testing GET request...');
    try {
        const getResponse = await fetch(SHEETS_CONFIG.webAppUrl);
        const responseText = await getResponse.text();
        console.log('Response status:', getResponse.status);
        console.log('Response headers:', Object.fromEntries(getResponse.headers.entries()));
        console.log('Response text (first 500 chars):', responseText.substring(0, 500));
        
        // Try to parse as JSON
        try {
            const getData = JSON.parse(responseText);
            console.log('✓ GET request successful (JSON):', getData);
        } catch (e) {
            console.log('⚠ Response is not JSON (might be HTML redirect or error page)');
        }
    } catch (error) {
        console.error('✗ GET request failed:', error.message);
    }
    
    // Test 2: Initialize sheets
    console.log('\n2. Testing sheet initialization...');
    try {
        const initResponse = await fetch(SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'initializeSheets' })
        });
        const initData = await initResponse.json();
        if (initData.success) {
            console.log('✓ Sheets initialized:', initData);
        } else {
            console.error('✗ Initialization failed:', initData);
        }
    } catch (error) {
        console.error('✗ Initialization error:', error.message);
    }
    
    // Test 3: Save test order
    console.log('\n3. Testing order save...');
    const testOrder = {
        orderId: 'TEST-' + Date.now(),
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerPhone: '123-456-7890',
        items: [
            { name: 'Test Product 1', quantity: 2, price: 10.00, subtotal: 20.00 },
            { name: 'Test Product 2', quantity: 1, price: 5.00, subtotal: 5.00 }
        ],
        subtotal: 25.00,
        discountAmount: 0,
        discountPercent: 0,
        total: 25.00
    };
    
    try {
        const saveResponse = await fetch(SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveOrder',
                orderDetails: testOrder
            })
        });
        const saveData = await saveResponse.json();
        if (saveData.success) {
            console.log('✓ Order saved successfully!');
            console.log('  Order ID:', saveData.orderId);
            console.log('  Response:', saveData);
        } else {
            console.error('✗ Save failed:', saveData);
        }
    } catch (error) {
        console.error('✗ Save error:', error.message);
    }
    
    console.log('\n✅ Testing complete!');
    console.log('Check your Google Sheet to verify the test order was saved.');
}

// Run the test
testWebApp().catch(console.error);

