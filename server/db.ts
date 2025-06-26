import { drizzle as mysqlDrizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as mysqlSchema from "../shared/schema"; // ✅ MySQL schema

const isReplit = process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID;

// Define db as unknown initially
let db: any;

export async function initDatabase() {
  if (isReplit) {
    // ✅ Replit (PostgreSQL)
    const { drizzle: pgDrizzle } = await import("drizzle-orm/neon-http");
    const { neon } = await import("@neondatabase/serverless");
    const pgSchema = await import("../shared/schema-pg.js");

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set for Replit.");
    }

    const sql = neon(process.env.DATABASE_URL);
    db = pgDrizzle(sql, { schema: pgSchema });
    console.log("✅ PostgreSQL connected (Replit)");
  } else {
    // ✅ Local (MySQL)
    console.log("🔧 Connecting to local MySQL...");

    const dbConfig = {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "lawhelp_db",
      multipleStatements: true,
    };

    const connection = await mysql.createConnection(dbConfig);

    // ✅ Add `mode: 'default'` to fix the error
    db = mysqlDrizzle(connection, {
      schema: mysqlSchema,
      mode: "default", // 🔧 REQUIRED for MySQL drizzle
    });

    console.log("✅ MySQL connected (local)");
  }
}

// ✅ Accessor after init
export function getDb() {
  if (!db) {
    throw new Error("❌ Database not initialized. Call initDatabase() first.");
  }
  return db;
}
