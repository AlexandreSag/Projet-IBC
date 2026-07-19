import { useMemo } from 'react';
import './DashboardPrevisionsTab.css';
import { formatDateForDisplay } from '../../utils/dateUtils';
import usePrevisionsData from './usePrevisionsData.js';

function buildMonthLabel(targetDate) {
  if (!targetDate) return '';
  const dateValue = new Date(`${targetDate}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(dateValue);
}

function buildStatusLabel(status) {
  return status === 'active' ? 'Actif' : 'Non ouvert';
}

export default function DashboardPrevisionsTab() {
  const {
    selectedMonth,
    setSelectedMonth,
    loading,
    errorMessage,
    prevision,
  } = usePrevisionsData();

  const euroFormatter = useMemo(
    () => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }),
    [],
  );

  const overviewCards = useMemo(() => {
    if (!prevision?.overview) return [];

    return [
      {
        title: 'Solde total projeté',
        value: euroFormatter.format(prevision.overview.total_solde || 0),
        detail: `${prevision.overview.comptes_actifs || 0} compte(s) pris en compte`,
        tone: 'default',
        icon: 'fa-solid fa-wallet',
      },
      {
        title: 'Revenus cumulés',
        value: euroFormatter.format(prevision.overview.total_revenus || 0),
        detail: 'Jusqu’à la date sélectionnée',
        tone: 'positive',
        icon: 'fa-solid fa-arrow-trend-up',
      },
      {
        title: 'Dépenses cumulées',
        value: euroFormatter.format(prevision.overview.total_depenses || 0),
        detail: 'Jusqu’à la date sélectionnée',
        tone: 'negative',
        icon: 'fa-solid fa-arrow-trend-down',
      },
      {
        title: 'Intérêts nets cumulés',
        value: euroFormatter.format(prevision.overview.total_interets || 0),
        detail: 'Après impôts',
        tone: 'info',
        icon: 'fa-solid fa-sparkles',
      },
      {
        title: 'Impôts estimés',
        value: euroFormatter.format(prevision.overview.total_impots || 0),
        detail: 'Selon le taux d’imposition du compte',
        tone: 'negative',
        icon: 'fa-solid fa-file-invoice-dollar',
      },
    ];
  }, [euroFormatter, prevision]);

  return (
    <>
      <section className="dashboard-panel prevision-panel">
        <div className="dashboard-panel-header prevision-panel-header">
          <div>
            <h2>Prévisions mensuelles</h2>
            <p>Calculez l’état net de vos comptes au dernier jour du mois choisi.</p>
          </div>
          <div className="prevision-controls">
            <label htmlFor="prevision-month">Mois cible</label>
            <input
              id="prevision-month"
              type="date"
              value={`${selectedMonth}-01`}
              onChange={(event) => {
                if (event.target.value) {
                  setSelectedMonth(event.target.value.substring(0, 7));
                }
              }}
            />
          </div>
        </div>

        {prevision?.target_date && !loading && (
          <div className="prevision-target-banner">
            <span>{buildMonthLabel(prevision.target_date)}</span>
            <strong>{formatDateForDisplay(prevision.target_date)}</strong>
          </div>
        )}

        {errorMessage && <p className="feedback error">{errorMessage}</p>}

        {loading ? (
          <p className="prevision-loading">Chargement de la prévision...</p>
        ) : prevision?.comptes?.length ? (
          <>
            <div className="prevision-summary-grid">
              {overviewCards.map((card) => (
                <article key={card.title} className="dashboard-metric-card">
                  <div className="dashboard-metric-head">
                    <p>{card.title}</p>
                    <span className={`dashboard-metric-icon ${card.tone}`}>
                      <i className={card.icon} aria-hidden="true" />
                    </span>
                  </div>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </div>

            <div className="prevision-table-wrapper">
              <table className="prevision-table">
                <thead>
                  <tr>
                    <th scope="col">Compte</th>
                    <th scope="col">Ouverture</th>
                    <th scope="col">Statut</th>
                    <th scope="col">Solde projeté</th>
                    <th scope="col">Revenus</th>
                    <th scope="col">Dépenses</th>
                    <th scope="col">Intérêts nets</th>
                    <th scope="col">Impôts estimés</th>
                  </tr>
                </thead>
                <tbody>
                  {prevision.comptes.map((compte) => (
                    <tr key={compte.id}>
                      <td data-label="Compte">
                        <div className="prevision-account-cell">
                          <strong>{compte.nom_court}</strong>
                          <span>{compte.description || 'Compte financier'}</span>
                        </div>
                      </td>
                      <td data-label="Ouverture">{formatDateForDisplay(compte.date_creation)}</td>
                      <td data-label="Statut">
                        <span className={`prevision-status ${compte.status}`}>
                          {buildStatusLabel(compte.status)}
                        </span>
                      </td>
                      <td data-label="Solde projeté" className="prevision-amount strong">
                        {euroFormatter.format(compte.solde_previsionnel || 0)}
                      </td>
                      <td data-label="Revenus" className="prevision-amount positive">
                        {euroFormatter.format(compte.revenus_total || 0)}
                      </td>
                      <td data-label="Dépenses" className="prevision-amount negative">
                        {euroFormatter.format(compte.depenses_total || 0)}
                      </td>
                      <td data-label="Intérêts nets" className="prevision-amount info">
                        {euroFormatter.format(compte.interets_total || 0)}
                      </td>
                      <td data-label="Impôts estimés" className="prevision-amount negative">
                        {euroFormatter.format(compte.impots_total || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="prevision-empty">Ajoutez au moins un compte pour générer une prévision.</p>
        )}
      </section>

      {!loading && prevision?.comptes?.length > 0 && (
        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2>Détail par compte</h2>
              <p>Décomposition des mouvements cumulés jusqu’au mois sélectionné.</p>
            </div>
          </div>

          <div className="prevision-account-grid">
            {prevision.comptes.map((compte) => (
              <article key={compte.id} className="prevision-account-card">
                <div className="prevision-account-card-head">
                  <div>
                    <h3>{compte.nom_court}</h3>
                    <p>{buildStatusLabel(compte.status)}</p>
                  </div>
                  <strong>{euroFormatter.format(compte.solde_previsionnel || 0)}</strong>
                </div>

                <dl className="prevision-breakdown">
                  <div>
                    <dt>Solde initial</dt>
                    <dd>{euroFormatter.format(compte.solde_initial || 0)}</dd>
                  </div>
                  <div>
                    <dt>Revenus cumulés</dt>
                    <dd className="positive">{euroFormatter.format(compte.revenus_total || 0)}</dd>
                  </div>
                  <div>
                    <dt>Dépenses cumulées</dt>
                    <dd className="negative">{euroFormatter.format(compte.depenses_total || 0)}</dd>
                  </div>
                  <div>
                    <dt>Intérêts nets</dt>
                    <dd className="info">{euroFormatter.format(compte.interets_total || 0)}</dd>
                  </div>
                  <div>
                    <dt>Impôts estimés</dt>
                    <dd className="negative">{euroFormatter.format(compte.impots_total || 0)}</dd>
                  </div>
                  <div>
                    <dt>Taux annuel</dt>
                    <dd>{Number(compte.taux_remuneration || 0).toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt>Fiscalité</dt>
                    <dd>{Number(compte.taux_imposition || 0).toFixed(2)}%</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
