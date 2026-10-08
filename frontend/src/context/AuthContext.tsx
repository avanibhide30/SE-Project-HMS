import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string, rememberMe?: boolean) => Promise<User>;
  demoLogin: (role: UserRole) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  idleRemainingSeconds: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('hms_auth_token') || sessionStorage.getItem('hms_auth_token')
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState<number>(20 * 60);

  const lastActivityRef = useRef<number>(Date.now());

  // Logout handler
  const logout = useCallback(() => {
    localStorage.removeItem('hms_auth_token');
    sessionStorage.removeItem('hms_auth_token');
    setToken(null);
    setUser(null);
  }, []);

  // Fetch current user on mount or token change
  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem('hms_auth_token') || sessionStorage.getItem('hms_auth_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.get<User>('/auth/me');
      setUser(data);
    } catch (err) {
      console.warn('Session expired or invalid token');
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener('hms:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('hms:unauthorized', handleUnauthorized);
  }, [logout]);

  // Inactivity tracking (SRS SE-8: auto logout after 20 min inactivity)
  useEffect(() => {
    if (!token) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, Math.floor((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
      setIdleRemainingSeconds(remaining);

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        alert('You have been logged out due to 20 minutes of inactivity for security.');
        logout();
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      clearInterval(interval);
    };
  }, [token, logout]);

  // Standard Login
  const login = async (identifier: string, pass: string, rememberMe = true): Promise<User> => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', {
      identifier,
      password: pass,
    });
    localStorage.removeItem('hms_auth_token');
    sessionStorage.removeItem('hms_auth_token');
    (rememberMe ? localStorage : sessionStorage).setItem('hms_auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
    lastActivityRef.current = Date.now();
    return res.user;
  };

  // Demo Switcher Login
  const demoLogin = async (role: UserRole): Promise<User> => {
    const res = await api.post<{ token: string; user: User }>('/auth/demo-login', { role });
    sessionStorage.removeItem('hms_auth_token');
    localStorage.setItem('hms_auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
    lastActivityRef.current = Date.now();
    return res.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        demoLogin,
        logout,
        refreshUser,
        idleRemainingSeconds,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
