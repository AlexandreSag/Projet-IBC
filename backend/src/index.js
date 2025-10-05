require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'ibc_user',
  password: process.env.DB_PASSWORD || 'ibc_password',
  database: process.env.DB_NAME || 'ibc_db',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool;
async function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

async function waitForDatabase(retries = 10, delayMs = 3000) {
  const db = await getPool();
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await db.query('SELECT 1');
      return true;
    } catch (error) {
      console.warn(`Database not ready (attempt ${attempt}/${retries})`);
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

app.get('/api/health', async (req, res) => {
  try {
    const db = await getPool();
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Database connection failed', error);
    res.status(500).json({ status: 'error', error: 'Database connection failed' });
  }
});

const port = Number(process.env.PORT || 8080);
waitForDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API ready on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Database never became available, aborting startup.', error);
    process.exit(1);
  });
