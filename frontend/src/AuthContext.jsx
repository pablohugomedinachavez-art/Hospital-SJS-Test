import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch } from './api'
import showToast from './toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }){
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(()=>{
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    if (theme === 'dark') document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }, [theme])

  useEffect(()=>{
    async function loadProfile(){
      if (!token) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try{
        const res = await apiFetch('/profile')
        if (res.ok){
          setProfile(await res.json())
        } else {
          setProfile(null)
          localStorage.removeItem('token')
          setToken(null)
        }
      }catch(e){
        setProfile(null)
      }finally{
        setLoading(false)
      }
    }
    loadProfile()
  }, [token])

  async function login(username, password){
    try{
      const res = await fetch('/api/login', {method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username, password})})
      const json = await res.json()
      if (!res.ok) {
        showToast(json.message || 'Login failed', 'error', 'Error')
        throw new Error(json.message || 'Login failed')
      }
      localStorage.setItem('token', json.token)
      setToken(json.token)
      showToast('Sesión iniciada', 'success', 'Bienvenido')
      return json
    }catch(err){
      showToast(err.message || 'Login error', 'error', 'Error')
      throw err
    }
  }

  async function register(username, password){
    try{
      const res = await fetch('/api/register', {method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username, password})})
      const json = await res.json()
      if (!res.ok) {
        showToast(json.message || 'Registro falló', 'error', 'Error')
        throw new Error(json.message || 'Register failed')
      }
      localStorage.setItem('token', json.token)
      setToken(json.token)
      showToast('Registro completado', 'success', 'Cuenta creada')
      return json
    }catch(err){
      showToast(err.message || 'Register error', 'error', 'Error')
      throw err
    }
  }

  function logout(){
    localStorage.removeItem('token')
    setToken(null)
    setProfile(null)
    window.location.hash = '#/'
  }

  function hasPermission(permission){
    return Boolean(profile?.permissions?.includes(permission))
  }

  return (
    <AuthContext.Provider value={{ token, profile, loading, login, register, logout, hasPermission, theme, setTheme }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(){
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
