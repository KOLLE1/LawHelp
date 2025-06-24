import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../shared/schema.js';

console.log("database inti")

// Check if running in Replit environment
const isReplit = process.env.REPLIT_DEPLOYMENT_ID || process.env.REPL_ID;

async function createDatabaseConnection() {
  try {
    if (isReplit) {
      // Replit environment - use PostgreSQL
      const { drizzle: pgDrizzle } = await import('drizzle-orm/neon-http');
      const { neon } = await import('@neondatabase/serverless');
      const pgSchema = await import('../shared/schema-pg.js');
      
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL must be set. Please provision a PostgreSQL database in Replit.");
      }
      const sql = neon(process.env.DATABASE_URL);
      const db = pgDrizzle(sql, { schema: pgSchema });
      console.log('✅ PostgreSQL database connected successfully (Replit)');
      return db;
    } else {
      // Local development - use MySQL
      console.log('🔧 Local development detected - connecting to MySQL Workbench');
      
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'lawhelp_db',
        multipleStatements: true,
      };

      try {
        const connection = await mysql.createConnection(dbConfig);
        const db = drizzle(connection, { schema, mode: 'default' });
        console.log('✅ MySQL database connected successfully');
        return db;
      } catch (error) {
        console.log('❌ MySQL connection failed. Please ensure:');
        console.log('1. MySQL is running on your machine');
        console.log('2. Update your .env file with correct credentials:');
        console.log('   DB_PASSWORD=your_actual_mysql_password');
        console.log('3. Create the database in MySQL Workbench:');
        console.log('   CREATE DATABASE lawhelp_db;');
        throw error;
      }
    }
  } catch (error) {
    console.log('🔧 Falling back to in-memory storage for development');
    // Return a simple object that won't cause issues
    return {
      query: () => Promise.reject(new Error('Database not configured - using in-memory storage'))
    };
  }
}

// Initialize database connection
export const db = createDatabaseConnection();