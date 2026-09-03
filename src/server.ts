import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`ExpenseIQ API running on port ${PORT}`);
});

let isShuttingDown = false;

async function handleShutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Initiating graceful shutdown...`);

  // Stop accepting new connections
  server.close(async (err) => {
    if (err) {
      console.error("Error closing Express server listener:", err);
    } else {
      console.log("Express server stopped accepting connections.");
    }

    try {
      console.log("Disconnecting Prisma database client...");
      await prisma.$disconnect();
      console.log("Prisma client disconnected successfully.");
    } catch (dbErr) {
      console.error("Error during Prisma disconnect:", dbErr);
    } finally {
      console.log("Shutdown complete. Exiting process.");
      process.exit(exitCode);
    }
  });

  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    console.error("Forced exit: Shutdown timed out after 10s.");
    process.exit(1);
  }, 10000).unref();
}

// Signal Listeners
process.on("SIGTERM", () => handleShutdown("SIGTERM", 0));
process.on("SIGINT", () => handleShutdown("SIGINT", 0));

// Process Error Listeners
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION! Shutting down server...", reason);
  handleShutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down server...", error);
  handleShutdown("uncaughtException", 1);
});
