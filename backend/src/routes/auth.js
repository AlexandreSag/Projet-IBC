const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const JWT_COOKIE_NAME = 'token';
const JWT_COOKIE_TTL_MS = Number(process.env.JWT_COOKIE_TTL_MS || 24 * 60 * 60 * 1000);

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
    const [existing] = await db.execute('SELECT id FROM utilisateur WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Un compte utilise déjà cet email.' });
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    const [result] = await db.execute(
      'INSERT INTO utilisateur (nom, prenom, email, mot_de_passe) VALUES (?, ?, ?, ?)',
      [nom, prenom, email.trim(), hashedPassword],
    );

    return res.status(201).json({ message: 'Utilisateur créé.', utilisateurId: result.insertId });
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
      'SELECT id, nom, prenom, email, mot_de_passe FROM utilisateur WHERE email = ?',
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

    const token = issueJwt(user);
    res.cookie(JWT_COOKIE_NAME, token, getCookieOptions());

    const { mot_de_passe: ignored, ...safeUser } = user;
    return res.json({ message: 'Connexion réussie.', utilisateur: safeUser, token });
  } catch (error) {
    return next(error);
  }
});

router.use(authMiddleware);

router.get('/me', async (req, res, next) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute('SELECT id, nom, prenom, email FROM utilisateur WHERE id = ?', [req.auth.sub]);

    if (rows.length === 0) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session invalide.' });
    }

    return res.json({ utilisateur: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ message: 'Déconnexion réussie.' });
});

module.exports = router;
