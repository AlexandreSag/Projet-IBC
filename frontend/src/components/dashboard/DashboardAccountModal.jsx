import { useRef } from 'react';

export default function DashboardAccountModal({
  account,
  customRates,
  mode,
  presets,
  onAccountChange,
  onClose,
  onCustomRatesChange,
  onSubmit,
}) {
  const remunerationInputRef = useRef(null);
  const isEditMode = mode === 'edit';
  const title = isEditMode ? 'Modifier le compte' : 'Ajouter un compte';
  const submitLabel = isEditMode ? 'Enregistrer' : 'Ajouter';
  const idPrefix = isEditMode ? 'edit-account' : 'account';
  const titleId = `dashboard-${mode}-account-title`;

  const updateField = (field, value) => {
    onAccountChange({ ...account, [field]: value });
  };

  const selectPreset = (preset) => {
    onCustomRatesChange(false);
    onAccountChange({
      ...account,
      taux_remuneration: preset.remuneration,
      taux_imposition: preset.imposition,
    });
  };

  const selectCustomRates = () => {
    onCustomRatesChange(true);
    onAccountChange({ ...account, taux_remuneration: '', taux_imposition: '' });
    setTimeout(() => remunerationInputRef.current?.focus(), 0);
  };

  return (
    <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="dashboard-modal card">
        <div className="card-header">
          <h3 id={titleId}>{title}</h3>
        </div>
        <form onSubmit={onSubmit} className="auth-form dashboard-modal-form">
          <div className="field-row">
            <label htmlFor={`${idPrefix}-name`}>Nom du compte</label>
            <input
              id={`${idPrefix}-name`}
              type="text"
              required
              value={account.nom_court}
              onChange={(event) => updateField('nom_court', event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor={`${idPrefix}-description`}>Description</label>
            <input
              id={`${idPrefix}-description`}
              type="text"
              value={account.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor={`${idPrefix}-created-at`}>Date de création</label>
            <input
              id={`${idPrefix}-created-at`}
              type="date"
              required
              value={account.date_creation}
              onChange={(event) => updateField('date_creation', event.target.value)}
            />
          </div>

          <div className="field-row">
            <label htmlFor={`${idPrefix}-initial-balance`}>Solde initial</label>
            <input
              id={`${idPrefix}-initial-balance`}
              type="number"
              step="0.01"
              value={account.solde_initial}
              onChange={(event) => updateField('solde_initial', event.target.value)}
            />
          </div>

          <div className="field-row">
            <label>Type de compte</label>
            <div className="dashboard-preset-row">
              {presets.map((preset) => {
                const isActive =
                  !customRates
                  && parseFloat(account.taux_remuneration) === preset.remuneration
                  && parseFloat(account.taux_imposition) === preset.imposition;

                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`dashboard-preset-btn${isActive ? ' active' : ''}`}
                    onClick={() => selectPreset(preset)}
                  >
                    {preset.label} ({preset.remuneration}% / {preset.imposition}%)
                  </button>
                );
              })}
              <button
                type="button"
                className={`dashboard-preset-btn${customRates ? ' active' : ''}`}
                onClick={selectCustomRates}
              >
                Personnalisé
              </button>
            </div>
          </div>

          {customRates && (
            <>
              <div className="field-row">
                <label htmlFor={`${idPrefix}-taux-remuneration`}>Taux de rémunération (%)</label>
                <input
                  ref={remunerationInputRef}
                  id={`${idPrefix}-taux-remuneration`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex : 2.5"
                  value={account.taux_remuneration}
                  onChange={(event) => updateField('taux_remuneration', event.target.value)}
                />
              </div>
              <div className="field-row">
                <label htmlFor={`${idPrefix}-taux-imposition`}>Taux d'imposition (%)</label>
                <input
                  id={`${idPrefix}-taux-imposition`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex : 30"
                  value={account.taux_imposition}
                  onChange={(event) => updateField('taux_imposition', event.target.value)}
                />
              </div>
            </>
          )}

          <div className="dashboard-modal-actions">
            <button type="button" className="btn ghost small" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn primary small">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
