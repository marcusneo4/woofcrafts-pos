# Google Sheets Setup Instructions

The Google Sheets API doesn't allow write operations with just an API key. We need to use Google Apps Script as a web app to handle writes.

## Step-by-Step Setup

### 1. Open Your Google Sheet
Open your spreadsheet: https://docs.google.com/spreadsheets/d/16mQItKuqHE3EQ3c9RFS2uIRGpi6EgBVQhLL_9D9EeGg

### 2. Open Apps Script Editor
- Click **Extensions** → **Apps Script**
- A new tab will open with the Apps Script editor

### 3. Paste the Script
- Delete any existing code in the editor
- Open the file `google-apps-script.js` from this project
- Copy the entire contents
- Paste it into the Apps Script editor

### 4. Deploy as Web App
1. Click the **Deploy** button (top right)
2. Click **New deployment**
3. Click the gear icon ⚙️ next to "Select type"
4. Choose **Web app**
5. Configure:
   - **Execute as**: Me (your email)
   - **Who has access**: **Anyone** (IMPORTANT: Must be "Anyone" for CORS to work properly)
6. Click **Deploy**
7. Click **Authorize access** when prompted
   - You may need to click "Advanced" → "Go to [Project Name] (unsafe)" if you see a warning
   - Click "Allow" to grant permissions
8. **Copy the Web App URL** - it will look like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```
9. **IMPORTANT**: Test the URL by opening it directly in your browser. It should show JSON like:
   ```json
   {"success":true,"message":"WoofCrafts Google Sheets Web App is running!",...}
   ```
   If you see an error page or HTML instead, the deployment didn't work correctly.

### 5. Update Your Code
1. Open `js/sheets.js`
2. Find the `SHEETS_CONFIG` object
3. Add the `webAppUrl` property with your copied URL:
   ```javascript
   const SHEETS_CONFIG = {
       spreadsheetId: '16mQItKuqHE3EQ3c9RFS2uIRGpi6EgBVQhLL_9D9EeGg',
       webAppUrl: 'https://script.google.com/macros/s/YOUR_URL_HERE/exec',
       // ... rest of config
   };
   ```

### 6. Test It
1. Open `test-sheets.html` in your browser
2. Click "Test Initialize Sheets" - should succeed
3. Click "Test Save Order" - should save to your sheet
4. Check your Google Sheet - you should see the test order!

## Troubleshooting

### "Script function not found" error
- Make sure you deployed as a **Web app**, not an API executable
- Check that the script functions (`doPost`, `doGet`) are present

### "Authorization required" error
- Make sure you clicked "Authorize access" during deployment
- Try redeploying and authorizing again

### "Permission denied" error
- Check that "Who has access" is set to "Anyone" or "Anyone with Google account"
- Make sure the Web App URL is correct

### Orders not appearing in sheet
- Check the browser console (F12) for error messages
- Verify the spreadsheet ID is correct
- Make sure the sheet name is "Orders" (case-sensitive)

## Security Note

The web app URL allows anyone with the URL to write to your sheet. For production:
- Consider adding a simple authentication token
- Or restrict to "Anyone with Google account" and share the sheet appropriately
- Monitor your sheet for unauthorized access

## Updating the Script

If you need to update the script:
1. Make changes in Apps Script editor
2. Click **Deploy** → **Manage deployments**
3. Click the pencil icon ✏️ next to your deployment
4. Click **New version**
5. Click **Deploy**
6. The URL stays the same - no need to update your code!

