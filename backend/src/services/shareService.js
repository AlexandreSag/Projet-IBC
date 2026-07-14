const crypto = require('crypto');
const { getPool } = require('../config/database');
const { getPrevisionForUser, parseDateValue } = require('./previsionService');

const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const SHARE_RIGHTS = {
  READ_ONLY: 'read_only',
};

const INVITATION_TTL_MS = Number(process.env.SHARE_INVITATION_TTL_MS || 7 * 24 * 60 * 60 * 1000);

function buildInvitationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getInvitationExpiresAt() {
  return new Date(Date.now() + INVITATION_TTL_MS);
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  const [localPart, domain = ''] = normalized.split('@');
  if (!localPart || !domain) return normalized;
  if (localPart.length <= 2) return `${localPart[0] || '*'}*@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function formatOutgoingShare(row) {
  return {
    id: Number(row.id),
    compteId: Number(row.compte_id),
    compteNom: row.compte_nom,
    inviteeId: row.utilisateur_id ? Number(row.utilisateur_id) : null,
    inviteeEmail: row.invitee_email,
    inviteeNom: [row.invitee_prenom, row.invitee_nom].filter(Boolean).join(' ').trim() || null,
    droits: row.droits || SHARE_RIGHTS.READ_ONLY,
    datePartage: row.date_partage,
  };
}

function formatInvitation(row) {
  return {
    id: Number(row.id),
    compteId: Number(row.compte_id),
    compteNom: row.compte_nom,
    inviteeEmail: row.email_invite,
    invitedUserId: row.invite_utilisateur_id ? Number(row.invite_utilisateur_id) : null,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function formatIncomingShare(row) {
  return {
    id: Number(row.id),
    compteId: Number(row.compte_id),
    compteNom: row.compte_nom,
    description: row.compte_description,
    ownerId: Number(row.owner_id),
    ownerEmail: row.owner_email,
    ownerName: [row.owner_prenom, row.owner_nom].filter(Boolean).join(' ').trim() || row.owner_email,
    droits: row.droits || SHARE_RIGHTS.READ_ONLY,
    datePartage: row.date_partage,
    dateCreation: row.date_creation,
    soldeInitial: Number(row.solde_initial || 0),
  };
}

async function ensureOwnedCompte(compteId, ownerId, executor = null) {
  const db = executor || await getPool();
  const [rows] = await db.execute(
    'SELECT id, nom_court FROM compte WHERE id = ? AND utilisateur_id = ? LIMIT 1',
    [compteId, ownerId],
  );
  return rows[0] || null;
}

async function getOutgoingSharesForUser(userId) {
  const db = await getPool();
  const [sharesRows, invitationRows] = await Promise.all([
    db.execute(
      `SELECT
        p.id,
        p.compte_id,
        p.utilisateur_id,
        p.droits,
        p.date_partage,
        c.nom_court AS compte_nom,
        u.email AS invitee_email,
        u.nom AS invitee_nom,
        u.prenom AS invitee_prenom
       FROM partage p
       INNER JOIN compte c ON c.id = p.compte_id
       INNER JOIN utilisateur u ON u.id = p.utilisateur_id
       WHERE c.utilisateur_id = ?
       ORDER BY p.date_partage DESC, p.id DESC`,
      [userId],
    ),
    db.execute(
      `SELECT
        i.id,
        i.compte_id,
        i.invite_utilisateur_id,
        i.email_invite,
        i.status,
        i.expires_at,
        i.accepted_at,
        i.created_at,
        c.nom_court AS compte_nom
       FROM partage_invitation i
       INNER JOIN compte c ON c.id = i.compte_id
       WHERE i.inviteur_id = ?
       ORDER BY i.created_at DESC, i.id DESC`,
      [userId],
    ),
  ]);

  return {
    shares: sharesRows[0].map(formatOutgoingShare),
    invitations: invitationRows[0].map(formatInvitation),
  };
}

async function getIncomingSharesForUser(userId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT
      p.id,
      p.compte_id,
      p.droits,
      p.date_partage,
      c.nom_court AS compte_nom,
      c.description AS compte_description,
      c.date_creation,
      c.solde_initial,
      owner.id AS owner_id,
      owner.nom AS owner_nom,
      owner.prenom AS owner_prenom,
      owner.email AS owner_email
     FROM partage p
     INNER JOIN compte c ON c.id = p.compte_id
     INNER JOIN utilisateur owner ON owner.id = c.utilisateur_id
     WHERE p.utilisateur_id = ?
     ORDER BY p.date_partage DESC, p.id DESC`,
    [userId],
  );

  return rows.map(formatIncomingShare);
}

