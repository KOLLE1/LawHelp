import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../shared/schema.js';

async function createDatabaseConnection() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root@localhost:3306/lawhelp_db';
    
    // Parse the DATABASE_URL to get connection parameters
    const url = new URL(DATABASE_URL);
    
    const connection = await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
      multipleStatements: true,
    });

    console.log('MySQL database connected successfully');
    
    const db = drizzle(connection, { schema, mode: 'default' });
    return db;
  } catch (error) {
    console.error('Failed to connect to MySQL database:', error);
    console.log('Falling back to in-memory storage...');
    throw error;
  }
}

export const initializeDatabase = createDatabaseConnection;