import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'

export function ChangePasswordPage() {
  const { user, initializing } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!initializing && !user) {
      navigate('/login', { replace: true })
      return
    }
    if (!initializing && user && !['SUPER_ADMIN', 'STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA'].includes(user.role)) {
      navigate('/', { replace: true })
    }
  }, [user, initializing, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await apiClient.request('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      setSuccess('Password changed successfully. You can sign in with your new password.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => navigate('/', { replace: true }), 2000)
    } catch (err) {
      const msg = err?.response?.data?.message
      setError(msg || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  if (!user) return null

  const inputClass = 'w-full border-2 border-maroon-200 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white'
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-3 sm:px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-maroon-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 px-4 sm:px-6 py-4">
            <h1 className="text-xl font-bold text-white">Change Password</h1>
            <p className="text-maroon-100 text-sm mt-0.5">Set a new password for your account</p>
          </div>
          <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-4 pb-6 bg-white" autoComplete="off">
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="mb-4">
              <label className={labelClass}>Current password</label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  className={inputClass}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 hover:bg-slate-100"
                  aria-label={showPasswords.current ? 'Hide' : 'Show'}
                >
                  {showPasswords.current ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className={labelClass}>New password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 chars, upper, lower, number, special"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 hover:bg-slate-100"
                  aria-label={showPasswords.new ? 'Hide' : 'Show'}
                >
                  {showPasswords.new ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className={labelClass}>Confirm new password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 hover:bg-slate-100"
                  aria-label={showPasswords.confirm ? 'Hide' : 'Show'}
                >
                  {showPasswords.confirm ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white font-semibold py-2.5 rounded-lg shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Change Password'}
            </button>

            <p className="mt-4 text-center">
              <Link to="/" className="text-maroon-600 hover:text-maroon-800 text-sm font-medium">
                ← Back to dashboard
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
