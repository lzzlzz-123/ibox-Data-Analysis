'use strict';

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { buildPoolConfig } = require('../src/lib/db');

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function listMigrationFiles() {
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    return entries
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Migrations directory not found at ${MIGRATIONS_DIR}`);
    }
    throw error;
  }
}

async function hasMigrationRun(connection, name) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE name = ? LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function applyMigration(connection, name) {
  const filePath = path.join(MIGRATIONS_DIR, name);
  const sql = await fs.readFile(filePath, 'utf8');

  console.log(`Applying migration: ${name}`);
  await connection.beginTransaction();
  try {
    await connection.query(sql);
    await connection.execute(
      `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
      [name],
    );
    await connection.commit();
    console.log(`✔ Migration applied: ${name}`);
  } catch (error) {
    await connection.rollback();
    console.error(`✖ Migration failed: ${name}`);
    throw error;
  }
}

async function runMigrations() {
  const migrationFiles = await listMigrationFiles();

  if (migrationFiles.length === 0) {
    console.log('No migrations found.');
    return;
  }

  const poolConfig = buildPoolConfig();
  const connectionConfig = {
    host: poolConfig.host,
    port: poolConfig.port,
    user: poolConfig.user,
    password: poolConfig.password,
    database: poolConfig.database,
    charset: poolConfig.charset,
    timezone: poolConfig.timezone,
    namedPlaceholders: poolConfig.namedPlaceholders,
    multipleStatements: true,
  };

  const connection = await mysql.createConnection(connectionConfig);

  try {
    await ensureMigrationsTable(connection);

    for (const file of migrationFiles) {
      const alreadyRun = await hasMigrationRun(connection, file);
      if (alreadyRun) {
        console.log(`Skipping migration (already applied): ${file}`);
        continue;
      }
      await applyMigration(connection, file);
    }

    console.log('All migrations applied.');
  } finally {
    await connection.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration execution failed:', error.message);
  process.exitCode = 1;
});
