import { useEffect, useState } from 'react';

export default function App() {
  const [apiStatus, setApiStatus] = useState('...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Erreur côté serveur');
        }
        return response.json();
      })
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus('indisponible'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <h1>Frontend React</h1>
      <p>
        Backend status : <strong>{loading ? 'chargement...' : apiStatus}</strong>
      </p>
    </main>
  );
}
