import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Page2 from './Page2.jsx';

function ApiTestPage() {
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

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Accueil</Link> | <Link to="/page2">Page 2</Link>
      </nav>
      <Routes>
        <Route path="/" element={<ApiTestPage />} />
        <Route path="/page2" element={<Page2 />} />
      </Routes>
    </BrowserRouter>
  );
}
