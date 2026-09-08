import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { setAppState, isShuttingDown } from "./config/appState.js";
import { logger } from "./utils/logger.js";
import { startRecurringCron, stopRecurringCron } from "./jobs/recurringCron.js";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  setAppState("READY");
  logger.info(
    "APPLICATION_STARTED",
    `ExpenseIQ API running on port ${PORT} in ${env.NODE_ENV} mode`,
    { port: PORT, env: env.NODE_ENV }
  );
  startRecurringCron();
});

async function handleShutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown()) return;
  setAppState("SHUTTING_DOWN");

  logger.info(
    "APPLICATION_SHUTDOWN",
    `${signal} signal received. Initiating graceful shutdown sequence...`,
    { signal }
  );

  stopRecurringCron();

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      logger.error("APPLICATION_SHUTDOWN", "Error closing Express server listener", err);
    } else {
      logger.info("APPLICATION_SHUTDOWN", "Express server stopped accepting new connections");
    }

    try {
      logger.info("APPLICATION_SHUTDOWN", "Disconnecting Prisma database client...");
      await prisma.$disconnect();
      logger.info("APPLICATION_SHUTDOWN", "Prisma client disconnected successfully");
    } catch (dbErr) {
      logger.error("APPLICATION_SHUTDOWN", "Error during Prisma disconnect", dbErr);
    } finally {
      logger.info("APPLICATION_SHUTDOWN", "Shutdown sequence complete. Exiting process");
      process.exit(exitCode);
    }
  });

  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    logger.error("APPLICATION_SHUTDOWN", "Forced exit: Shutdown timed out after 10s");
    process.exit(1);
  }, 10000).unref();
}

// Signal Listeners
process.on("SIGTERM", () => handleShutdown("SIGTERM", 0));
process.on("SIGINT", () => handleShutdown("SIGINT", 0));

// Process Error Listeners
process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED_ERROR", "Unhandled Rejection caught in process listener", reason);
  handleShutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  logger.error("UNHANDLED_ERROR", "Uncaught Exception caught in process listener", error);
  handleShutdown("uncaughtException", 1);
});
