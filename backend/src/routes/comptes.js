const express = require('express');
const { getPool } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');
const abonnementService = require('../services/abonnementService');
const { getPrevisionForUser, parseDateValue } = require('../services/previsionService');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const search = String(req.query.search || '').trim().toLowerCase();
    const targetDate = parseDateValue(new Date());
    const prevision = await getPrevisionForUser(userId, targetDate);

    const comptes = prevision.comptes
      .map((comptePrevision) => ({
        id: comptePrevision.id,
        nom_court: comptePrevision.nom_court,
        description: comptePrevision.description,
        date_creation: comptePrevision.date_creation,
        taux_remuneration: comptePrevision.taux_remuneration,
        taux_imposition: comptePrevision.taux_imposition,
        solde_initial: comptePrevision.solde_initial,
        solde: comptePrevision.solde_previsionnel,
      }))
      .filter((compte) => {
        if (!search) return true;
        return (
          String(compte.nom_court || '').toLowerCase().includes(search)
          || String(compte.description || '').toLowerCase().includes(search)
        );
      })
      .sort((left, right) => {
        const leftDate = new Date(left.date_creation).getTime();
        const rightDate = new Date(right.date_creation).getTime();
        return rightDate - leftDate;
      });

    return res.json({ comptes });
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
      [req.params.id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    const targetDate = parseDateValue(new Date());
    const prevision = await getPrevisionForUser(userId, targetDate);
    const comptePrevision = prevision.comptes.find((compte) => String(compte.id) === String(req.params.id));

    if (!comptePrevision) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    return res.json({
      compte: {
        ...rows[0],
        solde: comptePrevision.solde_previsionnel,
      },
    });
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
      [userId, nom_court, description, date_creation, taux_remuneration, taux_imposition, solde_initial],
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
      [req.params.id, userId],
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
      [nom_court, description, date_creation, taux_remuneration, taux_imposition, solde_initial, req.params.id],
    );

    const [updated] = await db.execute('SELECT * FROM compte WHERE id = ?', [req.params.id]);
    const targetDate = parseDateValue(new Date());
    const prevision = await getPrevisionForUser(userId, targetDate);
    const comptePrevision = prevision.comptes.find((compte) => String(compte.id) === String(req.params.id));

    return res.json({
      compte: {
        ...updated[0],
        solde: comptePrevision?.solde_previsionnel ?? 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  let connection;
  try {
    const db = await getPool();
    connection = await db.getConnection();
    const userId = req.auth.sub;
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      'SELECT id FROM compte WHERE id = ? AND utilisateur_id = ? FOR UPDATE',
      [req.params.id, userId],
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    await connection.execute('DELETE FROM partage_invitation WHERE compte_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM partage WHERE compte_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM depense WHERE compte_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM revenu WHERE compte_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM compte WHERE id = ?', [req.params.id]);
    await connection.commit();

    return res.json({ message: 'Compte supprimé.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return next(error);
  } finally {
    connection?.release();
  }
});

module.exports = router;
