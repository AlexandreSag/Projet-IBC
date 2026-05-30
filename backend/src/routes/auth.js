const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');
const abonnementService = require('../services/abonnementService');
const abonnementPaymentService = require('../services/abonnementPaymentService');
const subscriptionRenewalService = require('../services/subscriptionRenewalService');
const { sendVerificationEmail } = require('../services/emailService');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const JWT_COOKIE_NAME = 'token';
const JWT_COOKIE_TTL_MS = Number(process.env.JWT_COOKIE_TTL_MS || 24 * 60 * 60 * 1000);
const EMAIL_VERIFICATION_TTL_MS = Number(process.env.EMAIL_VERIFICATION_TTL_MS || 24 * 60 * 60 * 1000);

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwtSecret;
}

function issueJwt(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: JWT_COOKIE_TTL_MS,
    path: '/',
  };
}

function clearAuthCookie(res) {
  const { path, sameSite, secure, httpOnly } = getCookieOptions();
  res.clearCookie(JWT_COOKIE_NAME, { path, sameSite, secure, httpOnly });
}

function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 12) {
    return false;
  }
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#?%&*]/.test(password)
  );
}

async function getSessionUserById(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    'SELECT id, nom, prenom, email, email_verifie FROM utilisateur WHERE id = ?',
    [userId],
  );

  if (rows.length === 0) {
    return null;
  }

  const abonnement = await abonnementService.getUserAbonnement(userId);
  return {
    ...rows[0],
    abonnement,
  };
}

