import { useEffect, useState } from 'react';

function getCurrentMonthValue() {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
}

export default function usePrevisionsData() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [prevision, setPrevision] = useState(null);

  useEffect(() => {
    // Si le mois change avant la réponse, les données de l'ancienne requête sont ignorées.
    let ignore = false;

    async function loadPrevision() {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`/api/previsions?month=${selectedMonth}`, {
          credentials: 'include',
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || 'Impossible de charger la prévision.');
        }

        if (!ignore) {
          setPrevision(data);
        }
      } catch (error) {
        if (!ignore) {
          setPrevision(null);
          setErrorMessage(error.message || 'Impossible de charger la prévision.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadPrevision();

    return () => {
      ignore = true;
    };
  }, [selectedMonth]);

  return {
    selectedMonth,
    setSelectedMonth,
    loading,
    errorMessage,
    prevision,
  };
}
