import { useState, useEffect } from 'react';
import { getTodayIsoDate, formatDateForInput, formatDateForDisplay } from '../../utils/dateUtils';

export default function DashboardTransactionManagerModal({
  comptes,
  items,
  itemType,
  onClose,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  euroFormatter,
}) {
  const defaultCompteId = comptes[0] ? String(comptes[0].id) : '';
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [formMessage, setFormMessage] = useState(null);
  const [formValues, setFormValues] = useState({
    nom: '',
    description: '',
    compte_id: defaultCompteId,
    duree_type: 'ponctuelle',
    frequence_mois: '',
    montant: '',
    date: getTodayIsoDate(),
    date_debut: getTodayIsoDate(),
    date_fin: '',
  });

  useEffect(() => {
    if (!formValues.compte_id && defaultCompteId) {
      setFormValues((prev) => ({ ...prev, compte_id: defaultCompteId }));
    }
  }, [defaultCompteId, formValues.compte_id]);

  const itemLabel = itemType === 'revenu' ? 'revenu' : 'dépense';
  const itemLabelPlural = itemType === 'revenu' ? 'revenus' : 'dépenses';
  const itemLabelCapitalized = itemType === 'revenu' ? 'Revenu' : 'Dépense';
  const itemIndefiniteArticle = itemType === 'revenu' ? 'un revenu' : 'une dépense';
  const createButtonLabel = itemType === 'revenu' ? 'Créer un revenu' : 'Créer une dépense';
  const amountCellClass = itemType === 'revenu' ? 'positive' : 'negative';
  const amountSign = itemType === 'revenu' ? '+' : '-';

  const resetForm = () => {
    setEditingItemId(null);
    setFormMessage(null);
    setFormValues({
      nom: '',
      description: '',
      compte_id: defaultCompteId,
      duree_type: 'ponctuelle',
      frequence_mois: '',
      montant: '',
      date: getTodayIsoDate(),
      date_debut: getTodayIsoDate(),
      date_fin: '',
    });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => {
      if (name !== 'duree_type') {
        return {
          ...prev,
          [name]: value,
        };
      }

      if (value === 'ponctuelle') {
        return {
          ...prev,
          duree_type: value,
          frequence_mois: '',
          date: prev.date || prev.date_debut || getTodayIsoDate(),
          date_fin: '',
        };
      }

      return {
        ...prev,
        duree_type: value,
        date_debut: prev.date_debut || prev.date || getTodayIsoDate(),
      };
    });
  };

  const handleEdit = (item) => {
    setFormMessage(null);
    setEditingItemId(item.id);
    setFormValues({
      nom: item.nom || item.nom_court || '',
      description: item.description || '',
      compte_id: String(item.compte_id || ''),
      duree_type: item.duree_type || 'ponctuelle',
      frequence_mois:
        item.duree_type === 'tous_les_n_mois' ? String(item.frequence_mois || '') : '',
      montant: String(item.montant || ''),
      date: formatDateForInput(item.date_debut),
      date_debut: formatDateForInput(item.date_debut),
      date_fin: formatDateForInput(item.date_fin),
    });
  };

  const handleDelete = async (itemId) => {
    const shouldDelete = window.confirm(`Supprimer ce ${itemLabel} ?`);
    if (!shouldDelete) return;
    setFormMessage(null);

    try {
      await onDeleteItem(itemId);
      if (editingItemId === itemId) {
        resetForm();
      }
    } catch (error) {
      setFormMessage({
        type: 'error',
        text: error.message || 'Erreur lors de la suppression',
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormMessage(null);
    const frequenceValue = Number(formValues.frequence_mois);
    const dateDebutValue =
      formValues.duree_type === 'ponctuelle' ? formValues.date : formValues.date_debut;
    const dateFinValue =
      formValues.duree_type === 'tous_les_n_mois' ? formValues.date_fin || null : null;

    if (!formValues.nom.trim()) {
      alert('Le nom est requis.');
      return;
    }
    if (!formValues.compte_id) {
      alert('Le compte est requis.');
      return;
    }
    if (!dateDebutValue) {
      alert(formValues.duree_type === 'ponctuelle' ? 'La date est requise.' : 'La date de début est requise.');
      return;
    }
    if (!formValues.montant || Number(formValues.montant) <= 0) {
      alert('Le montant doit être supérieur à 0.');
      return;
    }
    if (
      formValues.duree_type === 'tous_les_n_mois'
      && (!Number.isInteger(frequenceValue) || frequenceValue < 1)
    ) {
      alert('La fréquence en mois doit être un entier supérieur ou égal à 1.');
      return;
    }
    if (dateFinValue && dateFinValue < dateDebutValue) {
      alert('La date de fin doit être postérieure à la date de début.');
      return;
    }

    const payload = {
      nom_court: formValues.nom.trim(),
      description: formValues.description?.trim() || null,
      compte_id: Number(formValues.compte_id),
      duree_type: formValues.duree_type,
      frequence_mois: formValues.duree_type === 'tous_les_n_mois' ? frequenceValue : 0,
      montant: Number(formValues.montant),
      date_debut: dateDebutValue,
      date_fin: dateFinValue,
    };

    try {
      setSaving(true);
      if (editingItemId) {
        await onUpdateItem(editingItemId, payload);
      } else {
        await onCreateItem(payload);
      }
      resetForm();
    } catch (error) {
      setFormMessage({
        type: 'error',
        text: error.message || `Erreur lors de l'enregistrement du ${itemLabel}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dashboard-manage-transactions-title">
      <div className="dashboard-modal card dashboard-transaction-manager-modal">
        <div className="card-header dashboard-transaction-modal-header">
          <div>
            <h3 id="dashboard-manage-transactions-title">Gérer mes {itemLabelPlural}</h3>
            <p className="muted">Créer, modifier ou supprimer {itemIndefiniteArticle}</p>
          </div>
          <button
            type="button"
            className="dashboard-modal-close-btn"
            aria-label="Fermer la fenêtre"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="dashboard-transaction-manager-grid">
          <form onSubmit={handleSubmit} className="auth-form dashboard-modal-form dashboard-transaction-form">
            {formMessage && <p className={`feedback ${formMessage.type}`}>{formMessage.text}</p>}

            <div className="field-row">
              <label htmlFor={`${itemType}-nom`}>Nom</label>
              <input
                id={`${itemType}-nom`}
                name="nom"
                type="text"
                required
                value={formValues.nom}
                onChange={handleFormChange}
              />
            </div>

            <div className="field-row">
              <label htmlFor={`${itemType}-description`}>Description</label>
              <input
                id={`${itemType}-description`}
                name="description"
                type="text"
                value={formValues.description}
                onChange={handleFormChange}
              />
            </div>

            <div className="field-row">
              <label htmlFor={`${itemType}-compte`}>Compte</label>
              <select
                id={`${itemType}-compte`}
                name="compte_id"
                required
                value={formValues.compte_id}
                onChange={handleFormChange}
              >
                {comptes.length === 0 && <option value="">Aucun compte disponible</option>}
                {comptes.map((compte) => (
                  <option key={compte.id} value={String(compte.id)}>{compte.nom_court}</option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <label htmlFor={`${itemType}-duree`}>Durée</label>
              <select
                id={`${itemType}-duree`}
                name="duree_type"
                value={formValues.duree_type}
                onChange={handleFormChange}
              >
                <option value="ponctuelle">Ponctuelle</option>
                <option value="tous_les_n_mois">Tous les N mois</option>
              </select>
            </div>

            {formValues.duree_type === 'tous_les_n_mois' && (
              <div className="field-row">
                <label htmlFor={`${itemType}-frequence`}>Fréquence (mois)</label>
                <input
                  id={`${itemType}-frequence`}
                  name="frequence_mois"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={formValues.frequence_mois}
                  onChange={handleFormChange}
                />
              </div>
            )}

            <div className="field-row">
              <label htmlFor={`${itemType}-montant`}>Montant</label>
              <input
                id={`${itemType}-montant`}
                name="montant"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formValues.montant}
                onChange={handleFormChange}
              />
            </div>

            {formValues.duree_type === 'ponctuelle' ? (
              <div className="field-row">
                <label htmlFor={`${itemType}-date`}>Date</label>
                <input
                  id={`${itemType}-date`}
                  name="date"
                  type="date"
                  required
                  value={formValues.date}
                  onChange={handleFormChange}
                />
              </div>
            ) : (
              <>
                <div className="field-row">
                  <label htmlFor={`${itemType}-date-debut`}>Date de début</label>
                  <input
                    id={`${itemType}-date-debut`}
                    name="date_debut"
                    type="date"
                    required
                    value={formValues.date_debut}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field-row">
                  <label htmlFor={`${itemType}-date-fin`}>Date de fin</label>
                  <input
                    id={`${itemType}-date-fin`}
                    name="date_fin"
                    type="date"
                    value={formValues.date_fin}
                    onChange={handleFormChange}
                  />
                </div>
              </>
            )}

            <div className="dashboard-modal-actions">
              {editingItemId && (
                <button type="button" className="btn ghost small" onClick={resetForm}>
                  Annuler la modification
                </button>
              )}
              <button type="submit" className="btn primary small" disabled={saving || comptes.length === 0}>
                {editingItemId ? 'Mettre à jour' : createButtonLabel}
              </button>
            </div>
          </form>

          <div className="dashboard-transaction-manager-list">
            <table className="dashboard-transactions-table dashboard-transaction-manager-table">
              <thead>
                <tr>
                  <th scope="col">{itemLabelCapitalized}</th>
                  <th scope="col">Date</th>
                  <th scope="col">Compte</th>
                  <th scope="col">Montant</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5" className="dashboard-empty-row">Aucun {itemLabel} à gérer.</td>
                  </tr>
                )}
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label={itemLabelCapitalized}>{item.nom || item.nom_court}</td>
                    <td data-label="Date">{formatDateForDisplay(item.date_debut)}</td>
                    <td data-label="Compte">{item.compte_nom_court || '-'}</td>
                    <td data-label="Montant" className={amountCellClass}>
                      {amountSign}{euroFormatter.format(Math.abs(Number(item.montant || 0)))}
                    </td>
                    <td data-label="Actions">
                      <div className="dashboard-transaction-inline-actions">
                        <button
                          type="button"
                          className="btn ghost small dashboard-transaction-icon-btn"
                          onClick={() => handleEdit(item)}
                          aria-label={`Modifier le ${itemLabel}`}
                          title="Modifier"
                        >
                          <i className="fa-solid fa-pen" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn ghost small dashboard-transaction-icon-btn dashboard-transaction-delete-btn"
                          onClick={() => handleDelete(item.id)}
                          aria-label={`Supprimer le ${itemLabel}`}
                          title="Supprimer"
                        >
                          <i className="fa-solid fa-trash-can" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-modal-actions">
          <button
            type="button"
            className="btn ghost small"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
