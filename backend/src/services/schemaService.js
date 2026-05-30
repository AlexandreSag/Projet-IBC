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

  if (!(await hasColumn(db, 'utilisateur', 'premium_expires_at'))) {
    await db.execute('ALTER TABLE utilisateur ADD COLUMN premium_expires_at DATETIME NULL');
  }

  if (!(await hasColumn(db, 'utilisateur', 'premium_cancel_at_period_end'))) {
    await db.execute('ALTER TABLE utilisateur ADD COLUMN premium_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE');
  }

  if (!(await hasColumn(db, 'utilisateur', 'quota_cleanup_required'))) {
    await db.execute('ALTER TABLE utilisateur ADD COLUMN quota_cleanup_required BOOLEAN NOT NULL DEFAULT FALSE');
  }

  await db.execute(
    `CREATE TABLE IF NOT EXISTS abonnement_renouvellement (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      utilisateur_id BIGINT UNSIGNED NOT NULL UNIQUE,
      provider VARCHAR(30) NOT NULL DEFAULT 'ethereum_wallet',
      mode VARCHAR(20) NOT NULL DEFAULT 'manual',
      status VARCHAR(20) NOT NULL DEFAULT 'disabled',
      wallet_address VARCHAR(255) NULL,
      chain_id BIGINT UNSIGNED NULL,
      network VARCHAR(30) NULL,
      smart_contract_address VARCHAR(255) NULL,
      mandate_reference VARCHAR(255) NULL,
      next_renewal_at DATETIME NULL,
      last_renewal_attempt_at DATETIME NULL,
      last_payment_id BIGINT UNSIGNED NULL,
      last_transaction_hash VARCHAR(255) NULL,
      failure_reason VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_abonnement_renouvellement_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id),
      CONSTRAINT fk_abonnement_renouvellement_last_payment FOREIGN KEY (last_payment_id) REFERENCES abonnement_paiement(id)
    )`,
  );
}

module.exports = {
  ensureDatabaseSchema,
};