async function refreshSessionResponse(res, userId, payload = {}) {
  const sessionUser = await getSessionUserById(userId);
  if (!sessionUser) {
    clearAuthCookie(res);
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const token = issueJwt(sessionUser);
  res.cookie(JWT_COOKIE_NAME, token, getCookieOptions());

  return res.json({
    ...payload,
    utilisateur: sessionUser,
    token,
  });
}

function getAppBaseUrl(req) {
  return (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  return { token, tokenHash, expiresAt };
}

router.post('/register', async (req, res, next) => {
  const { nom = null, prenom = null, email, mot_de_passe: motDePasse } = req.body || {};

  if (!email || !motDePasse) {
    return res.status(400).json({ error: 'Email et mot de passe sont requis.' });
  }

  if (!isStrongPassword(motDePasse)) {
    return res.status(400).json({
      error:
        'Le mot de passe doit faire au moins 12 caractères avec majuscule, minuscule, chiffre et caractère spécial (!@#?%&*).',
    });
  }

  try {
    const db = await getPool();
    const normalizedEmail = email.trim();
    const normalizedNom = typeof nom === 'string' ? nom.trim() || null : null;
    const normalizedPrenom = typeof prenom === 'string' ? prenom.trim() || null : null;
    const [existing] = await db.execute('SELECT id, email_verifie FROM utilisateur WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      if (existing[0].email_verifie) {
        return res.status(409).json({ error: 'Un compte utilise déjà cet email.' });
      }

      await db.execute('DELETE FROM utilisateur WHERE id = ?', [existing[0].id]);
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    const { token, tokenHash, expiresAt } = createEmailVerificationToken();
    const [result] = await db.execute(
      `INSERT INTO utilisateur (
        nom,
        prenom,
        email,
        mot_de_passe,
        email_verifie,
        email_verification_token_hash,
        email_verification_token_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [normalizedNom, normalizedPrenom, normalizedEmail, hashedPassword, false, tokenHash, expiresAt],
    );

    const verificationUrl = `${getAppBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await sendVerificationEmail({
        to: normalizedEmail,
        verificationUrl,
        prenom: normalizedPrenom,
        nom: normalizedNom,
      });
    } catch (error) {
      await db.execute('DELETE FROM utilisateur WHERE id = ?', [result.insertId]);
      const mailError = new Error('Impossible d’envoyer l’email de vérification.');
      mailError.statusCode = 502;
      mailError.cause = error;
      throw mailError;
    }

    return res.status(201).json({
      message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
      utilisateurId: result.insertId,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/verify-email', async (req, res, next) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!token) {
    return res.status(400).json({ error: 'Lien de vérification invalide.' });
  }

  try {
    const db = await getPool();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await db.execute(
      `SELECT id
       FROM utilisateur
       WHERE email_verifie = FALSE
         AND email_verification_token_hash = ?
         AND email_verification_token_expires_at IS NOT NULL
         AND email_verification_token_expires_at >= NOW()
       LIMIT 1`,
      [tokenHash],
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Le lien de vérification est invalide ou expiré.' });
    }

    await db.execute(
      `UPDATE utilisateur
       SET email_verifie = TRUE,
           email_verification_token_hash = NULL,
           email_verification_token_expires_at = NULL
       WHERE id = ?`,
      [rows[0].id],
    );

    return res.json({ message: 'Adresse email vérifiée. Vous pouvez maintenant vous connecter.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const { email, mot_de_passe: motDePasse } = req.body || {};

  if (!email || !motDePasse) {
    return res.status(400).json({ error: 'Email et mot de passe sont requis.' });
  }

  try {
    const db = await getPool();
    const [rows] = await db.execute(
      'SELECT id, nom, prenom, email, mot_de_passe, email_verifie FROM utilisateur WHERE email = ?',
      [email.trim()],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(motDePasse, user.mot_de_passe);

    if (!passwordOk) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    if (!user.email_verifie) {
      return res.status(403).json({ error: 'Veuillez vérifier votre adresse email avant de vous connecter.' });
    }

    const token = issueJwt(user);
    res.cookie(JWT_COOKIE_NAME, token, getCookieOptions());

    const sessionUser = await getSessionUserById(user.id);
    return res.json({ message: 'Connexion réussie.', utilisateur: sessionUser, token });
  } catch (error) {
    return next(error);
  }
});

router.use(authMiddleware);

router.get('/me', async (req, res, next) => {
  try {
    const sessionUser = await getSessionUserById(req.auth.sub);
    if (!sessionUser) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session invalide.' });
    }

    return res.json({ utilisateur: sessionUser });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/abonnement-status', async (req, res, next) => {
  try {
    const status = await abonnementService.getUserAbonnementStatus(req.auth.sub);
    return res.json(status);
  } catch (error) {
    return next(error);
  }
});

router.post('/me/abonnement/payment-intent', async (req, res, next) => {
  try {
    const { planCode, cryptoCode } = req.body || {};
    const result = await abonnementPaymentService.createPaymentIntentForUser(req.auth.sub, {
      planCode,
      cryptoCode,
    });

    return res.status(201).json({
      message: 'Demande de paiement créée.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/abonnement/payment-status/:paymentIntentId', async (req, res, next) => {
  try {
    const paymentIntent = await abonnementPaymentService.getPaymentIntentForUser(
      req.auth.sub,
      Number(req.params.paymentIntentId),
    );

    return res.json({ paymentIntent });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/abonnement/payment-intent/open', async (req, res, next) => {
  try {
    const paymentIntent = await abonnementPaymentService.getLatestOpenPaymentIntentForUser(req.auth.sub);
    return res.json({ paymentIntent });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/abonnement/renewal-settings', async (req, res, next) => {
  try {
    const renewal = await subscriptionRenewalService.getRenewalSettingsForUser(req.auth.sub);
    return res.json({ renewal });
  } catch (error) {
    return next(error);
  }
});

router.put('/me/abonnement/renewal-settings', async (req, res, next) => {
  try {
    const renewal = await subscriptionRenewalService.updateRenewalSettingsForUser(req.auth.sub, req.body || {});
    return res.json({
      message: renewal.mode === 'automatic'
        ? 'La configuration du renouvellement automatique est enregistrée et reste à finaliser.'
        : 'Le renouvellement automatique est désactivé.',
      renewal,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/abonnement/payments', async (req, res, next) => {
  try {
    const payments = await abonnementPaymentService.listPaymentsForUser(req.auth.sub, {
      limit: Number(req.query.limit) || 20,
    });

    return res.json({ payments });
  } catch (error) {
    return next(error);
  }
});

router.post('/me/abonnement/payment-confirmation', async (req, res, next) => {
  try {
    const paymentIntentId = Number(req.body?.paymentIntentId);
    const transactionHash = req.body?.transactionHash;

    if (!Number.isInteger(paymentIntentId) || paymentIntentId <= 0 || !transactionHash) {
      return res.status(400).json({ error: 'paymentIntentId et transactionHash sont requis.' });
    }

    const result = await abonnementPaymentService.confirmPaymentIntentForUser(
      req.auth.sub,
      paymentIntentId,
      transactionHash,
    );

    return refreshSessionResponse(res, req.auth.sub, {
      message: result.alreadyConfirmed
        ? 'Ce paiement Ethereum avait déjà été confirmé.'
        : 'Paiement Ethereum confirmé. Le plan Premium est maintenant actif.',
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/abonnement/downgrade-preview', async (req, res, next) => {
  try {
    const preview = await abonnementService.getUserDowngradePreview(req.auth.sub);
    return res.json(preview);
  } catch (error) {
    return next(error);
  }
});

router.post('/me/abonnement/downgrade', async (req, res, next) => {
  try {
    const result = await abonnementService.downgradeUserToFreeWithSelection(req.auth.sub, req.body || {});
    return refreshSessionResponse(res, req.auth.sub, {
      message: result?.scheduledOnly
        ? 'Le retour au plan gratuit est programmé à la fin de votre période Premium.'
        : 'Le retour au plan gratuit a été appliqué.',
      downgrade: result || null,
    });
  } catch (error) {
    if (error.statusCode && error.details) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...error.details,
      });
    }
    return next(error);
  }
});

router.put('/me', async (req, res, next) => {
  const { nom = null, prenom = null, email } = req.body || {};

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'L’email est requis.' });
  }

  try {
    const db = await getPool();
    const normalizedEmail = email.trim();
    const normalizedNom = typeof nom === 'string' ? nom.trim() || null : null;
    const normalizedPrenom = typeof prenom === 'string' ? prenom.trim() || null : null;

    const [existing] = await db.execute('SELECT id FROM utilisateur WHERE email = ? AND id <> ?', [normalizedEmail, req.auth.sub]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Un compte utilise déjà cet email.' });
    }

    await db.execute('UPDATE utilisateur SET nom = ?, prenom = ?, email = ? WHERE id = ?', [
      normalizedNom,
      normalizedPrenom,
      normalizedEmail,
      req.auth.sub,
    ]);

    const sessionUser = await getSessionUserById(req.auth.sub);
    if (!sessionUser) {
      clearAuthCookie(res);
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const token = issueJwt(sessionUser);
    res.cookie(JWT_COOKIE_NAME, token, getCookieOptions());

    return res.json({ message: 'Profil mis à jour.', utilisateur: sessionUser, token });
  } catch (error) {
    return next(error);
  }
});

router.put('/me/password', async (req, res, next) => {
  const {
    mot_de_passe_actuel: motDePasseActuel,
    nouveau_mot_de_passe: nouveauMotDePasse,
  } = req.body || {};

  if (!motDePasseActuel || !nouveauMotDePasse) {
    return res.status(400).json({ error: 'Le mot de passe actuel et le nouveau mot de passe sont requis.' });
  }

  if (!isStrongPassword(nouveauMotDePasse)) {
    return res.status(400).json({
      error:
        'Le mot de passe doit faire au moins 12 caractères avec majuscule, minuscule, chiffre et caractère spécial (!@#?%&*).',
    });
  }

  try {
    const db = await getPool();
    const [rows] = await db.execute('SELECT id, nom, prenom, email, mot_de_passe FROM utilisateur WHERE id = ?', [req.auth.sub]);

    if (rows.length === 0) {
      clearAuthCookie(res);
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(motDePasseActuel, user.mot_de_passe);

    if (!passwordOk) {
      return res.status(401).json({ error: 'Le mot de passe actuel est incorrect.' });
    }

    const isSamePassword = await bcrypt.compare(nouveauMotDePasse, user.mot_de_passe);
    if (isSamePassword) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l’ancien.' });
    }

    const hashedPassword = await bcrypt.hash(nouveauMotDePasse, 10);
    await db.execute('UPDATE utilisateur SET mot_de_passe = ? WHERE id = ?', [hashedPassword, req.auth.sub]);

    return res.json({ message: 'Mot de passe mis à jour.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ message: 'Déconnexion réussie.' });
});

module.exports = router;
