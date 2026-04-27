import { useCallback, useEffect, useState } from 'react';

function formatQuotaMessage(errorData, fallbackError) {
  const { error, quota } = errorData || {};

  if (!quota) {
    return error || fallbackError;
  }

  const labels = {
    comptes: 'comptes',
    depenses: 'dépenses',
    revenus: 'revenus',
  };

  const resourceLabel = labels[quota.resource] || 'éléments';
  const usageLabel = quota.limit === null || quota.limit === undefined
    ? `${quota.used} ${resourceLabel} utilisés`
    : `${quota.used}/${quota.limit} ${resourceLabel} utilisés`;

  return `${error || fallbackError} (${usageLabel}).`;
}

function createDashboardApiError(response, errorData, fallbackError) {
  const message = formatQuotaMessage(errorData, fallbackError);
  const error = new Error(message);

  error.status = response.status;
  error.quota = errorData?.quota || null;
  error.isQuotaError = response.status === 403 && Boolean(errorData?.quota);

  return error;
}

async function loadCollection(endpoint, key, setData, setLoading, errorMessage) {
  try {
    const response = await fetch(endpoint, { credentials: 'include' });
    if (!response.ok) return;

    const data = await response.json();
    setData(data[key] || []);
  } catch (error) {
    console.error(errorMessage, error);
  } finally {
    setLoading(false);
  }
}

async function requestDashboardApi(endpoint, { method, body } = {}, fallbackError) {
  const options = {
    method,
    credentials: 'include',
  };

  if (body) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw createDashboardApiError(response, errorData, fallbackError);
  }
}

export default function useDashboardData() {
  const [comptes, setComptes] = useState([]);
  const [loadingComptes, setLoadingComptes] = useState(true);
  const [depenses, setDepenses] = useState([]);
  const [loadingDepenses, setLoadingDepenses] = useState(true);
  const [revenus, setRevenus] = useState([]);
  const [loadingRevenus, setLoadingRevenus] = useState(true);

  const fetchComptes = useCallback(() => (
    loadCollection(
      '/api/comptes',
      'comptes',
      setComptes,
      setLoadingComptes,
      'Erreur lors du chargement des comptes:',
    )
  ), []);

  const fetchDepenses = useCallback(() => (
    loadCollection(
      '/api/depenses',
      'depenses',
      setDepenses,
      setLoadingDepenses,
      'Erreur lors du chargement des dépenses:',
    )
  ), []);

  const fetchRevenus = useCallback(() => (
    loadCollection(
      '/api/revenus',
      'revenus',
      setRevenus,
      setLoadingRevenus,
      'Erreur lors du chargement des revenus:',
    )
  ), []);

  useEffect(() => {
    fetchComptes();
    fetchDepenses();
    fetchRevenus();
  }, [fetchComptes, fetchDepenses, fetchRevenus]);

  const refreshAccountsAndDepenses = useCallback(
    () => Promise.all([fetchDepenses(), fetchComptes()]),
    [fetchComptes, fetchDepenses],
  );

  const refreshAccountsAndRevenus = useCallback(
    () => Promise.all([fetchRevenus(), fetchComptes()]),
    [fetchComptes, fetchRevenus],
  );

  const createAccount = async (payload) => {
    await requestDashboardApi(
      '/api/comptes',
      { method: 'POST', body: payload },
      'Erreur lors de la création du compte',
    );
    await fetchComptes();
  };

  const updateAccount = async (accountId, payload) => {
    await requestDashboardApi(
      `/api/comptes/${accountId}`,
      { method: 'PUT', body: payload },
      'Erreur lors de la modification du compte',
    );
    await fetchComptes();
  };

  const deleteAccount = async (accountId) => {
    await requestDashboardApi(
      `/api/comptes/${accountId}`,
      { method: 'DELETE' },
      'Erreur lors de la suppression du compte',
    );
    await fetchComptes();
  };

  const createDepense = async (payload) => {
    await requestDashboardApi(
      '/api/depenses',
      { method: 'POST', body: payload },
      'Erreur lors de la création de la dépense',
    );
    await refreshAccountsAndDepenses();
  };

  const updateDepense = async (depenseId, payload) => {
    await requestDashboardApi(
      `/api/depenses/${depenseId}`,
      { method: 'PUT', body: payload },
      'Erreur lors de la modification de la dépense',
    );
    await refreshAccountsAndDepenses();
  };

  const deleteDepense = async (depenseId) => {
    await requestDashboardApi(
      `/api/depenses/${depenseId}`,
      { method: 'DELETE' },
      'Erreur lors de la suppression de la dépense',
    );
    await refreshAccountsAndDepenses();
  };

  const createRevenu = async (payload) => {
    await requestDashboardApi(
      '/api/revenus',
      { method: 'POST', body: payload },
      'Erreur lors de la création du revenu',
    );
    await refreshAccountsAndRevenus();
  };

  const updateRevenu = async (revenuId, payload) => {
    await requestDashboardApi(
      `/api/revenus/${revenuId}`,
      { method: 'PUT', body: payload },
      'Erreur lors de la modification du revenu',
    );
    await refreshAccountsAndRevenus();
  };

  const deleteRevenu = async (revenuId) => {
    await requestDashboardApi(
      `/api/revenus/${revenuId}`,
      { method: 'DELETE' },
      'Erreur lors de la suppression du revenu',
    );
    await refreshAccountsAndRevenus();
  };

  return {
    comptes,
    loadingComptes,
    depenses,
    revenus,
    loadingTransactions: loadingDepenses || loadingRevenus,
    createAccount,
    updateAccount,
    deleteAccount,
    createDepense,
    updateDepense,
    deleteDepense,
    createRevenu,
    updateRevenu,
    deleteRevenu,
  };
}
