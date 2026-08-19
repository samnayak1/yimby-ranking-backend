import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";



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
import { backupJob } from "./jobs/db-cron";

const app = express();
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status ?? 500).json({ error: err.message });
});


backupJob.start();
console.log("Backup scheduler started.");

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});