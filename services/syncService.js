const cron = require("node-cron");
const AttendanceService = require("./attendanceService");
const GoogleSheetsService = require("./googleSheetsService");

class SyncService {
  constructor() {
    this.attendanceService = new AttendanceService();
    this.googleSheetsService = new GoogleSheetsService();
    this.cronJob = null;
    this.isRunning = false;
    this.lastSyncResult = null;
    this.syncInterval = process.env.SYNC_INTERVAL || "*/5 * * * *"; // Default: every 5 minutes
  }

  /**
   * Initialize services and create header row if needed
   */
  async initialize() {
    try {
      console.log("Initializing sync service...");

      // Initialize Google Sheets service
      await this.googleSheetsService.initialize();

      // Create header row if it doesn't exist
      await this.googleSheetsService.createHeaderRow();

      console.log("Sync service initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize sync service:", error.message);
      throw error;
    }
  }

  /**
   * Perform a single sync operation
   */
  async performSync() {
    const syncStartTime = new Date();
    console.log(
      `\n--- Starting sync operation at ${syncStartTime.toISOString()} ---`
    );

    try {
      if (this.isRunning) {
        console.log("Sync already running, skipping this cycle");
        return {
          success: false,
          message: "Sync already in progress",
          timestamp: syncStartTime,
        };
      }

      this.isRunning = true;

      // Fetch attendance data
      console.log("Fetching attendance data...");
      const attendanceResult =
        await this.attendanceService.getRecentAttendanceData();

      if (!attendanceResult.records || attendanceResult.records.length === 0) {
        console.log("No new attendance records found");
        this.lastSyncResult = {
          success: true,
          message: "No new records",
          recordsFetched: 0,
          recordsAdded: 0,
          timestamp: syncStartTime,
          duration: Date.now() - syncStartTime.getTime(),
        };
        return this.lastSyncResult;
      }

      // Process attendance records
      const processedRecords = this.attendanceService.processAttendanceRecords(
        attendanceResult.records,
        attendanceResult.project
      );

      if (processedRecords.length === 0) {
        console.log("No valid attendance records to sync");
        this.lastSyncResult = {
          success: true,
          message: "No valid records to sync",
          recordsFetched: attendanceResult.records.length,
          recordsAdded: 0,
          timestamp: syncStartTime,
          duration: Date.now() - syncStartTime.getTime(),
        };
        return this.lastSyncResult;
      }

      // Sync to Google Sheets
      console.log(
        `Syncing ${processedRecords.length} records to Google Sheets...`
      );
      const recordsAdded = await this.googleSheetsService.appendAttendanceData(
        processedRecords
      );

      const syncEndTime = new Date();
      const duration = syncEndTime.getTime() - syncStartTime.getTime();

      this.lastSyncResult = {
        success: true,
        message: "Sync completed successfully",
        recordsFetched: attendanceResult.records.length,
        recordsAdded: recordsAdded || 0,
        timestamp: syncStartTime,
        duration: duration,
      };

      console.log(`--- Sync completed in ${duration}ms ---`);
      console.log(`Records fetched: ${this.lastSyncResult.recordsFetched}`);
      console.log(`Records added: ${this.lastSyncResult.recordsAdded}`);

      return this.lastSyncResult;
    } catch (error) {
      console.error("Sync operation failed:", error.message);

      this.lastSyncResult = {
        success: false,
        message: error.message,
        error: error.name,
        recordsFetched: 0,
        recordsAdded: 0,
        timestamp: syncStartTime,
        duration: Date.now() - syncStartTime.getTime(),
      };

      return this.lastSyncResult;
    } finally {
      this.isRunning = false;
    }
  }

