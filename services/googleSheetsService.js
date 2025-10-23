const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Load service account credentials
      const keyPath = process.env.GOOGLE_PRIVATE_KEY_PATH;
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Google service account key file not found: ${keyPath}`);
      }

      const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

      // Create JWT auth client
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Get sheets API instance
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.initialized = true;

      console.log('Google Sheets service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error.message);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async createHeaderRow() {
    await this.ensureInitialized();
    
    const headers = [
      'UID',
      'Sync Time',
      'Logged Time', 
      'Type',
      'Device ID',
      'Location',
      'Person ID',
      'RFID',
      'Primary Display',
      'Secondary Display',
      'Project Code',
      'Project Name',
      'Organization'
    ];

    try {
      // Check if headers already exist
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:M1'
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'A1:M1',
          valueInputOption: 'RAW',
          resource: {
            values: [headers]
          }
        });
        console.log('Header row created successfully');
      }
    } catch (error) {
      console.error('Error creating header row:', error.message);
      throw error;
    }
  }

  async getExistingUIDs() {
    await this.ensureInitialized();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:A' // Get all UIDs from column A
      });

      if (response.data.values && response.data.values.length > 1) {
        // Skip header row and extract UIDs
        return response.data.values.slice(1).map(row => row[0]).filter(uid => uid);
      }
      return [];
    } catch (error) {
      console.error('Error getting existing UIDs:', error.message);
      return [];
    }
  }

  async appendAttendanceData(attendanceRecords) {
    await this.ensureInitialized();
    
    if (!attendanceRecords || attendanceRecords.length === 0) {
      console.log('No attendance records to append');
      return;
    }

    try {
      // Get existing UIDs to avoid duplicates
      const existingUIDs = await this.getExistingUIDs();
      
      // Filter out records that already exist
      const newRecords = attendanceRecords.filter(record => !existingUIDs.includes(record.uid));
      
      if (newRecords.length === 0) {
        console.log('No new records to add');
        return;
      }

      // Convert attendance records to sheet rows
      const rows = newRecords.map(record => [
        record.uid,
        record.sync_time,
        record.logged_time,
        record.type,
        record.device_identifier,
        record.location,
        record.person_identifier,
        record.rfid || '',
        record.primary_display_text,
        record.secondary_display_text,
        record.project?.code || '',
        record.project?.name || '',
        record.project?.organization || ''
      ]);

      // Append new rows
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A:M',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: rows
        }
      });

      console.log(`Successfully added ${newRecords.length} new attendance records to Google Sheets`);
      return newRecords.length;
    } catch (error) {
      console.error('Error appending attendance data:', error.message);
      throw error;
    }
  }

  async clearSheet() {
    await this.ensureInitialized();
    
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: 'A:Z'
      });
      console.log('Sheet cleared successfully');
    } catch (error) {
      console.error('Error clearing sheet:', error.message);
      throw error;
    }
  }

  async getSheetInfo() {
    await this.ensureInitialized();
    
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      return {
        title: response.data.properties.title,
        sheetCount: response.data.sheets.length,
        url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`
      };
    } catch (error) {
      console.error('Error getting sheet info:', error.message);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;