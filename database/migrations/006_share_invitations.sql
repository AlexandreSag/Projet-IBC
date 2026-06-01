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
