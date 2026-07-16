CREATE TABLE IF NOT EXISTS abonnement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  nom VARCHAR(50) NOT NULL,
  prix DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  blockchain_type VARCHAR(20),
  wallet_address VARCHAR(255),
  smart_contract_address VARCHAR(255),
  max_comptes INT UNSIGNED,
  max_depenses_par_compte INT UNSIGNED,
  max_revenus_par_compte INT UNSIGNED,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_abonnement_prix CHECK (prix >= 0)
);

INSERT INTO abonnement
  (id, code, nom, prix, blockchain_type, wallet_address, smart_contract_address, max_comptes, max_depenses_par_compte, max_revenus_par_compte, actif)
VALUES
  (1, 'free', 'Gratuit', 0.00, NULL, NULL, NULL, 2, 7, 2, TRUE),
  (2, 'premium', 'Payant', 9.99, 'ethereum', NULL, NULL, NULL, NULL, NULL, TRUE)
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  nom = VALUES(nom),
  prix = VALUES(prix),
  blockchain_type = VALUES(blockchain_type),
  max_comptes = VALUES(max_comptes),
  max_depenses_par_compte = VALUES(max_depenses_par_compte),
  max_revenus_par_compte = VALUES(max_revenus_par_compte),
  actif = VALUES(actif);

CREATE TABLE IF NOT EXISTS utilisateur (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100),
  prenom VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  email_verifie BOOLEAN NOT NULL DEFAULT TRUE,
  email_verification_token_hash CHAR(64) NULL,
  email_verification_token_expires_at DATETIME NULL,
  premium_expires_at DATETIME NULL,
  premium_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  quota_cleanup_required BOOLEAN NOT NULL DEFAULT FALSE,
  date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  abonnement_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT fk_utilisateur_abonnement FOREIGN KEY (abonnement_id) REFERENCES abonnement(id)
);

CREATE TABLE IF NOT EXISTS compte (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED,
  nom_court VARCHAR(100),
  description TEXT,
  date_creation DATE,
  taux_remuneration DECIMAL(5,2),
  taux_imposition DECIMAL(5,2),
  solde_initial DECIMAL(12,2),
  CONSTRAINT fk_compte_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id)
);

CREATE TABLE IF NOT EXISTS depense (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compte_id BIGINT UNSIGNED,
  nom_court VARCHAR(100),
  description TEXT,
  montant DECIMAL(12,2),
  duree_type VARCHAR(20),
  frequence_mois INT,
  date_debut DATE,
  date_fin DATE,
  CONSTRAINT fk_depense_compte FOREIGN KEY (compte_id) REFERENCES compte(id)
);

CREATE TABLE IF NOT EXISTS revenu (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compte_id BIGINT UNSIGNED,
  nom_court VARCHAR(100),
  description TEXT,
  montant DECIMAL(12,2),
  duree_type VARCHAR(20),
  frequence_mois INT,
  date_debut DATE,
  date_fin DATE,
  CONSTRAINT fk_revenu_compte FOREIGN KEY (compte_id) REFERENCES compte(id)
);

CREATE TABLE IF NOT EXISTS exception (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20),
  id_cible BIGINT UNSIGNED,
  nom VARCHAR(100),
  description TEXT,
  montant DECIMAL(12,2),
  frequence_mois INT,
  date_debut DATE,
  date_fin DATE
);

CREATE TABLE IF NOT EXISTS partage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compte_id BIGINT UNSIGNED,
  utilisateur_id BIGINT UNSIGNED,
  droits VARCHAR(20),
  date_partage TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_partage_compte FOREIGN KEY (compte_id) REFERENCES compte(id),
  CONSTRAINT fk_partage_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id)
);

CREATE TABLE IF NOT EXISTS partage_invitation (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compte_id BIGINT UNSIGNED NOT NULL,
  inviteur_id BIGINT UNSIGNED NOT NULL,
  invite_utilisateur_id BIGINT UNSIGNED NULL,
  email_invite VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_partage_invitation_compte FOREIGN KEY (compte_id) REFERENCES compte(id),
  CONSTRAINT fk_partage_invitation_inviteur FOREIGN KEY (inviteur_id) REFERENCES utilisateur(id),
  CONSTRAINT fk_partage_invitation_invite FOREIGN KEY (invite_utilisateur_id) REFERENCES utilisateur(id)
);

CREATE TABLE IF NOT EXISTS abonnement_paiement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  abonnement_id BIGINT UNSIGNED NOT NULL,
  plan_code VARCHAR(30) NOT NULL,
  duration_months INT UNSIGNED NOT NULL DEFAULT 1,
  montant_eur DECIMAL(10,2) NOT NULL,
  crypto_code VARCHAR(10) NOT NULL,
  montant_crypto DECIMAL(18,8) NOT NULL,
  network VARCHAR(30) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_hash VARCHAR(255) NULL,
  expires_at DATETIME NULL,
  confirmed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_abonnement_paiement_transaction_hash UNIQUE (transaction_hash),
  CONSTRAINT fk_abonnement_paiement_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id),
  CONSTRAINT fk_abonnement_paiement_abonnement FOREIGN KEY (abonnement_id) REFERENCES abonnement(id),
  CONSTRAINT chk_abonnement_paiement_montant_eur CHECK (montant_eur >= 0),
  CONSTRAINT chk_abonnement_paiement_montant_crypto CHECK (montant_crypto >= 0)
);

CREATE TABLE IF NOT EXISTS abonnement_renouvellement (
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
);
