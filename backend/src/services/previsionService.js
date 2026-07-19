const { getPool } = require('../config/database');

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string') {
    // La date est créée en heure locale pour éviter un décalage d'un jour avec UTC.
    const normalized = value.includes('T') ? value.slice(0, 10) : value;
    const [year, month, day] = normalized.split('-').map((part) => Number(part));
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const fallbackDate = new Date(value);
  if (Number.isNaN(fallbackDate.getTime())) return null;

  return new Date(
    fallbackDate.getFullYear(),
    fallbackDate.getMonth(),
    fallbackDate.getDate(),
  );
}

function toIsoDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

function getMonthEnd(dateValue) {
  return getLastDayOfMonth(dateValue.getFullYear(), dateValue.getMonth());
}

function getMonthStart(dateValue) {
  return new Date(dateValue.getFullYear(), dateValue.getMonth(), 1);
}

function addMonthsClamped(dateValue, months) {
  const year = dateValue.getFullYear();
  const month = dateValue.getMonth();
  const day = dateValue.getDate();
  const targetMonthIndex = month + months;
  const monthStart = new Date(year, targetMonthIndex, 1);
  const monthEnd = getLastDayOfMonth(monthStart.getFullYear(), monthStart.getMonth());
  // Le 31 janvier devient le dernier jour de février au lieu de passer en mars.
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    Math.min(day, monthEnd.getDate()),
  );
}

function compareDates(left, right) {
  return left.getTime() - right.getTime();
}

function buildOccurrenceDates(item, targetDate, minimumDate) {
  const startDate = parseDateValue(item.date_debut);
  if (!startDate || startDate > targetDate) return [];

  const endDate = item.date_fin ? parseDateValue(item.date_fin) : null;
  const effectiveEnd = endDate && endDate < targetDate ? endDate : targetDate;
  if (startDate > effectiveEnd) return [];

  const frequency = Number(item.frequence_mois || 0);
  const dates = [];

  if (frequency === 0) {
    if (startDate >= minimumDate) {
      dates.push(startDate);
    }
    return dates;
  }

  if (!Number.isInteger(frequency) || frequency < 1) {
    return dates;
  }

  let current = new Date(startDate);
  while (current < minimumDate) {
    current = addMonthsClamped(current, frequency);
  }

  while (current <= effectiveEnd) {
    dates.push(new Date(current));
    current = addMonthsClamped(current, frequency);
  }

  return dates;
}

function buildAccountOccurrences(compte, depenses, revenus, targetDate) {
  const creationDate = parseDateValue(compte.date_creation);
  if (!creationDate || creationDate > targetDate) {
    return [];
  }

  const minimumDate = creationDate;
  const depenseOccurrences = depenses.flatMap((depense) => (
    buildOccurrenceDates(depense, targetDate, minimumDate).map((dateValue) => ({
      type: 'depense',
      amount: roundCurrency(depense.montant),
      date: dateValue,
      dateIso: toIsoDate(dateValue),
      label: depense.nom_court,
    }))
  ));

  const revenuOccurrences = revenus.flatMap((revenu) => (
    buildOccurrenceDates(revenu, targetDate, minimumDate).map((dateValue) => ({
      type: 'revenu',
      amount: roundCurrency(revenu.montant),
      date: dateValue,
      dateIso: toIsoDate(dateValue),
      label: revenu.nom_court,
    }))
  ));

  return [...depenseOccurrences, ...revenuOccurrences].sort((left, right) => {
    const dateDifference = compareDates(left.date, right.date);
    if (dateDifference !== 0) return dateDifference;
    return left.type.localeCompare(right.type);
  });
}

