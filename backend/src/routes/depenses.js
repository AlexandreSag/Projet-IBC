const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const depenseValidator = require('../validators/depenseValidator');
const abonnementService = require('../services/abonnementService');
const depenseService = require('../services/depenseService');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const depenses = await depenseService.getAllDepensesForUser(userId);
    return res.json({ depenses });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const validated = depenseValidator.validateDepensePayload(req.body || {});

    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const payload = validated.value;
    const isOwner = await depenseService.ensureCompteOwner(payload.compte_id, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Compte invalide pour cet utilisateur.' });
    }

    const quota = await abonnementService.canCreateDepense(userId, payload.compte_id);
    if (!quota.allowed) {
      return res.status(403).json({
        error: quota.message,
        quota: {
          resource: quota.resource,
          used: quota.used,
          limit: quota.limit,
          compte_id: payload.compte_id,
        },
      });
    }

    const insertId = await depenseService.createDepense(payload);
    const depense = await depenseService.getDepenseByIdForUser(insertId, userId);
    
    return res.status(201).json({ depense });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const depenseId = Number(req.params.id);

    if (!Number.isInteger(depenseId) || depenseId <= 0) {
      return res.status(400).json({ error: 'Identifiant de dépense invalide.' });
    }

    const existing = await depenseService.getDepenseByIdForUser(depenseId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Dépense introuvable.' });
    }

    const mergedPayload = {
      compte_id: req.body?.compte_id ?? existing.compte_id,
      nom_court: req.body?.nom_court ?? existing.nom_court,
      description:
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'description')
          ? req.body.description
          : existing.description,
      montant: req.body?.montant ?? existing.montant,
      duree_type: req.body?.duree_type ?? existing.duree_type,
      frequence_mois: req.body?.frequence_mois ?? existing.frequence_mois,
      date_debut: req.body?.date_debut ?? existing.date_debut,
      date_fin:
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'date_fin')
          ? req.body.date_fin
          : existing.date_fin,
    };

    const validated = depenseValidator.validateDepensePayload(mergedPayload);
    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const payload = validated.value;
    const isOwner = await depenseService.ensureCompteOwner(payload.compte_id, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Compte invalide pour cet utilisateur.' });
    }

    await depenseService.updateDepense(depenseId, payload);
    const depense = await depenseService.getDepenseByIdForUser(depenseId, userId);
    
    return res.json({ depense });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const depenseId = Number(req.params.id);

    if (!Number.isInteger(depenseId) || depenseId <= 0) {
      return res.status(400).json({ error: 'Identifiant de dépense invalide.' });
    }

    const existing = await depenseService.getDepenseByIdForUser(depenseId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Dépense introuvable.' });
    }

    await depenseService.deleteDepense(depenseId);
    return res.json({ message: 'Dépense supprimée.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
