const express = require('express');
require('dotenv').config();
const alertsRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const collectionsRoutes = require('./routes/collections');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api/alerts', alertsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/collections', collectionsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Collections Dashboard API' });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
