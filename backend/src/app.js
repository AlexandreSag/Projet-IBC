const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { getPool } = require('./config/database');
const authRoutes = require('./routes/auth');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

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

  app.use('/api', authRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  });

  return app;
}

module.exports = {
  createApp,
};
