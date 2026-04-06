import { useEffect, useState, useRef, useCallback } from 'react'
import { apiClient } from '../../api/client'
import { resolveUploadUrl } from '../../utils/resolveUploadUrl'
import { SIGNATURE_CANVAS_STYLE } from '../../constants/signatureCanvas'

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'DEPT_ADMIN', label: 'Dept Admin' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'QA', label: 'QA' },
  { value: 'STAFF', label: 'Staff' },
]

export function UserManagement() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [newDesignation, setNewDesignation] = useState('')
  const [addingDesignation, setAddingDesignation] = useState(false)
  const [designationError, setDesignationError] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const roleDropdownRef = useRef(null)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [departmentDropdownOpen, setDepartmentDropdownOpen] = useState(false)
  const departmentDropdownRef = useRef(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [signaturePreviewLocal, setSignaturePreviewLocal] = useState(null)
  const [signatureError, setSignatureError] = useState('')
  const [signatureUploading, setSignatureUploading] = useState(false)
  const [signatureInputMode, setSignatureInputMode] = useState('upload') // 'upload' | 'draw'
  const signatureCanvasRef = useRef(null)
  const isCanvasDrawingRef = useRef(false)
  const didDrawSignatureRef = useRef(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'auditor',
    designation: '',
    departmentId: '',
    isActive: true,
  })

  const passwordRules = [
    { key: 'length', label: 'At least 8 characters', valid: formData.password.length >= 8 },
    { key: 'uppercase', label: 'At least 1 uppercase letter (A-Z)', valid: /[A-Z]/.test(formData.password) },
    { key: 'lowercase', label: 'At least 1 lowercase letter (a-z)', valid: /[a-z]/.test(formData.password) },
    { key: 'number', label: 'At least 1 number (0-9)', valid: /\d/.test(formData.password) },
    { key: 'special', label: 'At least 1 special character (!@#$...)', valid: /[^A-Za-z0-9]/.test(formData.password) },
  ]

  const isPasswordStrong = passwordRules.every((rule) => rule.valid)
  const showPasswordRules = isPasswordFocused && !isPasswordStrong


  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewLocal(null)
      return undefined
    }
    const u = URL.createObjectURL(signatureFile)
    setSignaturePreviewLocal(u)
    return () => URL.revokeObjectURL(u)
  }, [signatureFile])

  // Signature canvas setup when switching to "draw"
  useEffect(() => {
    if (signatureInputMode !== 'draw') return
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssWidth = rect.width || 320
    const cssHeight = rect.height || 320
    const dpr = window.devicePixelRatio || 1

    // Make internal canvas pixel size match displayed size
    canvas.width = Math.floor(cssWidth * dpr)
    canvas.height = Math.floor(cssHeight * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2.8

    // White background makes the signature look consistent
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    didDrawSignatureRef.current = false
  }, [signatureInputMode])

  const getSignatureCanvasPoint = (e) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return {
      x: Math.max(0, Math.min(rect.width || 320, x)),
      y: Math.max(0, Math.min(rect.height || 320, y)),
    }
  }

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const cssWidth = rect.width || 320
    const cssHeight = rect.height || 320

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    didDrawSignatureRef.current = false
    isCanvasDrawingRef.current = false
    setSignatureFile(null)
    setSignatureError('')
  }

  const handleSignaturePointerDown = (e) => {
    if (signatureInputMode !== 'draw') return
    const canvas = signatureCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    e.preventDefault()
    isCanvasDrawingRef.current = true
    didDrawSignatureRef.current = true
    setSignatureFile(null) // new drawing hasn't been uploaded yet
    setSignatureError('')

    const { x, y } = getSignatureCanvasPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handleSignaturePointerMove = (e) => {
    if (signatureInputMode !== 'draw') return
    if (!isCanvasDrawingRef.current) return
    const canvas = signatureCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    e.preventDefault()
    const { x, y } = getSignatureCanvasPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleSignaturePointerUp = () => {
    isCanvasDrawingRef.current = false
  }

  const saveDrawnSignatureToFile = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    if (!didDrawSignatureRef.current) {
      setSignatureError('Please draw your signature first.')
      return
    }

    setSignatureError('')
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setSignatureError('Could not capture signature. Please try again.')
          return
        }
        if (blob.size > 2 * 1024 * 1024) {
          setSignatureError('Drawn signature must be 2 MB or smaller. Please redraw smaller.')
          return
        }

        // Backend accepts JPEG/PNG and filters by mimetype; keep correct type.
        const file = new File([blob], 'supervisor-signature.jpg', { type: 'image/jpeg' })
        setSignatureFile(file)
      },
      'image/jpeg',
      0.9
    )
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleDropdownOpen(false)
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(e.target)) {
        setDepartmentDropdownOpen(false)
      }
    }
    if (roleDropdownOpen || departmentDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [roleDropdownOpen, departmentDropdownOpen])

  const loadMasterData = async () => {
    try {
      const data = await apiClient.get('/master-data')
      setDesignations(data.designations || [])
    } catch (err) {
      console.error('Error loading master data', err)
    }
  }

  const handleAddDesignation = useCallback(async () => {
    const value = newDesignation.trim()
    if (!value) { setDesignationError('Please enter a designation name.'); return }
    if (designations.map(d => d.toLowerCase()).includes(value.toLowerCase())) {
      setDesignationError('This designation already exists.')
      return
    }
    setDesignationError('')
    try {
      const data = await apiClient.post('/master-data/designations', { designation: value })
      setDesignations(data.designations || [])
      setFormData(prev => ({ ...prev, designation: value }))
      setNewDesignation('')
      setAddingDesignation(false)
    } catch (err) {
      setDesignationError(err.response?.data?.message || 'Failed to add designation')
    }
  }, [newDesignation, designations])

  const handleDeleteDesignation = useCallback(async (name) => {
    if (!confirm(`Remove "${name}" from the designation list?`)) return
    try {
      const data = await apiClient.delete(`/master-data/designations/${encodeURIComponent(name)}`)
      setDesignations(data.designations || [])
      if (formData.designation === name) setFormData(prev => ({ ...prev, designation: '' }))
    } catch {
      alert('Failed to remove designation')
    }
  }, [formData.designation])

  const loadDepartments = async () => {
    try {
      const data = await apiClient.get('/departments')
      setDepartments(data)
    } catch (err) {
      console.error('Error loading departments', err)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await apiClient.get('/auth/users')
      setUsers(data)
    } catch (err) {
      console.error('Error loading users', err)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers()
    loadDepartments()
    loadMasterData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSignatureError('')

    if ((!editingUser || formData.password) && !isPasswordStrong) {
      alert('Password does not match required pattern. Please satisfy all password rules.')
      return
    }

    try {
      let savedUserId = editingUser?._id
      if (editingUser) {
        const updateData = { ...formData }
        if (!updateData.password) {
          delete updateData.password
        }
        await apiClient.put(`/auth/users/${editingUser._id}`, updateData)
      } else {
        const created = await apiClient.post('/auth/users', formData)
        savedUserId = created?.id ?? created?._id ?? null
      }

      if (formData.role === 'SUPERVISOR' && signatureFile && savedUserId) {
        setSignatureUploading(true)
        try {
          const fd = new FormData()
          fd.append('signature', signatureFile)
          await apiClient.postFormData(`/auth/users/${savedUserId}/signature`, fd)
        } catch (sigErr) {
          setSignatureError(sigErr.response?.data?.message || sigErr.message || 'Signature upload failed')
          setSignatureUploading(false)
          loadUsers()
          return
        } finally {
          setSignatureUploading(false)
        }
      }

      setShowForm(false)
      setEditingUser(null)
      setSignatureFile(null)
      setSignatureInputMode('upload')
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'auditor',
        designation: '',
        departmentId: '',
        isActive: true,
      })
      loadUsers()
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving user')
    }
  }

  const handleRemoveStoredSignature = async () => {
    if (!editingUser?._id) return
    if (!window.confirm('Remove the saved signature image for this supervisor?')) return
    setSignatureError('')
    try {
      const updated = await apiClient.delete(`/auth/users/${editingUser._id}/signature`)
      setEditingUser((prev) => (prev ? { ...prev, ...updated } : prev))
      await loadUsers()
    } catch (err) {
      setSignatureError(err.response?.data?.message || err.message || 'Failed to remove signature')
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setSignatureFile(null)
    setSignatureError('')
    setSignatureInputMode('upload')
    setAddingDesignation(false)
    setNewDesignation('')
    setDesignationError('')
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role || 'STAFF',
      designation: user.designation || '',
      departmentId: user.department?._id || user.department?.id || '',
      isActive: user.isActive !== undefined ? user.isActive : true,
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      await apiClient.delete(`/auth/users/${id}`)
      loadUsers()
    } catch (err) {
      alert('Error deleting user')
      console.error(err)
    }
  }

  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.isActive !== false).length
  const supervisorCount = users.filter((u) => u.role === 'SUPERVISOR').length
  const staffCount = users.filter((u) => u.role === 'STAFF').length

  const getUserDeptId = (u) => u.department?._id ?? u.department?.id ?? (typeof u.department === 'string' ? u.department : null)
  const filteredUsers = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (departmentFilter) {
      const deptId = getUserDeptId(u)
      if (deptId === null || String(deptId) !== String(departmentFilter)) return false
    }
    return true
  })

  const roleFilterLabel = ROLE_OPTIONS.find((o) => o.value === roleFilter)?.label ?? 'Role'
  const departmentFilterLabel = departmentFilter
    ? (departments.find((d) => String(d._id) === String(departmentFilter))?.name ?? 'Department')
    : 'All departments'

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">User Management</h2>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1">Create and manage user accounts</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingUser(null)
            setSignatureFile(null)
            setSignatureError('')
            setSignatureInputMode('upload')
            setAddingDesignation(false)
            setNewDesignation('')
            setDesignationError('')
            setFormData({
              name: '',
              email: '',
              password: '',
              role: 'STAFF',
              designation: '',
              departmentId: '',
              isActive: true,
            })
          }}
          className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-sm transition-colors text-xs sm:text-sm font-medium"
        >
          Create New User
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wide">Total Users</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-800">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wide">Active Users</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-600">{activeUsers}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wide">Supervisors</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-maroon-600">{supervisorCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wide">Staff</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-maroon-600">{staffCount}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {editingUser ? 'Edit User' : 'Create New User'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password {editingUser ? '(leave blank to keep current)' : '*'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:ring-offset-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {showPasswordRules && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-600 mb-1.5">Password requirements</p>
                  <div className="space-y-1.5">
                    {passwordRules.map((rule) => (
                      <div key={rule.key} className="flex items-start gap-2">
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${rule.valid ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`text-xs leading-4 ${rule.valid ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                        >
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Role *
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value
                  setFormData({
                    ...formData,
                    role: newRole,
                    departmentId: ['SUPER_ADMIN', 'QA'].includes(newRole) ? '' : formData.departmentId,
                  })
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="STAFF">Staff</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="DEPT_ADMIN">Dept Admin</option>
                <option value="QA">QA</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Designation</label>
                {!addingDesignation && (
                  <button
                    type="button"
                    onClick={() => { setAddingDesignation(true); setDesignationError('') }}
                    className="text-xs text-maroon-600 hover:text-maroon-800 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add new
                  </button>
                )}
              </div>

              {/* Existing designations dropdown */}
              <div className="space-y-2">
                <select
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                >
                  <option value="">— Select designation —</option>
                  {designations.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Manage list: show × buttons per item */}
                {designations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {designations.map((d) => (
                      <span key={d} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${formData.designation === d ? 'bg-maroon-100 border-maroon-300 text-maroon-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                        {d}
                        <button
                          type="button"
                          onClick={() => handleDeleteDesignation(d)}
                          className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                          title={`Remove "${d}"`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Inline add-new row */}
                {addingDesignation && (
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        type="text"
                        autoFocus
                        value={newDesignation}
                        onChange={(e) => { setNewDesignation(e.target.value); setDesignationError('') }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDesignation() } if (e.key === 'Escape') { setAddingDesignation(false); setNewDesignation('') } }}
                        placeholder="e.g. Senior Auditor"
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 ${designationError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                      />
                      {designationError && <p className="text-xs text-red-600 mt-1">{designationError}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDesignation}
                      className="px-3 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingDesignation(false); setNewDesignation(''); setDesignationError('') }}
                      className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(formData.role) && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Department * (Required for Staff, Supervisor, Dept Admin)
                </label>
                <select
                  required={['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(formData.role)}
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.role === 'SUPERVISOR' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">
                    Supervisor signature
                  </label>

                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSignatureInputMode('upload')
                        setSignatureFile(null)
                        setSignatureError('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        signatureInputMode === 'upload'
                          ? 'bg-maroon-600 text-white border-maroon-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Upload image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSignatureInputMode('draw')
                        setSignatureFile(null)
                        setSignatureError('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        signatureInputMode === 'draw'
                          ? 'bg-maroon-600 text-white border-maroon-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Draw on canvas
                    </button>
                  </div>

                  {signatureInputMode === 'upload' ? (
                    <>
                      <p className="text-xs text-slate-600 mb-2">
                        Upload a PNG or JPEG (max 2 MB). Shown on checklist audit reports for submissions assigned to this supervisor.
                      </p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                        className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-maroon-600 file:text-white hover:file:bg-maroon-700"
                        onChange={(ev) => {
                          const f = ev.target.files?.[0]
                          setSignatureError('')
                          if (!f) {
                            setSignatureFile(null)
                            return
                          }
                          const okType = /^image\/(png|jpeg)$/i.test(f.type)
                          if (!okType) {
                            setSignatureError('Please choose a PNG or JPEG image.')
                            setSignatureFile(null)
                            ev.target.value = ''
                            return
                          }
                          if (f.size > 2 * 1024 * 1024) {
                            setSignatureError('Image must be 2 MB or smaller.')
                            setSignatureFile(null)
                            ev.target.value = ''
                            return
                          }
                          setSignatureFile(f)
                        }}
                      />
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        Draw your signature below (mouse/touch). Click “Save drawn signature”, then click “Create/Update user” to upload it.
                      </p>
                      <div className="border border-slate-300 rounded-md bg-white p-2 inline-block">
                        <canvas
                          ref={signatureCanvasRef}
                          className="touch-none block"
                          style={SIGNATURE_CANVAS_STYLE}
                          onPointerDown={handleSignaturePointerDown}
                          onPointerMove={handleSignaturePointerMove}
                          onPointerUp={handleSignaturePointerUp}
                          onPointerLeave={handleSignaturePointerUp}
                          onPointerCancel={handleSignaturePointerUp}
                          aria-label="Draw signature canvas"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={clearSignatureCanvas}
                          className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={saveDrawnSignatureToFile}
                          className="px-3 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Save drawn signature
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {signatureError && (
                  <p className="text-sm text-red-600">{signatureError}</p>
                )}

                {signatureInputMode === 'upload' && (signaturePreviewLocal || (editingUser?.signatureImage && !signatureFile)) && (
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Preview</p>
                      <div className="border border-slate-300 rounded-md bg-white p-2 inline-block">
                        <img
                          src={signaturePreviewLocal ?? resolveUploadUrl(editingUser?.signatureImage)}
                          alt="Signature preview"
                          className="max-h-24 max-w-[220px] object-contain"
                        />
                      </div>
                    </div>
                    {editingUser?.signatureImage && !signatureFile && (
                      <button
                        type="button"
                        onClick={handleRemoveStoredSignature}
                        className="text-sm text-red-600 hover:text-red-800 font-medium underline-offset-2 hover:underline"
                      >
                        Remove saved signature
                      </button>
                    )}
                  </div>
                )}

                {signatureInputMode === 'draw' && signaturePreviewLocal && (
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Preview</p>
                      <div className="border border-slate-300 rounded-md bg-white p-2 inline-block">
                        <img
                          src={signaturePreviewLocal}
                          alt="Drawn signature preview"
                          className="max-h-24 max-w-[220px] object-contain"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {signatureInputMode === 'draw' && editingUser?.signatureImage && !signatureFile && (
                  <button
                    type="button"
                    onClick={handleRemoveStoredSignature}
                    className="text-sm text-red-600 hover:text-red-800 font-medium underline-offset-2 hover:underline"
                  >
                    Remove saved signature
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-maroon-600 border-slate-300 rounded focus:ring-maroon-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">
                Active (user can login)
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={signatureUploading}
                className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white px-6 py-2 rounded-lg shadow-sm transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {signatureUploading ? 'Uploading signature…' : `${editingUser ? 'Update' : 'Create'} user`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingUser(null)
                  setSignatureFile(null)
                  setSignatureInputMode('upload')
                  setSignatureError('')
                  setAddingDesignation(false)
                  setNewDesignation('')
                  setDesignationError('')
                }}
                className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide w-12">#</th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">
                <div className="relative inline-block" ref={roleDropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRoleDropdownOpen((o) => !o)
                    }}
                    className="flex items-center gap-1.5 group focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:ring-offset-1 rounded px-1 -ml-1"
                    aria-haspopup="listbox"
                    aria-expanded={roleDropdownOpen}
                  >
                    <span>Role</span>
                    <svg className={`w-4 h-4 text-slate-500 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {roleFilter && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-maroon-100 text-maroon-700 text-xs font-medium">
                        {roleFilterLabel}
                      </span>
                    )}
                  </button>
                  {roleDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                      {ROLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value || 'all'}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRoleFilter(opt.value)
                            setRoleDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${opt.value === roleFilter ? 'bg-maroon-50 text-maroon-700 font-medium' : 'text-slate-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">Designation</th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">
                <div className="relative inline-block" ref={departmentDropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDepartmentDropdownOpen((o) => !o)
                    }}
                    className="flex items-center gap-1.5 group focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:ring-offset-1 rounded px-1 -ml-1"
                    aria-haspopup="listbox"
                    aria-expanded={departmentDropdownOpen}
                  >
                    <span>Department</span>
                    <svg className={`w-4 h-4 text-slate-500 transition-transform ${departmentDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {departmentFilter && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-maroon-100 text-maroon-700 text-xs font-medium max-w-[120px] truncate inline-block" title={departmentFilterLabel}>
                        {departmentFilterLabel}
                      </span>
                    )}
                  </button>
                  {departmentDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDepartmentFilter('')
                          setDepartmentDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${!departmentFilter ? 'bg-maroon-50 text-maroon-700 font-medium' : 'text-slate-700'}`}
                      >
                        All departments
                      </button>
                      {departments.map((dept) => (
                        <button
                          key={dept._id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDepartmentFilter(dept._id)
                            setDepartmentDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 truncate ${String(dept._id) === String(departmentFilter) ? 'bg-maroon-50 text-maroon-700 font-medium' : 'text-slate-700'}`}
                          title={dept.name}
                        >
                          {dept.name} {dept.code ? `(${dept.code})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">Created</th>
              <th className="text-center px-4 lg:px-6 py-3 lg:py-4 font-semibold text-xs lg:text-sm text-slate-700 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-6 py-8 text-center text-slate-500 text-sm">
                  {users.length === 0
                    ? 'No users found. Click "Create New User" to add users.'
                    : `No users match.${roleFilter ? ` Role: ${roleFilterLabel}.` : ''}${departmentFilter ? ` Department: ${departmentFilterLabel}.` : ''}`}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, idx) => (
                <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-slate-500 font-medium text-sm">{idx + 1}</td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 font-medium text-slate-800 text-sm">{user.name}</td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-slate-600 text-sm">{user.email}</td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <span
                      className={`px-2 lg:px-3 py-1 rounded-full text-xs font-medium ${user.role === 'SUPER_ADMIN' ? 'bg-maroon-100 text-maroon-700' : user.role === 'DEPT_ADMIN' ? 'bg-amber-100 text-amber-700' : user.role === 'SUPERVISOR' ? 'bg-maroon-100 text-maroon-700' : user.role === 'QA' ? 'bg-teal-100 text-teal-700' : 'bg-maroon-100 text-maroon-700'
                        }`}
                    >
                      {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'DEPT_ADMIN' ? 'Dept Admin' : user.role === 'SUPERVISOR' ? 'Supervisor' : user.role === 'QA' ? 'QA' : 'Staff'}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm text-slate-600">
                    {user.designation || '—'}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm text-slate-600">
                    {user.department
                      ? `${user.department.name || user.department} (${user.department.code || ''})`
                      : (user.role === 'SUPER_ADMIN' || user.role === 'QA')
                        ? 'All Departments'
                        : 'Not Assigned'}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <span
                      className={`px-2 lg:px-3 py-1 rounded-full text-xs font-medium ${user.isActive
                        ? 'bg-maroon-100 text-maroon-700'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-maroon-700 hover:text-maroon-800 text-xs lg:text-sm font-medium px-2 lg:px-3 py-1 rounded hover:bg-maroon-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="text-red-600 hover:text-red-700 text-xs lg:text-sm font-medium px-2 lg:px-3 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="mobile-role-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">Role:</label>
            <select
              id="mobile-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="mobile-dept-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">Dept:</label>
            <select
              id="mobile-dept-filter"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>{dept.name} {dept.code ? `(${dept.code})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-slate-500 text-sm">
            {users.length === 0
              ? 'No users found. Click "Create New User" to add users.'
              : `No users match.${roleFilter ? ` Role: ${roleFilterLabel}.` : ''}${departmentFilter ? ` Department: ${departmentFilterLabel}.` : ''}`}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user._id} className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 text-sm mb-1">{user.name}</h3>
                  <p className="text-xs text-slate-600 mb-2">{user.email}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'SUPER_ADMIN' ? 'bg-maroon-100 text-maroon-700' : 'bg-maroon-100 text-maroon-700'
                    }`}
                >
                  {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role || 'User'}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {user.designation && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Designation:</span>
                    <span className="text-slate-700 font-medium">{user.designation}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="text-slate-700 font-medium">
                    {user.department
                      ? `${user.department.name || user.department} (${user.department.code || ''})`
                      : (user.role === 'SUPER_ADMIN' || user.role === 'QA')
                        ? 'All Departments'
                        : 'Not Assigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive
                      ? 'bg-maroon-100 text-maroon-700'
                      : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Created:</span>
                  <span className="text-slate-700">{new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                <button
                  onClick={() => handleEdit(user)}
                  className="flex-1 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(user._id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