function buildMonthlyTimeline(compte, targetDate, occurrences) {
  const creationDate = parseDateValue(compte.date_creation);
  if (!creationDate || creationDate > targetDate) {
    return {
      balance: 0,
      revenusTotal: 0,
      depensesTotal: 0,
      interetsTotal: 0,
      impotsTotal: 0,
      monthlySnapshots: [],
    };
  }

  let balance = roundCurrency(compte.solde_initial);
  let revenusTotal = 0;
  let depensesTotal = 0;
  let interetsTotal = 0;
  let impotsTotal = 0;
  let occurrenceIndex = 0;
  const monthlySnapshots = [];
  const monthlyRate = Number(compte.taux_remuneration || 0) / 100 / 12;
  const taxRate = Number(compte.taux_imposition || 0) / 100;
  let currentMonthEnd = getMonthEnd(creationDate);

  while (currentMonthEnd <= targetDate) {
    let revenusMois = 0;
    let depensesMois = 0;

    while (
      occurrenceIndex < occurrences.length
      && occurrences[occurrenceIndex].date <= currentMonthEnd
    ) {
      const occurrence = occurrences[occurrenceIndex];
      if (occurrence.type === 'revenu') {
        balance = roundCurrency(balance + occurrence.amount);
        revenusTotal = roundCurrency(revenusTotal + occurrence.amount);
        revenusMois = roundCurrency(revenusMois + occurrence.amount);
      } else {
        balance = roundCurrency(balance - occurrence.amount);
        depensesTotal = roundCurrency(depensesTotal + occurrence.amount);
        depensesMois = roundCurrency(depensesMois + occurrence.amount);
      }
      occurrenceIndex += 1;
    }

    // Les opérations du mois sont appliquées avant le calcul des intérêts.
    let interetsMois = 0;
    let impotsMois = 0;
    if (monthlyRate > 0 && balance > 0) {
      const interetsBrutsMois = roundCurrency(balance * monthlyRate);
      interetsMois = roundCurrency(balance * monthlyRate * (1 - taxRate));
      impotsMois = roundCurrency(interetsBrutsMois - interetsMois);
      balance = roundCurrency(balance + interetsMois);
      interetsTotal = roundCurrency(interetsTotal + interetsMois);
      impotsTotal = roundCurrency(impotsTotal + impotsMois);
    }

    monthlySnapshots.push({
      month: `${currentMonthEnd.getFullYear()}-${String(currentMonthEnd.getMonth() + 1).padStart(2, '0')}`,
      date: toIsoDate(currentMonthEnd),
      balance,
      revenus: revenusMois,
      depenses: depensesMois,
      interets: interetsMois,
      impots: impotsMois,
    });

    const nextMonthStart = addMonthsClamped(getMonthStart(currentMonthEnd), 1);
    currentMonthEnd = getMonthEnd(nextMonthStart);
  }

  const lastSnapshotDate = monthlySnapshots.length > 0
    ? parseDateValue(monthlySnapshots[monthlySnapshots.length - 1].date)
    : null;

  if (!lastSnapshotDate || lastSnapshotDate < targetDate) {
    let revenusPeriode = 0;
    let depensesPeriode = 0;

    while (
      occurrenceIndex < occurrences.length
      && occurrences[occurrenceIndex].date <= targetDate
    ) {
      const occurrence = occurrences[occurrenceIndex];
      if (occurrence.type === 'revenu') {
        balance = roundCurrency(balance + occurrence.amount);
        revenusTotal = roundCurrency(revenusTotal + occurrence.amount);
        revenusPeriode = roundCurrency(revenusPeriode + occurrence.amount);
      } else {
        balance = roundCurrency(balance - occurrence.amount);
        depensesTotal = roundCurrency(depensesTotal + occurrence.amount);
        depensesPeriode = roundCurrency(depensesPeriode + occurrence.amount);
      }
      occurrenceIndex += 1;
    }

    monthlySnapshots.push({
      month: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`,
      date: toIsoDate(targetDate),
      balance,
      revenus: revenusPeriode,
      depenses: depensesPeriode,
      interets: 0,
      impots: 0,
    });
  }

  return {
    balance,
    revenusTotal,
    depensesTotal,
    interetsTotal,
    impotsTotal,
    monthlySnapshots,
  };
}

function buildPrevisionForCompte(compte, depenses, revenus, targetDate) {
  const creationDate = parseDateValue(compte.date_creation);
  if (!creationDate || creationDate > targetDate) {
    return {
      id: compte.id,
      nom_court: compte.nom_court,
      description: compte.description,
      date_creation: compte.date_creation,
      target_date: toIsoDate(targetDate),
      status: 'inactive',
      solde_initial: roundCurrency(compte.solde_initial),
      solde_previsionnel: 0,
      revenus_total: 0,
      depenses_total: 0,
      interets_total: 0,
      impots_total: 0,
      taux_remuneration: Number(compte.taux_remuneration || 0),
      taux_imposition: Number(compte.taux_imposition || 0),
      monthly_snapshots: [],
    };
  }

  const occurrences = buildAccountOccurrences(compte, depenses, revenus, targetDate);
  const timeline = buildMonthlyTimeline(compte, targetDate, occurrences);

  return {
    id: compte.id,
    nom_court: compte.nom_court,
    description: compte.description,
    date_creation: compte.date_creation,
    target_date: toIsoDate(targetDate),
    status: 'active',
    solde_initial: roundCurrency(compte.solde_initial),
    solde_previsionnel: timeline.balance,
    revenus_total: timeline.revenusTotal,
    depenses_total: timeline.depensesTotal,
    interets_total: timeline.interetsTotal,
    impots_total: timeline.impotsTotal,
    taux_remuneration: Number(compte.taux_remuneration || 0),
    taux_imposition: Number(compte.taux_imposition || 0),
    monthly_snapshots: timeline.monthlySnapshots,
  };
}

async function loadPrevisionData(userId) {
  const db = await getPool();
  const [comptes] = await db.execute(
    'SELECT * FROM compte WHERE utilisateur_id = ? ORDER BY date_creation ASC, id ASC',
    [userId],
  );
  const [depenses] = await db.execute(
    `SELECT d.*, c.utilisateur_id
     FROM depense d
     INNER JOIN compte c ON c.id = d.compte_id
     WHERE c.utilisateur_id = ?`,
    [userId],
  );
  const [revenus] = await db.execute(
    `SELECT r.*, c.utilisateur_id
     FROM revenu r
     INNER JOIN compte c ON c.id = r.compte_id
     WHERE c.utilisateur_id = ?`,
    [userId],
  );

  return { comptes, depenses, revenus };
}

function parsePrevisionMonth(monthValue) {
  if (typeof monthValue !== 'string' || !/^\d{4}-\d{2}$/.test(monthValue)) {
    return null;
  }

  const [year, month] = monthValue.split('-').map((part) => Number(part));
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return getLastDayOfMonth(year, month - 1);
}

async function getPrevisionForUser(userId, targetDate) {
  const { comptes, depenses, revenus } = await loadPrevisionData(userId);

  const comptesPrevision = comptes.map((compte) => {
    const compteDepenses = depenses.filter((depense) => depense.compte_id === compte.id);
    const compteRevenus = revenus.filter((revenu) => revenu.compte_id === compte.id);
    return buildPrevisionForCompte(compte, compteDepenses, compteRevenus, targetDate);
  });

  const overview = comptesPrevision.reduce(
    (summary, compte) => ({
      total_solde: roundCurrency(summary.total_solde + compte.solde_previsionnel),
      total_revenus: roundCurrency(summary.total_revenus + compte.revenus_total),
      total_depenses: roundCurrency(summary.total_depenses + compte.depenses_total),
      total_interets: roundCurrency(summary.total_interets + compte.interets_total),
      total_impots: roundCurrency(summary.total_impots + compte.impots_total),
      comptes_actifs: summary.comptes_actifs + (compte.status === 'active' ? 1 : 0),
      comptes_inactifs: summary.comptes_inactifs + (compte.status === 'inactive' ? 1 : 0),
    }),
    {
      total_solde: 0,
      total_revenus: 0,
      total_depenses: 0,
      total_interets: 0,
      total_impots: 0,
      comptes_actifs: 0,
      comptes_inactifs: 0,
    },
  );

  return {
    target_date: toIsoDate(targetDate),
    comptes: comptesPrevision,
    overview,
  };
}

module.exports = {
  getPrevisionForUser,
  parsePrevisionMonth,
  parseDateValue,
  toIsoDate,
};
