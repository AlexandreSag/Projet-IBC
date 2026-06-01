const nodemailer = require('nodemailer');

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getMailerConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.mail.ovh.net',
    port: Number(process.env.SMTP_PORT || 465),
    secure: parseBoolean(process.env.SMTP_SECURE, true),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 8000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 8000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 10000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };
}

function buildFromHeader() {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'Budgie';

  if (!fromEmail) {
    throw new Error('SMTP_FROM_EMAIL or SMTP_USER must be configured.');
  }

  return `"${fromName.replace(/"/g, '\\"')}" <${fromEmail}>`;
}

async function sendVerificationEmail({ to, verificationUrl, prenom, nom }) {
  if (!isEmailConfigured()) {
    throw new Error('SMTP credentials are not configured.');
  }

  const transporter = nodemailer.createTransport(getMailerConfig());
  const displayName = [prenom, nom].filter(Boolean).join(' ').trim() || to;

  await transporter.sendMail({
    from: buildFromHeader(),
    to,
    subject: 'Confirmez votre adresse email',
    text: [
      `Bonjour ${displayName},`,
      '',
      'Merci pour votre inscription sur Budgie.',
      'Confirmez votre adresse email en ouvrant ce lien :',
      verificationUrl,
      '',
      'Ce lien expire dans 24 heures.',
    ].join('\n'),
    html: `
      <p>Bonjour ${displayName},</p>
      <p>Merci pour votre inscription sur <strong>Budgie</strong>.</p>
      <p>Confirmez votre adresse email en cliquant sur le lien ci-dessous :</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>Ce lien expire dans 24 heures.</p>
    `,
  });
}

async function sendShareInvitationEmail({
  to,
  invitationUrl,
  ownerName,
  compteNom,
}) {
  if (!isEmailConfigured()) {
    throw new Error('SMTP credentials are not configured.');
  }

  const transporter = nodemailer.createTransport(getMailerConfig());
  const displayOwner = ownerName || 'Un utilisateur Budgie';

  await transporter.sendMail({
    from: buildFromHeader(),
    to,
    subject: 'Invitation à consulter un compte partagé sur Budgie',
    text: [
      `Bonjour,`,
      '',
      `${displayOwner} vous invite à consulter le compte "${compteNom}" sur Budgie en lecture seule.`,
      'Ouvrez ce lien pour accepter le partage :',
      invitationUrl,
      '',
      'Le lien expire dans 7 jours.',
    ].join('\n'),
    html: `
      <p>Bonjour,</p>
      <p><strong>${displayOwner}</strong> vous invite à consulter le compte <strong>${compteNom}</strong> sur Budgie en lecture seule.</p>
      <p>Ouvrez ce lien pour accepter le partage :</p>
      <p><a href="${invitationUrl}">${invitationUrl}</a></p>
      <p>Le lien expire dans 7 jours.</p>
    `,
  });
}

module.exports = {
  isEmailConfigured,
  sendShareInvitationEmail,
  sendVerificationEmail,
};
