import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PWD_RULES = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function ChangePasswordModal({ onDone }: { onDone: () => void }) {
  const { changePassword } = useAuth()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const allRulesMet = PWD_RULES.every(r => r.test(newPwd))
  const matches = newPwd === confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!allRulesMet) { setError('New password does not meet requirements.'); return }
    if (!matches) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await changePassword(oldPwd, newPwd)
      onDone()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Set your password</h2>
        <p className="text-sm text-gray-500 mb-6">You're using the default password. Please set a new one to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              required
            />
            <ul className="mt-2 space-y-1">
              {PWD_RULES.map(r => (
                <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.test(newPwd) ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{r.test(newPwd) ? '✓' : '○'}</span> {r.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
            {confirm && !matches && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Login() {
  const { login, mustChangePassword, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect once authenticated and no password change needed
  useEffect(() => {
    if (isAuthenticated && !mustChangePassword) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, mustChangePassword, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      // if mustChangePassword, the modal will show; otherwise navigate
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChanged = () => navigate('/', { replace: true })

  if (mustChangePassword) {
    return <ChangePasswordModal onDone={handlePasswordChanged} />
  }

  return (
    <div className="min-h-screen bg-[#fdf2f8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg overflow-hidden border border-gray-100">
            <img src="/not_shane.svg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl tracking-tight"><span className="text-gray-900">Task</span><span className="text-brand-500">Ledger</span></span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome! 👋</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder=""
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
