import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../../.env")
});

export const env = {
  port: process.env.PORT || 4000,
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/work_management",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173"
};
