const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const abonnementService = require('../services/abonnementService');
const revenuValidator = require('../validators/revenuValidator');
const revenuService = require('../services/revenuService');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const revenus = await revenuService.getAllRevenusForUser(userId);
    return res.json({ revenus });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const validated = revenuValidator.validateRevenuPayload(req.body || {});

    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const payload = validated.value;
    const isOwner = await revenuService.ensureCompteOwner(payload.compte_id, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Compte invalide pour cet utilisateur.' });
    }

    const quota = await abonnementService.canCreateRevenu(userId, payload.compte_id);
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

    const insertId = await revenuService.createRevenu(payload);
    const revenu = await revenuService.getRevenuByIdForUser(insertId, userId);

    return res.status(201).json({ revenu });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const revenuId = Number(req.params.id);

    if (!Number.isInteger(revenuId) || revenuId <= 0) {
      return res.status(400).json({ error: 'Identifiant de revenu invalide.' });
    }

    const existing = await revenuService.getRevenuByIdForUser(revenuId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Revenu introuvable.' });
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

    const validated = revenuValidator.validateRevenuPayload(mergedPayload);
    if (validated.error) {
      return res.status(400).json({ error: validated.error });
    }

    const payload = validated.value;
    const isOwner = await revenuService.ensureCompteOwner(payload.compte_id, userId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Compte invalide pour cet utilisateur.' });
    }

    await revenuService.updateRevenu(revenuId, payload);
    const revenu = await revenuService.getRevenuByIdForUser(revenuId, userId);

    return res.json({ revenu });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const revenuId = Number(req.params.id);

    if (!Number.isInteger(revenuId) || revenuId <= 0) {
      return res.status(400).json({ error: 'Identifiant de revenu invalide.' });
    }

    const existing = await revenuService.getRevenuByIdForUser(revenuId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Revenu introuvable.' });
    }

    await revenuService.deleteRevenu(revenuId);
    return res.json({ message: 'Revenu supprimé.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
