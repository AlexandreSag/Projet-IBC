const { getPool } = require('../config/database');

async function hasColumn(db, tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );

  return rows.length > 0;
}

async function ensureDatabaseSchema() {
  const db = await getPool();

  if (!(await hasColumn(db, 'utilisateur', 'email_verifie'))) {
    await db.execute('ALTER TABLE utilisateur ADD COLUMN email_verifie BOOLEAN NOT NULL DEFAULT TRUE');
  }

  if (!(await hasColumn(db, 'utilisateur', 'email_verification_token_hash'))) {
    await db.execute('ALTER TABLE utilisateur ADD COLUMN email_verification_token_hash CHAR(64) NULL');
  }

  if (!(await hasColumn(db, 'utilisateur', 'email_verification_token_expires_at'))) {
    await db.execute('ALTER TABLE utilisateur ADD COLUMN email_verification_token_expires_at DATETIME NULL');
  }
}

module.exports = {
  ensureDatabaseSchema,
};
