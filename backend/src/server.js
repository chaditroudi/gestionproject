import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";

function formatStartupError(error) {
  if (!error) {
    return "Unknown startup error";
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors
      .map((entry) => {
        const address = entry.address ? `${entry.address}:${entry.port}` : "unknown host";
        return `${entry.code || "ERROR"} connecting to ${address}`;
      })
      .join("; ");
  }

  return error.stack || error.message || String(error);
}

async function startServer() {
  try {
    await pool.query("SELECT 1");
    await runMigrations();

    app.listen(env.port, () => {
      console.log(`Backend running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start backend:", formatStartupError(error));
    process.exit(1);
  }
}

startServer();
