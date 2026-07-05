import { createContext, useContext, useState, ReactNode } from 'react';
import { api, setAccessToken, getAccessToken } from './apiClient';

export interface AuthUser {
  userId: string;
  tenantId: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
}

interface AuthTokenPayload extends AuthUser {
  exp: number;
}

function decodeToken(token: string): AuthTokenPayload | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  requestOtp: (mobileNumber: string) => Promise<{ devOtp?: string }>;
  verifyOtp: (mobileNumber: string, otp: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromCurrentToken(): AuthUser | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload || payload.exp * 1000 < Date.now()) return null;
  return { userId: payload.userId, tenantId: payload.tenantId, roleId: payload.roleId, roleName: payload.roleName, employeeId: payload.employeeId };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(userFromCurrentToken());

  const requestOtp = async (mobileNumber: string) => {
    return api.post<{ message: string; devOtp?: string }>('/auth/otp/request', { mobileNumber });
  };

  const verifyOtp = async (mobileNumber: string, otp: string) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/otp/verify', { mobileNumber, otp });
    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const loginWithPassword = async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, requestOtp, verifyOtp, loginWithPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
