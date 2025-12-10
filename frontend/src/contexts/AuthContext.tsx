import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  role: 'admin' | 'user' | 'viewer';
  isRoot: boolean;
  departmentId: number | null;
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<void>;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isRoot: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Axios Interceptor für automatisches Token-Hinzufügen
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token ungültig - automatisch ausloggen
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // User-Daten laden beim Start
  useEffect(() => {
    const loadUser = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const response = await axios.get('/api/auth/me');
          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          console.error('Fehler beim Laden des Benutzers:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login fehlgeschlagen');
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout-Fehler:', error);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const register = async (username: string, email: string, password: string, fullName?: string) => {
    try {
      await axios.post('/api/auth/register', { username, email, password, fullName });
      // Nach erfolgreicher Registrierung muss der User seine E-Mail verifizieren
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registrierung fehlgeschlagen');
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.isRoot || false,
    isRoot: user?.isRoot || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
