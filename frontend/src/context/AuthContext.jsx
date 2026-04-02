/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { apiClient } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (saved) {
      try {
        const u = JSON.parse(saved)
        if (
          u &&
          u.userContext !== 'CLINICAL' &&
          u.userContext !== 'NON_CLINICAL' &&
          u.userContext !== 'BOTH'
        ) {
          u.userContext = 'NON_CLINICAL'
        }
        setUser(u)
      } catch {
        setUser(null)
      }
    }
    setInitializing(false)
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const data = await apiClient.post('/auth/login', { email, password })
      const uc = data.user?.userContext
      const normalizedUser = {
        ...data.user,
        userContext:
          uc === 'CLINICAL' || uc === 'NON_CLINICAL' || uc === 'BOTH' ? uc : 'NON_CLINICAL',
      }
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(normalizedUser))
      setUser(normalizedUser)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)


