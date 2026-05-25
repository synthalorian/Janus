import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authApi, setAuthToken } from '../api/client';

interface AuthUser {
  id: string;
  name: string;
  type: 'human' | 'ai';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  register: (name: string, type: 'human' | 'ai') => Promise<string | null>;
  loginWithToken: (token: string) => Promise<boolean>;
  loginWithApiKey: (apiKey: string) => Promise<boolean>;
  logout: () => void;
  createApiKey: (name: string, permissions?: string[], expiresInDays?: number) => Promise<{ key: string; keyId: string } | null>;
  listApiKeys: () => Promise<Array<{ id: string; name: string; prefix: string; permissions: string[]; isActive: boolean; lastUsedAt: string; createdAt: string }>>;
  revokeApiKey: (keyId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'janus_auth';

function loadStoredAuth(): { user: AuthUser | null; token: string | null } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { user, token } = JSON.parse(stored);
      return { user, token: token || null };
    }
  } catch { /* ignore */ }
  return { user: null, token: null };
}

function saveAuth(user: AuthUser | null, token: string | null) {
  if (user && token) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = loadStoredAuth();
    const hasAuth = !!stored.user && !!stored.token;
    return {
      user: stored.user,
      token: stored.token,
      apiKey: null,
      isAuthenticated: hasAuth,
      isLoading: hasAuth, // show loading while validating stored token
    };
  });

  // Hydrate token on mount and validate
  useEffect(() => {
    const stored = loadStoredAuth();
    if (stored.token && stored.user) {
      setAuthToken(stored.token);
      authApi.me(stored.token).then(res => {
        if (!res.success) {
          setAuthToken(null);
          setState(s => ({ ...s, user: null, token: null, isAuthenticated: false, isLoading: false }));
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      });
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(async (name: string, type: 'human' | 'ai'): Promise<string | null> => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const res = await authApi.register({ name, type });
      if (res.success && res.data) {
        const { user, token, apiKey } = res.data;
        setAuthToken(token);
        setState({
          user: { id: user.id, name: user.name, type: user.type as 'human' | 'ai' },
          token,
          apiKey,
          isAuthenticated: true,
          isLoading: false,
        });
        saveAuth({ id: user.id, name: user.name, type: user.type as 'human' | 'ai' }, token);
        return apiKey;
      }
    } catch { /* handled below */ }
    setState(s => ({ ...s, isLoading: false }));
    return null;
  }, []);

  const loginWithToken = useCallback(async (token: string): Promise<boolean> => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const res = await authApi.me(token);
      if (res.success && res.data) {
        const userData = res.data.user as { id: string; name: string; type: string };
        setAuthToken(token);
        setState({
          user: { id: userData.id, name: userData.name, type: userData.type as 'human' | 'ai' },
          token,
          apiKey: null,
          isAuthenticated: true,
          isLoading: false,
        });
        saveAuth({ id: userData.id, name: userData.name, type: userData.type as 'human' | 'ai' }, token);
        return true;
      }
    } catch { /* handled below */ }
    setState(s => ({ ...s, isLoading: false }));
    return false;
  }, []);

  const loginWithApiKey = useCallback(async (apiKey: string): Promise<boolean> => {
    // API keys can be used as Bearer tokens
    return loginWithToken(apiKey);
  }, [loginWithToken]);

  const logout = useCallback(() => {
    if (state.token) {
      authApi.logout().catch(() => {});
    }
    setAuthToken(null);
    setState({
      user: null,
      token: null,
      apiKey: null,
      isAuthenticated: false,
      isLoading: false,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, [state.token]);

  const createApiKey = useCallback(async (name: string, permissions?: string[], expiresInDays?: number) => {
    if (!state.token) return null;
    const res = await authApi.createKey({ name, permissions, expiresInDays }, state.token);
    if (res.success && res.data) {
      return { key: res.data.key, keyId: res.data.keyId };
    }
    return null;
  }, [state.token]);

  const listApiKeys = useCallback(async () => {
    if (!state.token) return [];
    const res = await authApi.listKeys(state.token);
    return (res.success && res.data) ? res.data : [];
  }, [state.token]);

  const revokeApiKey = useCallback(async (keyId: string) => {
    if (!state.token) return false;
    const res = await authApi.revokeKey(keyId, state.token);
    return res.success;
  }, [state.token]);

  const value: AuthContextValue = {
    ...state,
    register,
    loginWithToken,
    loginWithApiKey,
    logout,
    createApiKey,
    listApiKeys,
    revokeApiKey,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
