CREATE TABLE IF NOT EXISTS abonnement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(50),
  prix DECIMAL(10,2),
  blockchain_type VARCHAR(20),
  wallet_address VARCHAR(255),
  smart_contract_address VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS utilisateur (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100),
  prenom VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  abonnement_id BIGINT UNSIGNED,
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
