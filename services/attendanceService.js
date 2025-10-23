const axios = require("axios");

class AttendanceService {
  constructor() {
    this.baseUrl = process.env.TIPSOI_BASE_URL;
    this.apiToken = process.env.TIPSOI_API_TOKEN;
    this.perPage = process.env.PER_PAGE || 500;
    this.lastSyncTime = null;
  }

  /**
   * Format date to TIPSOI API format (YYYY-MM-DD HH:MM:SS)
   */
  formatDateTime(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  /**
   * Get attendance data from TIPSOI API
   */
  async getAttendanceData(startTime, endTime, criteria = "sync_time") {
    try {
      const currentYear = new Date().getFullYear();
      const defaultStartTime = `${currentYear}-01-01T00:00:00`;
      const defaultEndTime = `${currentYear + 1}-12-31T23:59:59`;

      const params = {
        start: defaultStartTime,
        end: defaultEndTime,
        api_token: this.apiToken,
        per_page: this.perPage,
        criteria: criteria,
      };

      console.log(
        `Fetching attendance data from ${startTime.toISOString()} to ${endTime.toISOString()}`
      );

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 30000, // 30 second timeout
        headers: {
          Accept: "application/json",
          "User-Agent": "TIPSOI-Attendance-Sync/1.0",
        },
      });

      if (response.status !== 200) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const data = response.data;

      if (!data.data) {
        console.warn("No data field in API response");
        return {
          records: [],
          meta: data.meta || {},
          project: data.project || {},
        };
      }

      console.log(`Fetched ${data.data.length} attendance records`);
      return {
        records: data.data,
        meta: data.meta || {},
        project: data.project || {},
        links: data.links || {},
      };
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        throw new Error(
          "Request timeout - TIPSOI API took too long to respond"
        );
      } else if (error.response) {
        // The request was made and the server responded with a status code
        const status = error.response.status;
        const message =
          error.response.data?.message || error.response.statusText;
        throw new Error(`TIPSOI API error (${status}): ${message}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error("No response from TIPSOI API - network error");
      } else {
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  /**
   * Get recent attendance data (since last sync or last 24 hours)
   */
  async getRecentAttendanceData() {
    const endTime = new Date();
    let startTime;

    if (this.lastSyncTime) {
      // Get data since last sync
      startTime = new Date(this.lastSyncTime);
    } else {
      // First run - get data from last 24 hours
      startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    }

    const result = await this.getAttendanceData(startTime, endTime);

    // Update last sync time
    this.lastSyncTime = endTime;

    return result;
  }

  /**
   * Get attendance data for a specific date range
   */
  async getAttendanceDataForRange(startDate, endDate) {
    return await this.getAttendanceData(startDate, endDate);
  }

  /**
   * Validate attendance record structure
   */
  validateAttendanceRecord(record) {
    const requiredFields = [
      "uid",
      "sync_time",
      "logged_time",
      "type",
      "device_identifier",
      "person_identifier",
    ];

    for (const field of requiredFields) {
      if (!record[field]) {
        return false;
      }
    }

    // Validate attendance type
    if (!["card", "fingerprint", "face"].includes(record.type)) {
      return false;
    }

    return true;
  }

  /**
   * Process and clean attendance records
   */
  processAttendanceRecords(records, project = {}) {
    if (!Array.isArray(records)) {
      console.warn("Invalid records format - expected array");
      return [];
    }

    const processedRecords = records
      .filter((record) => this.validateAttendanceRecord(record))
      .map((record) => ({
        ...record,
        project: project,
        // Ensure all fields have default values
        rfid: record.rfid || "",
        location: record.location || "",
        primary_display_text: record.primary_display_text || "",
        secondary_display_text: record.secondary_display_text || "",
      }));

    console.log(
      `Processed ${processedRecords.length} valid records out of ${records.length} total`
    );

    if (processedRecords.length !== records.length) {
      console.warn(
        `Filtered out ${
          records.length - processedRecords.length
        } invalid records`
      );
    }

    return processedRecords;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 60 * 1000); // Last minute

      const result = await this.getAttendanceData(startTime, endTime);

      return {
        success: true,
        message: "Connection successful",
        recordCount: result.records.length,
        project: result.project,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error,
      };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      baseUrl: this.baseUrl,
      hasToken: !!this.apiToken,
      perPage: this.perPage,
      lastSyncTime: this.lastSyncTime,
      tokenPreview: this.apiToken
        ? `${this.apiToken.slice(0, 8)}...`
        : "Not set",
    };
  }
}

module.exports = AttendanceService;
