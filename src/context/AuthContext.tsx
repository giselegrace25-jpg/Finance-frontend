import { createContext, useContext, useState, type ReactNode } from 'react';
import api from '../api/client';

interface User { id: number; name: string; email: string; phone: string; balance: number; referralCode: string; }
interface AuthCtx { user: User | null; token: string | null; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, phone: string, password: string, ref?: string) => Promise<void>; logout: () => void; }

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });

  const persist = (t: string, u: User) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t); setUser(u);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data.token, data.user);
  };

  const register = async (name: string, email: string, phone: string, password: string, referralCode?: string) => {
    const { data } = await api.post('/auth/register', { name, email, phone, password, referralCode });
    persist(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setToken(null); setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