  async fetchAttendanceData(filters = {}) {
    const fetchStartTime = new Date();
    console.log(
      `\n--- Starting fetch operation at ${fetchStartTime.toISOString()} ---`
    );

    try {
      // Set default time range if not provided
      const currentYear = new Date().getFullYear();
      const defaultStartTime =
        filters.startTime || `${currentYear}-01-01T00:00:00`;
      const defaultEndTime =
        filters.endTime || `${currentYear + 1}-12-31T23:59:59`;

      // Create filters object with defaults
      const queryFilters = {
        ...filters,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
      };

      console.log(
        `Fetching data from ${queryFilters.startTime} to ${queryFilters.endTime}`
      );

      // Fetch attendance data with filters
      console.log("Fetching attendance data...");
      const attendanceResult =
        await this.attendanceService.getRecentAttendanceData(queryFilters);

      if (!attendanceResult.records || attendanceResult.records.length === 0) {
        console.log("No attendance records found");
        return {
          success: true,
          message: "No records found",
          records: [],
          project: attendanceResult.project,
          recordsFetched: 0,
          filters: queryFilters,
          timestamp: fetchStartTime,
          duration: Date.now() - fetchStartTime.getTime(),
        };
      }

      // Process attendance records
      const processedRecords = this.attendanceService.processAttendanceRecords(
        attendanceResult.records,
        attendanceResult.project
      );

      if (processedRecords.length === 0) {
        console.log("No valid attendance records after processing");
        return {
          success: true,
          message: "No valid records after processing",
          records: [],
          project: attendanceResult.project,
          recordsFetched: attendanceResult.records.length,
          filters: queryFilters,
          timestamp: fetchStartTime,
          duration: Date.now() - fetchStartTime.getTime(),
        };
      }

      const fetchEndTime = new Date();
      const duration = fetchEndTime.getTime() - fetchStartTime.getTime();

      console.log(`--- Fetch completed in ${duration}ms ---`);
      console.log(`Records fetched: ${processedRecords.length}`);

      return {
        success: true,
        message: "Data fetched successfully",
        records: processedRecords,
        project: attendanceResult.project,
        recordsFetched: processedRecords.length,
        filters: queryFilters,
        timestamp: fetchStartTime,
        duration: duration,
      };
    } catch (error) {
      console.error("Fetch operation failed:", error.message);

      return {
        success: false,
        message: error.message,
        error: error.name,
        records: [],
        recordsFetched: 0,
        timestamp: fetchStartTime,
        duration: Date.now() - fetchStartTime.getTime(),
      };
    }
  }
  /**
   * Start the cron job
   */
  startCronJob() {
    if (this.cronJob) {
      console.log("Cron job already running");
      return false;
    }

    // Validate cron expression
    if (!cron.validate(this.syncInterval)) {
      throw new Error(`Invalid cron expression: ${this.syncInterval}`);
    }

    console.log(`Starting cron job with interval: ${this.syncInterval}`);

    this.cronJob = cron.schedule(
      this.syncInterval,
      async () => {
        await this.performSync();
      },
      {
        scheduled: false,
        timezone: "UTC",
      }
    );

    this.cronJob.start();
    console.log("Cron job started successfully");
    return true;
  }

  /**
   * Stop the cron job
   */
  stopCronJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("Cron job stopped");
      return true;
    }
    return false;
  }

  /**
   * Check if cron job is running
   */
  isCronJobRunning() {
    return !!this.cronJob;
  }

  /**
   * Get sync service status
   */
  getStatus() {
    return {
      initialized: this.googleSheetsService.initialized,
      cronJobRunning: this.isCronJobRunning(),
      syncInProgress: this.isRunning,
      syncInterval: this.syncInterval,
      lastSyncResult: this.lastSyncResult,
      attendanceServiceStatus: this.attendanceService.getStatus(),
      uptime: process.uptime(),
    };
  }

  /**
   * Test all services
   */
  async testServices() {
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    try {
      // Test attendance service
      console.log("Testing attendance service...");
      testResults.tests.attendanceService =
        await this.attendanceService.testConnection();

      // Test Google Sheets service
      console.log("Testing Google Sheets service...");
      try {
        const sheetInfo = await this.googleSheetsService.getSheetInfo();
        testResults.tests.googleSheets = {
          success: true,
          message: "Google Sheets connection successful",
          sheetInfo: sheetInfo,
        };
      } catch (error) {
        testResults.tests.googleSheets = {
          success: false,
          message: error.message,
        };
      }

      // Overall status
      testResults.overallSuccess =
        testResults.tests.attendanceService.success &&
        testResults.tests.googleSheets.success;

      return testResults;
    } catch (error) {
      testResults.error = error.message;
      testResults.overallSuccess = false;
      return testResults;
    }
  }

  /**
   * Perform manual sync with custom date range
   */
  async performManualSync(startDate, endDate) {
    const syncStartTime = new Date();
    console.log(
      `\n--- Starting manual sync from ${startDate.toISOString()} to ${endDate.toISOString()} ---`
    );

    try {
      if (this.isRunning) {
        throw new Error("Another sync operation is already running");
      }

      this.isRunning = true;

      // Fetch attendance data for the specified range
      const attendanceResult =
        await this.attendanceService.getAttendanceDataForRange(
          startDate,
          endDate
        );

      if (!attendanceResult.records || attendanceResult.records.length === 0) {
        return {
          success: true,
          message: "No records found in the specified date range",
          recordsFetched: 0,
          recordsAdded: 0,
          timestamp: syncStartTime,
          duration: Date.now() - syncStartTime.getTime(),
        };
      }

      // Process and sync records
      const processedRecords = this.attendanceService.processAttendanceRecords(
        attendanceResult.records,
        attendanceResult.project
      );

      const recordsAdded = await this.googleSheetsService.appendAttendanceData(
        processedRecords
      );

      const duration = Date.now() - syncStartTime.getTime();

      return {
        success: true,
        message: "Manual sync completed successfully",
        recordsFetched: attendanceResult.records.length,
        recordsAdded: recordsAdded || 0,
        timestamp: syncStartTime,
        duration: duration,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        error: error.name,
        timestamp: syncStartTime,
        duration: Date.now() - syncStartTime.getTime(),
      };
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = SyncService;
