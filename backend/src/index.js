require('dotenv').config();

const { waitForDatabase } = require('./config/database');
const { createApp } = require('./app');

const port = Number(process.env.PORT || 8080);

waitForDatabase()
  .then(() => {
    const app = createApp();
    app.listen(port, () => {
      console.log(`API ready on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Database never became available, aborting startup.', error);
    process.exit(1);
  });