async function getSharedAccountDetailForUser(userId, shareId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT
      p.id,
      p.compte_id,
      p.droits,
      p.date_partage,
      c.utilisateur_id AS owner_id,
      c.nom_court,
      c.description,
      c.date_creation,
      c.taux_remuneration,
      c.taux_imposition,
      c.solde_initial,
      owner.nom AS owner_nom,
      owner.prenom AS owner_prenom,
      owner.email AS owner_email
     FROM partage p
     INNER JOIN compte c ON c.id = p.compte_id
     INNER JOIN utilisateur owner ON owner.id = c.utilisateur_id
     WHERE p.id = ? AND p.utilisateur_id = ?
     LIMIT 1`,
    [shareId, userId],
  );

  const share = rows[0];
  if (!share) {
    const error = new Error('Compte partagé introuvable.');
    error.statusCode = 404;
    throw error;
  }

  const [depenseRows, revenuRows, prevision] = await Promise.all([
    db.execute('SELECT * FROM depense WHERE compte_id = ? ORDER BY date_debut DESC, id DESC', [share.compte_id]),
    db.execute('SELECT * FROM revenu WHERE compte_id = ? ORDER BY date_debut DESC, id DESC', [share.compte_id]),
    getPrevisionForUser(share.owner_id, parseDateValue(new Date())),
  ]);

  const comptePrevision = prevision.comptes.find((compte) => Number(compte.id) === Number(share.compte_id));

  // Le solde est calculé avec les données du propriétaire du compte partagé.
  return {
    share: {
      id: Number(share.id),
      droits: share.droits || SHARE_RIGHTS.READ_ONLY,
      datePartage: share.date_partage,
    },
    owner: {
      id: Number(share.owner_id),
      nom: share.owner_nom,
      prenom: share.owner_prenom,
      email: share.owner_email,
      displayName: [share.owner_prenom, share.owner_nom].filter(Boolean).join(' ').trim() || share.owner_email,
    },
    compte: {
      id: Number(share.compte_id),
      nom_court: share.nom_court,
      description: share.description,
      date_creation: share.date_creation,
      taux_remuneration: share.taux_remuneration,
      taux_imposition: share.taux_imposition,
      solde_initial: share.solde_initial,
      solde: comptePrevision?.solde_previsionnel ?? Number(share.solde_initial || 0),
    },
    depenses: depenseRows[0],
    revenus: revenuRows[0],
  };
}

async function createShareInvitation({ ownerId, compteId, invitedEmail, appBaseUrl }) {
  const db = await getPool();
  const normalizedEmail = normalizeEmail(invitedEmail);

  if (!normalizedEmail) {
    const error = new Error('L’adresse email est requise.');
    error.statusCode = 400;
    throw error;
  }

  const compte = await ensureOwnedCompte(compteId, ownerId, db);
  if (!compte) {
    const error = new Error('Compte introuvable.');
    error.statusCode = 404;
    throw error;
  }

  const [ownerResult, inviteeResult, shareResult] = await Promise.all([
    db.execute('SELECT id, nom, prenom, email FROM utilisateur WHERE id = ? LIMIT 1', [ownerId]),
    db.execute('SELECT id, email FROM utilisateur WHERE email = ? LIMIT 1', [normalizedEmail]),
    db.execute(
      `SELECT p.id
       FROM partage p
       INNER JOIN compte c ON c.id = p.compte_id
       INNER JOIN utilisateur u ON u.id = p.utilisateur_id
       WHERE c.id = ? AND c.utilisateur_id = ? AND LOWER(u.email) = ?
       LIMIT 1`,
      [compteId, ownerId, normalizedEmail],
    ),
  ]);

  const owner = ownerResult[0][0];
  const invitee = inviteeResult[0][0] || null;
  const existingShare = shareResult[0][0] || null;

  if (!owner) {
    const error = new Error('Utilisateur introuvable.');
    error.statusCode = 404;
    throw error;
  }

  if (normalizeEmail(owner.email) === normalizedEmail) {
    const error = new Error('Vous ne pouvez pas vous inviter vous-même.');
    error.statusCode = 400;
    throw error;
  }

  if (existingShare?.id) {
    const error = new Error('Ce compte est déjà partagé avec cette adresse email.');
    error.statusCode = 409;
    throw error;
  }

  const [pendingRows] = await db.execute(
    `SELECT id
     FROM partage_invitation
     WHERE compte_id = ?
       AND inviteur_id = ?
       AND email_invite = ?
       AND status = ?
     LIMIT 1`,
    [compteId, ownerId, normalizedEmail, INVITATION_STATUS.PENDING],
  );

  if (pendingRows[0]?.id) {
    const error = new Error('Une invitation est déjà en attente pour cette adresse email.');
    error.statusCode = 409;
    throw error;
  }

  const { token, tokenHash } = buildInvitationToken();
  const expiresAt = getInvitationExpiresAt();
  const inviteeId = invitee?.id || null;

  // La base garde seulement le hash. Le token complet reste dans le lien envoyé par email.
  const [result] = await db.execute(
    `INSERT INTO partage_invitation (
      compte_id,
      inviteur_id,
      invite_utilisateur_id,
      email_invite,
      token_hash,
      status,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [compteId, ownerId, inviteeId, normalizedEmail, tokenHash, INVITATION_STATUS.PENDING, expiresAt],
  );

  return {
    invitation: {
      id: Number(result.insertId),
      compteId: Number(compteId),
      compteNom: compte.nom_court,
      inviteeEmail: normalizedEmail,
      status: INVITATION_STATUS.PENDING,
      expiresAt,
    },
    invitationUrl: `${String(appBaseUrl || '').replace(/\/$/, '')}/sharing/invitation?token=${encodeURIComponent(token)}`,
    owner,
  };
}

