import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./lib/bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

process.on("uncaughtException", (err) => {
  logger.error({ err }, "خطأ غير متوقع — تم التجاهل للحفاظ على الجلسة");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "رفض وعد غير معالج — تم التجاهل للحفاظ على الجلسة");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startBot();
  startSelfPing();
});

function startSelfPing() {
  const domains = process.env["REPLIT_DOMAINS"];
  if (!domains) {
    logger.warn("REPLIT_DOMAINS غير موجود — لن يتم تشغيل Self-Ping");
    return;
  }

  const host = domains.split(",")[0]?.trim();
  const url = `https://${host}/api/healthz`;

  logger.info({ url }, "[Self-Ping] تم تفعيل نظام منع النوم");

  // انتظر 10 ثوانٍ ثم ابدأ
  setTimeout(() => {
    const ping = () => {
      fetch(url)
        .then((r) => logger.info({ status: r.status }, "[Self-Ping] مرسل"))
        .catch((e) => logger.warn({ err: String(e) }, "[Self-Ping] فشل — إعادة المحاولة لاحقاً"));
    };

    ping();
    setInterval(ping, 3 * 60 * 1000); // كل 3 دقائق
  }, 10_000);
}
