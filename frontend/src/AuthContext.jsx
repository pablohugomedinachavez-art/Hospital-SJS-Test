// frontend/src/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verificar la sesión al cargar la aplicación
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/verify');
        const data = await response.json();

        if (response.ok && data.authenticated) {
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch (error) {
        console.error('Error verificando la autenticación:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  // Función de Login
  const login = async (username, password) => {
    const response = await api.post('/login', { username, password });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error al iniciar sesión');
    }

    // Guardar token JWT y actualizar usuario
    localStorage.setItem('token', data.token);
    setUser({ username: data.username, role: data.role });
    return data;
  };

  // Función de Logout
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);