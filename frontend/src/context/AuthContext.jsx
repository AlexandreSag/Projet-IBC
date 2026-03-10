import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

async function requestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    credentials: 'include',
    headers,
    ...options,
  });

  const hasJson = response.headers.get('content-type')?.includes('application/json');
  const data = hasJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.error || 'Une erreur est survenue.');
  }

  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await requestJson('/api/me', { method: 'GET' });
      setUser(data?.utilisateur || null);
      return data?.utilisateur || null;
    } catch (error) {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (payload) => {
    const data = await requestJson('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setUser(data?.utilisateur || null);
    return data;
  }, []);

  const register = useCallback((payload) => {
    return requestJson('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestJson('/api/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      refreshSession,
      login,
      register,
      logout,
    }),
    [isLoading, login, logout, refreshSession, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  }
  return context;
}