async function getInvitationByToken(token) {
  const db = await getPool();
  const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const [rows] = await db.execute(
    `SELECT
      i.*,
      c.nom_court AS compte_nom,
      owner.nom AS owner_nom,
      owner.prenom AS owner_prenom,
      owner.email AS owner_email
     FROM partage_invitation i
     INNER JOIN compte c ON c.id = i.compte_id
     INNER JOIN utilisateur owner ON owner.id = i.inviteur_id
     WHERE i.token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );

  const row = rows[0];
  if (!row) {
    const error = new Error('Invitation introuvable.');
    error.statusCode = 404;
    throw error;
  }

  if (row.status === INVITATION_STATUS.PENDING && new Date(row.expires_at).getTime() < Date.now()) {
    await db.execute('UPDATE partage_invitation SET status = ? WHERE id = ?', [INVITATION_STATUS.EXPIRED, row.id]);
    row.status = INVITATION_STATUS.EXPIRED;
  }

  return row;
}

async function getInvitationPreview(token) {
  const row = await getInvitationByToken(token);
  return {
    id: Number(row.id),
    compteNom: row.compte_nom,
    inviteeEmailMasked: maskEmail(row.email_invite),
    ownerName: [row.owner_prenom, row.owner_nom].filter(Boolean).join(' ').trim() || row.owner_email,
    ownerEmail: row.owner_email,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

async function acceptInvitation(userId, token) {
  const db = await getPool();
  const invitation = await getInvitationByToken(token);

  if (invitation.status !== INVITATION_STATUS.PENDING) {
    const error = new Error(
      invitation.status === INVITATION_STATUS.ACCEPTED
        ? 'Cette invitation a déjà été acceptée.'
        : 'Cette invitation n’est plus valide.',
    );
    error.statusCode = 409;
    throw error;
  }

  const [userResult] = await Promise.all([
    db.execute('SELECT id, email FROM utilisateur WHERE id = ? LIMIT 1', [userId]),
  ]);

  const user = userResult[0][0];
  if (!user) {
    const error = new Error('Utilisateur introuvable.');
    error.statusCode = 404;
    throw error;
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invitation.email_invite)) {
    const error = new Error('Cette invitation est liée à une autre adresse email.');
    error.statusCode = 403;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    // Le partage et l'acceptation de l'invitation sont enregistrés ensemble.
    await connection.beginTransaction();

    const [existingShareRows] = await connection.execute(
      'SELECT id FROM partage WHERE compte_id = ? AND utilisateur_id = ? LIMIT 1',
      [invitation.compte_id, userId],
    );

    let shareId = existingShareRows[0]?.id || null;
    if (!shareId) {
      const [shareResult] = await connection.execute(
        'INSERT INTO partage (compte_id, utilisateur_id, droits) VALUES (?, ?, ?)',
        [invitation.compte_id, userId, SHARE_RIGHTS.READ_ONLY],
      );
      shareId = shareResult.insertId;
    }

    await connection.execute(
      `UPDATE partage_invitation
       SET status = ?, accepted_at = NOW(), invite_utilisateur_id = ?
       WHERE id = ?`,
      [INVITATION_STATUS.ACCEPTED, userId, invitation.id],
    );

    await connection.commit();
    return Number(shareId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function revokeShareForOwner(ownerId, shareId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT p.id
     FROM partage p
     INNER JOIN compte c ON c.id = p.compte_id
     WHERE p.id = ? AND c.utilisateur_id = ?
     LIMIT 1`,
    [shareId, ownerId],
  );

  if (!rows[0]) {
    const error = new Error('Partage introuvable.');
    error.statusCode = 404;
    throw error;
  }

  await db.execute('DELETE FROM partage WHERE id = ?', [shareId]);
}

async function cancelInvitationForOwner(ownerId, invitationId) {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT id
     FROM partage_invitation
     WHERE id = ? AND inviteur_id = ?
     LIMIT 1`,
    [invitationId, ownerId],
  );

  if (!rows[0]) {
    const error = new Error('Invitation introuvable.');
    error.statusCode = 404;
    throw error;
  }

  await db.execute(
    'UPDATE partage_invitation SET status = ? WHERE id = ? AND status = ?',
    [INVITATION_STATUS.CANCELLED, invitationId, INVITATION_STATUS.PENDING],
  );
}

module.exports = {
  INVITATION_STATUS,
  SHARE_RIGHTS,
  acceptInvitation,
  cancelInvitationForOwner,
  createShareInvitation,
  getIncomingSharesForUser,
  getInvitationPreview,
  getOutgoingSharesForUser,
  getSharedAccountDetailForUser,
  revokeShareForOwner,
};
