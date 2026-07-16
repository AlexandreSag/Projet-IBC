ALTER TABLE abonnement_paiement
  ADD CONSTRAINT uq_abonnement_paiement_transaction_hash UNIQUE (transaction_hash);
