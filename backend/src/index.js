require('dotenv').config();

const { waitForDatabase } = require('./config/database');
const { createApp } = require('./app');
const { ensureDatabaseSchema } = require('./services/schemaService');
const { startAutoRenewalRunner } = require('./services/subscriptionAutoRenewalRunner');

const port = Number(process.env.PORT || 8080);

waitForDatabase()
  .then(async () => {
    await ensureDatabaseSchema();
    const app = createApp();
    app.listen(port, () => {
      console.log(`API ready on port ${port}`);
      startAutoRenewalRunner();
    });
  })
  .catch((error) => {
    console.error('Database never became available, aborting startup.', error);
    process.exit(1);
  });
