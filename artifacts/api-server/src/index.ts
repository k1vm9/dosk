import app from "./app";
import { logger } from "./lib/logger";
import { startBot, stopBot } from "./lib/bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
  if (process.env.BOT_ENABLED !== "false") startBot();
  else logger.info("Bot startup disabled by BOT_ENABLED=false");
});

server.on("error", (err) => {
  logger.fatal({ err }, "HTTP server failed to start");
  process.exit(1);
});

let shuttingDown = false;
let shutdownExitCode = 0;

function shutdown(signal: string, exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  shutdownExitCode = exitCode;
  logger.info({ signal }, "Shutting down");
  stopBot();

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  server.close((err) => {
    clearTimeout(forceExit);
    if (err) {
      logger.error({ err }, "Error while closing HTTP server");
      shutdownExitCode = 1;
    }
    process.exitCode = shutdownExitCode;
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception; exiting for Railway restart");
  shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection; exiting for Railway restart");
  shutdown("unhandledRejection", 1);
});
