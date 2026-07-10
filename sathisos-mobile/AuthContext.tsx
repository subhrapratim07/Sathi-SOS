import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://sathisos-api.onrender.com'; // ← keep this updated with your current LAN IP

type AuthState = {
  token: string | null;
  userId: string | null;
  name: string | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, phone: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Turns a failed HTTP response into a clear, specific message instead of a
// generic "network error" — network errors only happen when fetch() itself
// throws (no connection, wrong IP, server down), which is handled separately.
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Body wasn't JSON — fall through to status-based message below.
  }

  const serverMessage = data?.title || data?.message || data?.error;
  if (serverMessage) return serverMessage;

  switch (res.status) {
    case 400:
      return 'Please check the details you entered and try again.';
    case 401:
      return 'Incorrect phone number or password.';
    case 404:
      return 'No account found with that phone number.';
    case 409:
      return 'An account with that phone number already exists.';
    case 500:
      return 'Server error — please try again in a moment.';
    default:
      return fallback;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await SecureStore.getItemAsync('token');
      const uid = await SecureStore.getItemAsync('userId');
      const n = await SecureStore.getItemAsync('userName');
      if (t) { setToken(t); setUserId(uid); setName(n); }
      setLoading(false);
    })();
  }, []);

  const saveSession = async (data: any) => {
    await SecureStore.setItemAsync('token', data.token);
    await SecureStore.setItemAsync('userId', data.userId);
    await SecureStore.setItemAsync('userName', data.name);
    setToken(data.token);
    setUserId(data.userId);
    setName(data.name);
  };

  const login = async (phone: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
    } catch {
      // fetch() itself threw — this is a real connectivity problem.
      return { ok: false, error: 'Network error — check your connection or server address' };
    }

    if (!res.ok) {
      const message = await extractErrorMessage(res, 'Login failed. Please try again.');
      return { ok: false, error: message };
    }

    try {
      const data = await res.json();
      await saveSession(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unexpected server response. Please try again.' };
    }
  };

  const register = async (name: string, phone: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password, role: 'driver' }),
      });
    } catch {
      return { ok: false, error: 'Network error — check your connection or server address' };
    }

    if (!res.ok) {
      const message = await extractErrorMessage(res, 'Registration failed. Please try again.');
      return { ok: false, error: message };
    }

    try {
      const data = await res.json();
      await saveSession(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unexpected server response. Please try again.' };
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('userName');
    setToken(null); setUserId(null); setName(null);
  };

  return (
    <AuthContext.Provider value={{ token, userId, name, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { API_BASE };