const express = require('express');
const { getPool } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');
const abonnementService = require('../services/abonnementService');

const router = express.Router();

router.use(authMiddleware);

function countOccurrences(dateDebut, dateFin, frequenceMois, today) {
  const start = new Date(dateDebut);
  const end = dateFin ? new Date(dateFin) : today;
  const effectiveEnd = end < today ? end : today;

  if (start > today) return 0;
  if (frequenceMois === 0) return 1;

  let count = 0;
  let current = new Date(start);
  while (current <= effectiveEnd) {
    count++;
    current.setMonth(current.getMonth() + frequenceMois);
  }
  return count;
}

async function calculerSolde(db, compte, today = new Date()) {
  const [depenses] = await db.execute(
    'SELECT * FROM depense WHERE compte_id = ?',
    [compte.id]
  );
  const [revenus] = await db.execute(
    'SELECT * FROM revenu WHERE compte_id = ?',
    [compte.id]
  );

  const totalDepenses = depenses.reduce((sum, d) => {
    const n = countOccurrences(d.date_debut, d.date_fin, d.frequence_mois ?? 0, today);
    return sum + parseFloat(d.montant) * n;
  }, 0);

  const totalRevenus = revenus.reduce((sum, r) => {
    const n = countOccurrences(r.date_debut, r.date_fin, r.frequence_mois ?? 0, today);
    return sum + parseFloat(r.montant) * n;
  }, 0);

  let totalInterets = 0;
  const tauxRemuneration = parseFloat(compte.taux_remuneration);
  if (tauxRemuneration > 0) {
    const tauxMensuel = tauxRemuneration / 100 / 12;
    const tauxImpo = parseFloat(compte.taux_imposition || 0) / 100;
    const dateCreation = new Date(compte.date_creation);
    let nbMois = 0;
    let cursor = new Date(dateCreation);
    cursor.setMonth(cursor.getMonth() + 1);
    while (cursor <= today) {
      nbMois++;
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const soldeBase = parseFloat(compte.solde_initial || 0);
    totalInterets = soldeBase * tauxMensuel * nbMois * (1 - tauxImpo);
  }

  const solde =
    parseFloat(compte.solde_initial || 0) +
    totalRevenus -
    totalDepenses +
    totalInterets;

  return Math.round(solde * 100) / 100;
}

router.get('/', async (req, res, next) => {
  try {
    const db = await getPool();
    const userId = req.auth.sub;
    const search = req.query.search || '';

    let query = 'SELECT * FROM compte WHERE utilisateur_id = ?';
    const params = [userId];

    if (search) {
      query += ' AND (nom_court LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY date_creation DESC';

    const [comptes] = await db.execute(query, params);
    const today = new Date();

    const comptesAvecSolde = await Promise.all(
      comptes.map(async (compte) => {
        const solde = await calculerSolde(db, compte, today);
        return { ...compte, solde };
      })
    );

    return res.json({ comptes: comptesAvecSolde });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = await getPool();
    const userId = req.auth.sub;

    const [rows] = await db.execute(
      'SELECT * FROM compte WHERE id = ? AND utilisateur_id = ?',
      [req.params.id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    const compte = rows[0];
    const solde = await calculerSolde(db, compte);

    return res.json({ compte: { ...compte, solde } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const db = await getPool();
    const userId = req.auth.sub;

    const {
      nom_court,
      description = null,
      date_creation,
      taux_remuneration = 0,
      taux_imposition = 0,
      solde_initial = 0,
    } = req.body || {};

    if (!nom_court || !date_creation) {
      return res.status(400).json({ error: 'nom_court et date_creation sont requis.' });
    }

    const quota = await abonnementService.canCreateCompte(userId);
    if (!quota.allowed) {
      return res.status(403).json({
        error: quota.message,
        quota: {
          resource: quota.resource,
          used: quota.used,
          limit: quota.limit,
        },
      });
    }

    const [result] = await db.execute(
      `INSERT INTO compte 
        (utilisateur_id, nom_court, description, date_creation, taux_remuneration, taux_imposition, solde_initial)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, nom_court, description, date_creation, taux_remuneration, taux_imposition, solde_initial]
    );

    const [newCompte] = await db.execute('SELECT * FROM compte WHERE id = ?', [result.insertId]);

    return res.status(201).json({ compte: newCompte[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const db = await getPool();
    const userId = req.auth.sub;

    const [rows] = await db.execute(
      'SELECT * FROM compte WHERE id = ? AND utilisateur_id = ?',
      [req.params.id, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    const {
      nom_court,
      description,
      date_creation,
      taux_remuneration,
      taux_imposition,
      solde_initial,
    } = req.body || {};

    await db.execute(
      `UPDATE compte SET
        nom_court = COALESCE(?, nom_court),
        description = COALESCE(?, description),
        date_creation = COALESCE(?, date_creation),
        taux_remuneration = COALESCE(?, taux_remuneration),
        taux_imposition = COALESCE(?, taux_imposition),
        solde_initial = COALESCE(?, solde_initial)
       WHERE id = ?`,
      [nom_court, description, date_creation, taux_remuneration, taux_imposition, solde_initial, req.params.id]
    );

    const [updated] = await db.execute('SELECT * FROM compte WHERE id = ?', [req.params.id]);
    const solde = await calculerSolde(db, updated[0]);

    return res.json({ compte: { ...updated[0], solde } });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = await getPool();
    const userId = req.auth.sub;

    const [rows] = await db.execute(
      'SELECT * FROM compte WHERE id = ? AND utilisateur_id = ?',
      [req.params.id, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    await db.execute('DELETE FROM depense WHERE compte_id = ?', [req.params.id]);
    await db.execute('DELETE FROM revenu WHERE compte_id = ?', [req.params.id]);
    await db.execute('DELETE FROM compte WHERE id = ?', [req.params.id]);

    return res.json({ message: 'Compte supprimé.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
