const { getPool } = require('../config/database');

async function getRevenuByIdForUser(revenuId, userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT r.*, c.nom_court AS compte_nom_court
     FROM revenu r
     INNER JOIN compte c ON c.id = r.compte_id
     WHERE r.id = ? AND c.utilisateur_id = ?`,
    [revenuId, userId],
  );
  return rows[0] || null;
}

async function ensureCompteOwner(compteId, userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    'SELECT id FROM compte WHERE id = ? AND utilisateur_id = ?',
    [compteId, userId],
  );
  return rows.length > 0;
}

async function getAllRevenusForUser(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT r.*, c.nom_court AS compte_nom_court
     FROM revenu r
     INNER JOIN compte c ON c.id = r.compte_id
     WHERE c.utilisateur_id = ?
     ORDER BY r.date_debut DESC, r.id DESC`,
    [userId],
  );
  return rows;
}

async function createRevenu(payload) {
  const db = await getPool();
  const [result] = await db.execute(
    `INSERT INTO revenu
      (compte_id, nom_court, description, montant, duree_type, frequence_mois, date_debut, date_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.compte_id,
      payload.nom_court,
      payload.description,
      payload.montant,
      payload.duree_type,
      payload.frequence_mois,
      payload.date_debut,
      payload.date_fin,
    ],
  );
  return result.insertId;
}

async function updateRevenu(revenuId, payload) {
  const db = await getPool();
  await db.execute(
    `UPDATE revenu SET
      compte_id = ?,
      nom_court = ?,
      description = ?,
      montant = ?,
      duree_type = ?,
      frequence_mois = ?,
      date_debut = ?,
      date_fin = ?
     WHERE id = ?`,
    [
      payload.compte_id,
      payload.nom_court,
      payload.description,
      payload.montant,
      payload.duree_type,
      payload.frequence_mois,
      payload.date_debut,
      payload.date_fin,
      revenuId,
    ],
  );
}

async function deleteRevenu(revenuId) {
  const db = await getPool();
  await db.execute('DELETE FROM revenu WHERE id = ?', [revenuId]);
}

module.exports = {
  getRevenuByIdForUser,
  ensureCompteOwner,
  getAllRevenusForUser,
  createRevenu,
  updateRevenu,
  deleteRevenu,
};
