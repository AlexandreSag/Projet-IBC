export const freePlanFeatures = [
  { label: '2 comptes maximum', included: true },
  { label: '7 dépenses par compte', included: true },
  { label: '2 revenus par compte', included: true },
  { label: 'Vue claire des quotas', included: true },
  { label: 'Paiements blockchain', included: false },
  { label: 'Support prioritaire', included: false },
  { label: 'Suppression des limites', included: false },
];

export const premiumPlanFeatures = [
  { label: 'Comptes illimités' },
  { label: 'Dépenses illimitées' },
  { label: 'Revenus illimités' },
  { label: 'Paiements blockchain' },
  { label: 'Rapports avancés' },
  { label: 'Support prioritaire 24/7' },
  { label: 'Partage étendu' },
];

export const premiumBenefits = [
  {
    icon: 'fa-solid fa-shield-halved',
    title: 'Blockchain',
    description: 'Réglez votre abonnement via Ethereum dès l’activation du paiement.',
    tone: 'cyan',
  },
  {
    icon: 'fa-solid fa-users',
    title: 'Partage',
    description: 'Préparez des espaces plus collaboratifs pour gérer un budget en commun.',
    tone: 'indigo',
  },
  {
    icon: 'fa-solid fa-infinity',
    title: 'Illimité',
    description: 'Retirez les limites de comptes, de dépenses et de revenus sur toute l’application.',
    tone: 'violet',
  },
];
