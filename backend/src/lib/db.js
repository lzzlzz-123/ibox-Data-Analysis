'use strict';

const mysql = require('mysql2/promise');
const env = require('../config/env');

let pool;

function buildPoolConfig(overrides = {}) {
  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: env.db.connectionLimit,
    charset: 'utf8mb4',
    timezone: 'Z',
    namedPlaceholders: true,
    ...overrides,
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(buildPoolConfig());
  }
  return pool;
}

async function getConnection() {
  return getPool().getConnection();
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  getConnection,
  closePool,
  buildPoolConfig,
};
