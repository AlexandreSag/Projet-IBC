const { getPool } = require('../config/database');

async function getDepenseByIdForUser(depenseId, userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT d.*, c.nom_court AS compte_nom_court
     FROM depense d
     INNER JOIN compte c ON c.id = d.compte_id
     WHERE d.id = ? AND c.utilisateur_id = ?`,
    [depenseId, userId],
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

async function getAllDepensesForUser(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT d.*, c.nom_court AS compte_nom_court
     FROM depense d
     INNER JOIN compte c ON c.id = d.compte_id
     WHERE c.utilisateur_id = ?
     ORDER BY d.date_debut DESC, d.id DESC`,
    [userId],
  );
  return rows;
}

async function createDepense(payload) {
  const db = await getPool();
  const [result] = await db.execute(
    `INSERT INTO depense
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

async function updateDepense(depenseId, payload) {
  const db = await getPool();
  await db.execute(
    `UPDATE depense SET
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
      depenseId,
    ],
  );
}

async function deleteDepense(depenseId) {
  const db = await getPool();
  await db.execute('DELETE FROM depense WHERE id = ?', [depenseId]);
}

module.exports = {
  getDepenseByIdForUser,
  ensureCompteOwner,
  getAllDepensesForUser,
  createDepense,
  updateDepense,
  deleteDepense,
};
