const DUREE_TYPES = new Set(['ponctuelle', 'tous_les_n_mois']);

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

function parseMontant(value) {
  const montant = Number(value);
  if (!Number.isFinite(montant) || montant <= 0) {
    return null;
  }
  return Math.round(montant * 100) / 100;
}

function parseFrequence(value) {
  const frequence = Number(value);
  if (!Number.isInteger(frequence) || frequence < 1) {
    return null;
  }
  return frequence;
}

function validateDepensePayload(payload) {
  const nomCourt = typeof payload.nom_court === 'string' ? payload.nom_court.trim() : '';
  const description =
    payload.description === undefined || payload.description === null || payload.description === ''
      ? null
      : String(payload.description);
  const compteId = Number(payload.compte_id);
  const montant = parseMontant(payload.montant);
  const dureeType = String(payload.duree_type || '').trim();
  const dateDebut = normalizeDateValue(payload.date_debut);
  const dateFin = normalizeDateValue(payload.date_fin);

  if (!Number.isInteger(compteId) || compteId <= 0) {
    return { error: 'Le compte est requis.' };
  }
  if (!nomCourt) {
    return { error: 'Le nom est requis.' };
  }
  if (!montant) {
    return { error: 'Le montant doit être un nombre strictement positif.' };
  }
  if (!DUREE_TYPES.has(dureeType)) {
    return { error: 'La durée doit être ponctuelle ou tous_les_n_mois.' };
  }
  if (!dateDebut) {
    return { error: 'La date de début est invalide.' };
  }

  const frequenceMois =
    dureeType === 'ponctuelle'
      ? 0
      : parseFrequence(payload.frequence_mois);

  if (dureeType === 'tous_les_n_mois' && !frequenceMois) {
    return { error: 'La fréquence (en mois) est requise pour une dépense récurrente.' };
  }

  if (dateFin && dateFin < dateDebut) {
    return { error: 'La date de fin doit être postérieure à la date de début.' };
  }

  return {
    value: {
      compte_id: compteId,
      nom_court: nomCourt,
      description,
      montant,
      duree_type: dureeType,
      frequence_mois: frequenceMois,
      date_debut: dateDebut,
      date_fin: dateFin,
    },
  };
}

module.exports = {
  validateDepensePayload,
};
