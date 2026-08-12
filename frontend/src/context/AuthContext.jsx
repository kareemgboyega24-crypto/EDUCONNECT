import { createContext, useContext, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('educonnect_user');
    return raw ? JSON.parse(raw) : null;
  });

  const applySession = (data) => {
    localStorage.setItem('educonnect_token', data.token);
    localStorage.setItem('educonnect_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    return applySession(data);
  }, []);

  // Returns { requiresVerification: true, email } - does NOT log the user in.
  // The account isn't usable until verify() succeeds.
  const signup = useCallback(async (fullName, email, password, role) => {
    const { data } = await client.post('/auth/signup', { fullName, email, password, role });
    return data;
  }, []);

  const verify = useCallback(async (email, code) => {
    const { data } = await client.post('/auth/verify', { email, code });
    return applySession(data);
  }, []);

  const resendCode = useCallback(async (email) => {
    await client.post('/auth/resend-code', { email });
  }, []);

  const forgotPassword = useCallback(async (email) => {
    await client.post('/auth/forgot-password', { email });
  }, []);

  const resetPassword = useCallback(async (email, code, newPassword) => {
    await client.post('/auth/reset-password', { email, code, newPassword });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('educonnect_token');
    localStorage.removeItem('educonnect_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, verify, resendCode, forgotPassword, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
