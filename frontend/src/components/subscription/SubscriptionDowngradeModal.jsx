import './SubscriptionDowngradeModal.css';
import { formatAmount } from './subscriptionUtils.js';

export default function SubscriptionDowngradeModal({
  downgradePreview,
  downgradeSelection,
  projectedDowngrade,
  canConfirmDowngrade,
  downgradeSelectionStats,
  recommendedSelectionStats,
  isSubmittingPlanChange,
  onToggleSelection,
  onClose,
  onConfirm,
}) {
  if (!downgradePreview) {
    return null;
  }

  const isScheduledOnly = Boolean(downgradePreview.scheduledOnly);

  return (
    <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="downgrade-title">
      <div className="dashboard-modal card subscription-downgrade-modal">
        <div className="card-header subscription-downgrade-header">
          <div>
            <p className="subscription-eyebrow">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              Annulation de l’abonnement
            </p>
            <h2 id="downgrade-title">{isScheduledOnly ? 'Planifier le retour au gratuit' : 'Choisissez ce qui sera supprimé'}</h2>
            <p className="subscription-downgrade-intro">
              {isScheduledOnly
                ? 'Votre période Premium est encore active. Vous pouvez annuler maintenant, puis planifier le retour au gratuit à la date de fin.'
                : 'Pour revenir au plan gratuit, votre espace doit repasser sous les quotas. Nous avons déjà précoché une sélection recommandée que vous pouvez ajuster.'}
            </p>
          </div>
          <button
            type="button"
            className="dashboard-modal-close-btn subscription-downgrade-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        {isScheduledOnly ? (
          <div className="subscription-downgrade-scheduled info-card">
            <strong>Premium actif jusqu’au</strong>
            <p>
              {downgradePreview.effectiveAt
                ? new Date(downgradePreview.effectiveAt).toLocaleString('fr-FR')
                : 'la fin de votre période en cours'}
            </p>
            <p>
              {downgradePreview.cancellationAlreadyScheduled
                ? 'L’annulation de l’abonnement est déjà programmée.'
                : 'Vous garderez vos avantages Premium jusqu’à cette date.'}
            </p>
          </div>
        ) : (
        <div className="subscription-downgrade-layout">
          <div className="subscription-downgrade-list">
            {downgradePreview.accounts.map((account) => {
              const accountSelected = downgradeSelection.accountIds.includes(account.id);
              return (
                <article key={account.id} className={`subscription-downgrade-account${accountSelected ? ' selected' : ''}`}>
                  <div className="subscription-downgrade-account-top">
                    <label className="subscription-downgrade-account-toggle">
                      <input
                        type="checkbox"
                        checked={accountSelected}
                        onChange={() => onToggleSelection('accountIds', account.id)}
                      />
                      <span>
                        <strong>{account.nom_court}</strong>
                        <small>
                          Supprimer ce compte supprimera aussi {account.depensesCount} dépense{account.depensesCount > 1 ? 's' : ''} et {account.revenusCount} revenu{account.revenusCount > 1 ? 's' : ''}.
                        </small>
                      </span>
                    </label>

                    <div className="subscription-downgrade-account-badges">
                      <span className="subscription-downgrade-account-badge">
                        {account.depensesCount} dép.
                      </span>
                      <span className="subscription-downgrade-account-badge">
                        {account.revenusCount} rev.
                      </span>
                    </div>
                  </div>

                  {!accountSelected && (
                    <div className="subscription-downgrade-transactions">
                      {account.depenses?.length > 0 && (
                        <div className="subscription-downgrade-transaction-group">
                          <h3>Dépenses</h3>
                          <div className="subscription-downgrade-items-list">
                            {account.depenses.map((depense) => (
                              <label key={depense.id} className="subscription-downgrade-item">
                                <input
                                  type="checkbox"
                                  checked={downgradeSelection.depenseIds.includes(depense.id)}
                                  onChange={() => onToggleSelection('depenseIds', depense.id)}
                                />
                                <span>{depense.nom_court}</span>
                                <span className="subscription-downgrade-item-amount">{formatAmount(depense.montant)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {account.revenus?.length > 0 && (
                        <div className="subscription-downgrade-transaction-group">
                          <h3>Revenus</h3>
                          <div className="subscription-downgrade-items-list">
                            {account.revenus.map((revenu) => (
                              <label key={revenu.id} className="subscription-downgrade-item">
                                <input
                                  type="checkbox"
                                  checked={downgradeSelection.revenuIds.includes(revenu.id)}
                                  onChange={() => onToggleSelection('revenuIds', revenu.id)}
                                />
                                <span>{revenu.nom_court}</span>
                                <span className="subscription-downgrade-item-amount">{formatAmount(revenu.montant)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <aside className="subscription-downgrade-sidebar">
            <div className="subscription-downgrade-alert">
              <i className="fa-solid fa-circle-info" aria-hidden="true" />
              <p>
                Les éléments sélectionnés seront définitivement supprimés pour respecter les limites du plan gratuit.
              </p>
            </div>

            <div className="subscription-downgrade-summary-card">
              <div className="subscription-downgrade-summary-head">
                <h3>État des quotas</h3>
                <span className={`subscription-downgrade-state${canConfirmDowngrade ? ' valid' : ' invalid'}`}>
                  {canConfirmDowngrade ? 'Prêt' : 'Incomplet'}
                </span>
              </div>

              <div className="subscription-downgrade-stat-list">
                <div className="subscription-downgrade-stat-item">
                  <span className="stat-label">Comptes conservés</span>
                  <strong className={`stat-value ${projectedDowngrade?.comptesOverBy === 0 ? 'valid' : 'invalid'}`}>
                    {projectedDowngrade?.comptesUsed ?? 0} / {projectedDowngrade?.comptesLimit ?? '-'}
                  </strong>
                </div>

                <div className="subscription-downgrade-stat-divider" />

                <div className="subscription-downgrade-per-account">
                  {projectedDowngrade?.perCompte.map((account) => {
                    const isAccountValid = account.depensesOverBy === 0 && account.revenusOverBy === 0;
                    return (
                      <div key={account.accountId} className={`subscription-downgrade-per-account-row ${isAccountValid ? 'valid' : 'invalid'}`}>
                        <span className="account-name">{account.accountName}</span>
                        <span className="account-metrics">
                          <span>{account.depensesUsed}/{account.depensesLimit} dép.</span>
                          <span>•</span>
                          <span>{account.revenusUsed}/{account.revenusLimit} rev.</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="subscription-downgrade-total-to-delete">
                <span>Éléments à supprimer :</span>
                <strong>{downgradeSelectionStats.accounts + downgradeSelectionStats.depenses + downgradeSelectionStats.revenus}</strong>
              </div>

              {!canConfirmDowngrade && (
                <div className="subscription-downgrade-error-msg">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span>Certaines limites sont dépassées. Veuillez sélectionner plus d&apos;éléments à supprimer.</span>
                </div>
              )}
            </div>

            <div className="subscription-downgrade-recommendation">
              <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
              <div>
                <h3>Sélection recommandée</h3>
                <p>
                  {recommendedSelectionStats.accounts} compte{recommendedSelectionStats.accounts > 1 ? 's' : ''},
                  {' '}{recommendedSelectionStats.depenses} dép. et
                  {' '}{recommendedSelectionStats.revenus} rev.
                </p>
              </div>
            </div>
          </aside>
        </div>
        )}

        <div className="dashboard-modal-actions subscription-downgrade-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onConfirm}
            disabled={
              downgradePreview.cancellationAlreadyScheduled
              || (!isScheduledOnly && (!canConfirmDowngrade || isSubmittingPlanChange))
            }
          >
            {isSubmittingPlanChange
              ? 'Annulation...'
              : isScheduledOnly
                ? (downgradePreview.cancellationAlreadyScheduled ? 'Annulation déjà planifiée' : 'Planifier le retour au gratuit')
                : 'Confirmer le retour au gratuit'}
          </button>
        </div>
      </div>
    </div>
  );
}
