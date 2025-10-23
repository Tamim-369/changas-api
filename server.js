require("dotenv").config();
const express = require("express");
const SyncService = require("./services/syncService");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global sync service instance
let syncService;

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.path}:`, err.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * Get service status
 */
app.get("/status", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const status = syncService.getStatus();
    res.json({
      success: true,
      status: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Test all services
 */
app.get("/test", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const testResults = await syncService.testServices();
    res.json(testResults);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Trigger manual sync
 */
app.post("/sync", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const result = await syncService.performSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Trigger manual sync with date range
 */
app.post("/sync/range", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid date format. Use ISO date format (e.g., 2023-12-01T00:00:00Z)",
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "startDate must be before endDate",
      });
    }

    const result = await syncService.performManualSync(start, end);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Start cron job
 */
app.post("/cron/start", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const started = syncService.startCronJob();
    res.json({
      success: started,
      message: started
        ? "Cron job started successfully"
        : "Cron job already running",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Display all the attendence data
 */
app.get("/data", async (req, res) => {
  try {
    const querys = req.query || {};
    const result = await syncService.fetchAttendanceData(querys);
    res.json({
      success: result,
      message: "Attendence Recieved successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Stop cron job
 */
app.post("/cron/stop", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const stopped = syncService.stopCronJob();
    res.json({
      success: stopped,
      message: stopped
        ? "Cron job stopped successfully"
        : "Cron job was not running",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get cron job status
 */
app.get("/cron/status", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    const isRunning = syncService.isCronJobRunning();
    res.json({
      success: true,
      cronJobRunning: isRunning,
      syncInterval: syncService.syncInterval,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get last sync result
 */
app.get("/sync/last", async (req, res) => {
  try {
    if (!syncService) {
      return res.status(503).json({
        success: false,
        message: "Sync service not initialized",
      });
    }

    res.json({
      success: true,
      lastSyncResult: syncService.lastSyncResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Initialize and start server
 */
async function startServer() {
  try {
    console.log("🚀 TIPSOI Attendance Sync Server");
    console.log("================================");
    console.log("Initializing services...");

    // Initialize sync service
    syncService = new SyncService();
    await syncService.initialize();

    console.log("✅ Services initialized successfully");

    // Start the cron job automatically
    try {
      syncService.startCronJob();
      console.log("✅ Automatic sync started");
    } catch (error) {
      console.warn("⚠️  Could not start automatic sync:", error.message);
      console.warn("   You can start it manually via POST /cron/start");
    }

    // Start Express server
    app.listen(port, () => {
      console.log(`\n🌐 Server running on http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`📈 Status: http://localhost:${port}/status`);
      console.log(`🔧 Test services: http://localhost:${port}/test`);
      console.log("\nAPI Endpoints:");
      console.log("  POST /sync              - Trigger manual sync");
      console.log("  POST /sync/range        - Sync specific date range");
      console.log("  POST /cron/start        - Start automatic sync");
      console.log("  POST /cron/stop         - Stop automatic sync");
      console.log("  GET  /cron/status       - Check cron job status");
      console.log("  GET  /sync/last         - Get last sync result");
      console.log("\n⏰ Sync interval:", syncService.syncInterval);
      console.log("🎯 Ready to sync attendance data!");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    console.error("\nPossible issues:");
    console.error("1. Check your .env file configuration");
    console.error("2. Ensure Google Sheets service account key is valid");
    console.error("3. Verify TIPSOI API token and URL");
    console.error("4. Check network connectivity");
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  if (syncService) {
    syncService.stopCronJob();
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  if (syncService) {
    syncService.stopCronJob();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the server
startServer();
