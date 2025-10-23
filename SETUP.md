# TIPSOI Attendance Sync Setup Guide

## Prerequisites

- Node.js installed
- Google account with access to Google Sheets
- TIPSOI API credentials

## 1. Install Dependencies

```bash
npm install
```

## 2. Google Sheets Setup

### Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

### Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Go to "Credentials" → "Create Credentials" → "Service Account"
5. Download the JSON key file and save it as `google-service-account-key.json` in your project root
6. Copy the service account email from the JSON file

### Share the Sheet

1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email with "Editor" permissions

## 3. Configure Environment Variables

Update your `.env` file:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_ID=your_actual_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY_PATH=./google-service-account-key.json
```

## 4. Test the Setup

Start the server:

```bash
npm start
```

Test the services:

```bash
curl http://localhost:3000/test
```

## 5. API Endpoints

- `GET /health` - Health check
- `GET /status` - Service status
- `GET /test` - Test all services
- `GET /data` - Get All Attendence services
- `POST /sync` - Manual sync
- `POST /sync/range` - Sync specific date range
- `POST /cron/start` - Start automatic sync
- `POST /cron/stop` - Stop automatic sync
- `GET /cron/status` - Check cron status

## 6. Production Setup

For production, update your `.env`:

```env
# Switch to live TIPSOI API
TIPSOI_BASE_URL=https://api-inovace360.com/api/v1/logs
TIPSOI_API_TOKEN=1537-b9c7-202e-2f8a-cfc3-412c-540c-66bf-8667-9c8c-8410-ebbb-ea4a-fdb7-aeea-5c1c

# For reseller (multiple projects):
# TIPSOI_BASE_URL=https://api-inovace360.com/reseller/api/v1/logs
# TIPSOI_API_TOKEN=18cd-52bc-aa33-bf70-45eb-6b01-59c2-d226-864d-5cf5-8e6d-176d-ee0d-9431-4da2-7e8c
```

## Features

✅ **Automatic Sync**: Runs every 5 minutes by default
✅ **Duplicate Prevention**: Checks existing UIDs before adding
✅ **Error Handling**: Comprehensive error handling and logging
✅ **Manual Control**: API endpoints for manual operations
✅ **Flexible**: Supports both single project and reseller APIs
✅ **Reliable**: Timeout handling and retry logic

The system will automatically:

- Fetch new attendance records from TIPSOI API
- Filter out duplicates
- Add new records to Google Sheets
- Log all operations for monitoring
