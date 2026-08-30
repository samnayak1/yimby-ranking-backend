import "dotenv/config";
import express from "express";
import pinoHttp from "pino-http";

import { PoliticianService } from "./services/PoliticianService";
import { CityService } from "./services/CityService";
import { PoliticianController } from "./controllers/PoliticianController";
import { CityController } from "./controllers/CityController";
import { UserController } from "./controllers/UserController";
import { createDbProvider, runMigrations } from "./repos/client";
import { SQLiteCityRepo } from "./repos/sqlLiteCityRepo";
import { SQLLitePoliticianRepo } from "./repos/sqlLitePoliticianRepo";
import { cityRoutes } from "./routes/cityRoutes";
import { userRoutes } from "./routes/userRoutes";
import { politicianRoutes } from "./routes/politicianRoutes";
import { healthRoutes } from "./routes/healthRoutes";
import { backupJob } from "./jobs/db-cron";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { quitCache } from "./cache/cacheClient";

const app = express();

app.use(
  pinoHttp({
    logger,
    // The health checks run every 30s forever; logging them at info would bury
    // real traffic and burn through the 10 MB log rotation for nothing.
    autoLogging: {
      ignore: req => req.url === "/health" || req.url === "/readiness",
    },
    // A line per successful request is what fills the 10 MB rotation — on a site
    // this size it's volume without signal. Only failures get written; set
    // LOG_REQUESTS=all to bring the 2xx lines back when debugging.
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return process.env.LOG_REQUESTS === "all" ? "info" : "silent";
    },

    // The defaults serialize every header on both sides. What's actually useful
    // when reading back a failure is the route, the status and how long it took.
    serializers: {
      req: req => ({ method: req.method, url: req.url }),
      res: res => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use(express.json());

const provider = createDbProvider();
runMigrations(provider);

const politicianRepo = new SQLLitePoliticianRepo(provider);
const cityRepo = new SQLiteCityRepo(provider);

const politicianService = new PoliticianService(politicianRepo);
const cityService = new CityService(cityRepo);

app.use("/api/politicians", politicianRoutes(new PoliticianController(politicianService)));
app.use("/api/cities", cityRoutes(new CityController(cityService)));
app.use("/api/users", userRoutes(new UserController()));

app.use(healthRoutes(provider));

app.use(errorHandler);

backupJob.start();
logger.info("Backup scheduler started");

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server listening");
});

/**
 * SQLite is a file, not a service: a hard kill mid-write leaves a WAL that
 * Litestream then has to replicate as-is. Draining connections and closing the
 * handle first makes restarts and redeploys boring.
 */
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down");

  // Docker sends SIGKILL 10s after SIGTERM by default; give up before that so
  // the close still happens rather than being cut off mid-way.
  const forced = setTimeout(() => {
    logger.error("Shutdown timed out, exiting");
    process.exit(1);
  }, 8000);
  forced.unref();

  try {
    backupJob.stop();
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve())),
    );
    await quitCache();
    provider.close();
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Both of these previously killed the process with nothing written down; the
// container restarted and the crash looked like a blip. Log, then exit non-zero
// so `restart: unless-stopped` still brings it back.
process.on("uncaughtException", err => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", reason => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  process.exit(1);
});
