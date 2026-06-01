const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const shareService = require('../services/shareService');
const { sendShareInvitationEmail } = require('../services/emailService');

const router = express.Router();

function getAppBaseUrl(req) {
  return (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

router.get('/invitations/:token', async (req, res, next) => {
  try {
    const preview = await shareService.getInvitationPreview(req.params.token);
    return res.json({ invitation: preview });
  } catch (error) {
    return next(error);
  }
});

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const [sharedByMe, sharedWithMe] = await Promise.all([
      shareService.getOutgoingSharesForUser(req.auth.sub),
      shareService.getIncomingSharesForUser(req.auth.sub),
    ]);

    return res.json({
      sharedByMe,
      sharedWithMe,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/invitations', async (req, res, next) => {
  try {
    const compteId = Number(req.body?.compteId);
    const email = req.body?.email;

    if (!Number.isInteger(compteId) || compteId <= 0 || !email) {
      return res.status(400).json({ error: 'compteId et email sont requis.' });
    }

    const result = await shareService.createShareInvitation({
      ownerId: req.auth.sub,
      compteId,
      invitedEmail: email,
      appBaseUrl: getAppBaseUrl(req),
    });

    try {
      await sendShareInvitationEmail({
        to: result.invitation.inviteeEmail,
        invitationUrl: result.invitationUrl,
        ownerName: [result.owner.prenom, result.owner.nom].filter(Boolean).join(' ').trim() || result.owner.email,
        compteNom: result.invitation.compteNom,
      });
    } catch (error) {
      await shareService.cancelInvitationForOwner(req.auth.sub, result.invitation.id);
      const mailError = new Error('Impossible d’envoyer l’invitation par email.');
      mailError.statusCode = 502;
      mailError.cause = error;
      throw mailError;
    }

    return res.status(201).json({
      message: 'Invitation envoyée.',
      invitation: result.invitation,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/invitations/:token/accept', async (req, res, next) => {
  try {
    const shareId = await shareService.acceptInvitation(req.auth.sub, req.params.token);
    return res.json({
      message: 'Le compte partagé a bien été ajouté à votre espace.',
      shareId,
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/invitations/:invitationId', async (req, res, next) => {
  try {
    const invitationId = Number(req.params.invitationId);
    if (!Number.isInteger(invitationId) || invitationId <= 0) {
      return res.status(400).json({ error: 'Identifiant d’invitation invalide.' });
    }

    await shareService.cancelInvitationForOwner(req.auth.sub, invitationId);
    return res.json({ message: 'Invitation annulée.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/received/:shareId', async (req, res, next) => {
  try {
    const shareId = Number(req.params.shareId);
    if (!Number.isInteger(shareId) || shareId <= 0) {
      return res.status(400).json({ error: 'Identifiant de partage invalide.' });
    }

    const detail = await shareService.getSharedAccountDetailForUser(req.auth.sub, shareId);
    return res.json(detail);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:shareId', async (req, res, next) => {
  try {
    const shareId = Number(req.params.shareId);
    if (!Number.isInteger(shareId) || shareId <= 0) {
      return res.status(400).json({ error: 'Identifiant de partage invalide.' });
    }

    await shareService.revokeShareForOwner(req.auth.sub, shareId);
    return res.json({ message: 'Accès révoqué.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
