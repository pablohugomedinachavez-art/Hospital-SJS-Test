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
        // Aseguramos la ruta del endpoint auth
        const response = await api.get('/auth/verify');
        
        // Manejo defensivo por si 'api.get' devuelve directamente JSON o un Response nativo
        const data = response.json ? await response.json() : response;

        if ((response.ok || data.authenticated) && data.user) {
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
    // Trim para evitar espacios accidentales
    const cleanUsername = username.trim();

    // Invocación a /api/login con payload estandarizado
    const response = await api.post('/login', {
      username: cleanUsername,
      password: password,
    });

    // Manejo seguro de la respuesta de tu helper 'api.js'
    const data = response.json ? await response.json() : response;

    if (response.status >= 400 || (data.ok === false) || data.error) {
      throw new Error(data.message || data.error || 'Credenciales inválidas');
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
    }

    const userData = {
      username: data.username || cleanUsername,
      role_id: data.role_id || data.role,
      tenant_id: data.tenant_id || 1,
    };

    setUser(userData);
    return data;
  };

  // Función de Registro
  const register = async (username, password) => {
    const cleanUsername = username.trim();

    const response = await api.post('/register', {
      username: cleanUsername,
      password: password,
    });

    const data = response.json ? await response.json() : response;

    if (response.status >= 400 || (data.ok === false) || data.error) {
      throw new Error(data.message || data.error || 'Error al registrar el usuario');
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
    }

    const userData = {
      username: data.username || cleanUsername,
      role_id: data.role_id || data.role,
      tenant_id: data.tenant_id || 1,
    };

    setUser(userData);
    return data;
  };

  // Función de Logout
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.hash = '#/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);