const jwt = require('jsonwebtoken');

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.token || extractBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

module.exports = {
  authMiddleware,
};
