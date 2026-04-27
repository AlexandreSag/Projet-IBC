
ALTER TABLE abonnement
  ADD COLUMN code VARCHAR(30) NULL AFTER id,
  ADD COLUMN max_comptes INT UNSIGNED NULL AFTER smart_contract_address,
  ADD COLUMN max_depenses_par_compte INT UNSIGNED NULL AFTER max_comptes,
  ADD COLUMN max_revenus_par_compte INT UNSIGNED NULL AFTER max_depenses_par_compte,
  ADD COLUMN actif BOOLEAN NOT NULL DEFAULT TRUE AFTER max_revenus_par_compte,
  ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER actif,
  ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

UPDATE abonnement
SET nom = COALESCE(nom, 'Ancien abonnement'),
    prix = COALESCE(prix, 0.00);

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

UPDATE abonnement
SET code = CONCAT('legacy-', id)
WHERE code IS NULL;

ALTER TABLE abonnement
  MODIFY COLUMN nom VARCHAR(50) NOT NULL,
  MODIFY COLUMN prix DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN code VARCHAR(30) NOT NULL,
  ADD UNIQUE KEY uq_abonnement_code (code),
  ADD CONSTRAINT chk_abonnement_prix CHECK (prix >= 0);

UPDATE utilisateur
SET abonnement_id = 1
WHERE abonnement_id IS NULL;

ALTER TABLE utilisateur
  MODIFY COLUMN abonnement_id BIGINT UNSIGNED NOT NULL DEFAULT 1;
