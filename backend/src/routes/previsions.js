const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getPrevisionForUser, parsePrevisionMonth, toIsoDate } = require('../services/previsionService');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const requestedMonth = typeof req.query.month === 'string' ? req.query.month : '';
    const targetDate = parsePrevisionMonth(requestedMonth);

    if (!targetDate) {
      return res.status(400).json({ error: 'Le mois doit être au format YYYY-MM.' });
    }

    const prevision = await getPrevisionForUser(userId, targetDate);

    return res.json({
      month: requestedMonth,
      target_date: prevision.target_date,
      generated_at: toIsoDate(new Date()),
      overview: prevision.overview,
      comptes: prevision.comptes,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
