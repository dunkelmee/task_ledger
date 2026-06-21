import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi } from '../api'

interface AuthState {
  token: string | null
  mustChangePassword: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  changePassword: (oldPwd: string, newPwd: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sl_token'))
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (token) {
      authApi.me().catch(() => {
        setToken(null)
        localStorage.removeItem('sl_token')
      }).finally(() => setChecked(true))
    } else {
      setChecked(true)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    localStorage.setItem('sl_token', res.token)
    setToken(res.token)
    setMustChangePassword(res.must_change_password ?? false)
  }

  const logout = () => {
    localStorage.removeItem('sl_token')
    setToken(null)
    setMustChangePassword(false)
  }

  const changePassword = async (oldPwd: string, newPwd: string) => {
    await authApi.changePassword(oldPwd, newPwd)
    setMustChangePassword(false)
  }

  if (!checked) return null

  return (
    <AuthContext.Provider value={{ token, mustChangePassword, isAuthenticated: !!token, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
