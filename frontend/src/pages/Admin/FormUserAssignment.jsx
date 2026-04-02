import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const isAssignable = (u) => ['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA'].includes(u.role)

function formContextLabel(form) {
  return form?.formContext === 'CLINICAL' ? 'Clinical form' : 'Non-clinical form'
}

/** Matches User Management / departments API (stored userContext). */
function resolvedUserAssignmentType(u) {
  if (u?.userContext === 'BOTH') return 'BOTH'
  if (u?.userContext === 'CLINICAL') return 'CLINICAL'
  return 'NON_CLINICAL'
}

function userTypeShortLabel(t) {
  if (t === 'CLINICAL') return 'Clinical'
  if (t === 'BOTH') return 'Both'
  return 'Non-clinical'
}

const FORM_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All form types' },
  { value: 'CLINICAL', label: 'Clinical forms only' },
  { value: 'NON_CLINICAL', label: 'Non-clinical forms only' },
]

const USER_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All user types' },
  { value: 'CLINICAL', label: 'Clinical users only' },
  { value: 'NON_CLINICAL', label: 'Non-clinical users only' },
  { value: 'BOTH', label: 'Both-capable (QA / Super Admin / dual)' },
]

const userMatchesSearch = (user, q) => {
  if (!q || !q.trim()) return true
  const s = q.trim().toLowerCase()
  const id = (user._id || '').toString().toLowerCase()
  const name = (user.name || '').toLowerCase()
  const email = (user.email || '').toLowerCase()
  const designation = (user.designation || '').toLowerCase()
  return id.includes(s) || name.includes(s) || email.includes(s) || designation.includes(s)
}

// Group users by designation, then by department (for checklist assigning)
const DESIGNATION_ORDER = ['Quality Auditor', 'Staff Auditor', 'Unit Supervisor', 'Department Head', 'Quality Officer', 'Infection Control Officer', 'Nursing In-charge', 'Other']
const groupByDesignationAndDepartment = (users) => {
  const map = {}
  for (const user of users) {
    const designation = user.designation?.trim() || 'No designation'
    const deptName = user.department?.name || 'No department'
    if (!map[designation]) map[designation] = {}
    if (!map[designation][deptName]) map[designation][deptName] = []
    map[designation][deptName].push(user)
  }
  const designations = [...new Set(Object.keys(map))]
  designations.sort((a, b) => {
    const ia = DESIGNATION_ORDER.indexOf(a)
    const ib = DESIGNATION_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  if (designations.includes('No designation')) {
    designations.splice(designations.indexOf('No designation'), 1)
    designations.push('No designation')
  }
  return designations.map((designation) => ({
    designation,
    departments: Object.keys(map[designation]).sort().map((deptName) => ({
      deptName,
      users: map[designation][deptName],
    })),
  }))
}

export function FormUserAssignment() {
  const { user: authUser } = useAuth()
  /** Resolved from session (missing → non-clinical). */
  const adminCtx =
    authUser?.userContext === 'CLINICAL'
      ? 'CLINICAL'
      : authUser?.userContext === 'BOTH'
        ? 'BOTH'
        : 'NON_CLINICAL'
  const canSplitFilters = adminCtx === 'BOTH'
  const scopedNonClinicalOnly = adminCtx === 'NON_CLINICAL'
  const scopedClinicalOnly = adminCtx === 'CLINICAL'

  const [forms, setForms] = useState([])
  const [users, setUsers] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  /** BOTH admins: default to clinical forms + clinical staff so assign lists stay aligned. */
  const [formTypeFilter, setFormTypeFilter] = useState('CLINICAL')
  const [userTypeFilter, setUserTypeFilter] = useState('CLINICAL')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!canSplitFilters) {
      setFormTypeFilter('ALL')
      setUserTypeFilter('ALL')
    }
  }, [canSplitFilters])

  /** When "Show forms" changes, match "Show staff" so clinical forms pair with clinical users by default. */
  useEffect(() => {
    if (!canSplitFilters) return
    if (formTypeFilter === 'ALL') {
      setUserTypeFilter('ALL')
    } else if (formTypeFilter === 'CLINICAL') {
      setUserTypeFilter('CLINICAL')
    } else {
      setUserTypeFilter('NON_CLINICAL')
    }
  }, [formTypeFilter, canSplitFilters])

  const loadData = async () => {
    setLoading(true)
    try {
      const [formsData, usersData] = await Promise.all([
        apiClient.get('/form-templates'),
        apiClient.get('/departments/users'),
      ])
      setForms(formsData)
      setUsers(usersData)
    } catch (err) {
      alert('Error loading data: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const filteredForms = useMemo(() => {
    if (scopedNonClinicalOnly) {
      return forms.filter((f) => f.formContext !== 'CLINICAL')
    }
    if (scopedClinicalOnly) {
      return forms.filter((f) => f.formContext === 'CLINICAL')
    }
    if (formTypeFilter === 'ALL') return forms
    return forms.filter((f) =>
      formTypeFilter === 'CLINICAL' ? f.formContext === 'CLINICAL' : f.formContext !== 'CLINICAL'
    )
  }, [forms, formTypeFilter, scopedNonClinicalOnly, scopedClinicalOnly])

  useEffect(() => {
    if (!selectedForm) return
    const stillHere = filteredForms.some((f) => String(f._id) === String(selectedForm._id))
    if (!stillHere) {
      setSelectedForm(null)
      setSelectedUsers([])
    }
  }, [filteredForms, selectedForm])

  // Normalize assignedUsers to IDs (API may return raw ids or populated { _id } objects)
  const getAssignedUserIds = (form) => {
    if (!form?.assignedUsers?.length) return []
    return form.assignedUsers
      .map((u) => (u && typeof u === 'object' && u._id != null ? u._id : u))
      .filter(Boolean)
  }

  const handleSelectForm = (form) => {
    setSelectedForm(form)
    setSelectedUsers(getAssignedUserIds(form))
    setSearchQuery('')
  }

  const isUserSelected = (userId) =>
    selectedUsers.some((id) => String(id) === String(userId))

  const toggleUser = (userId) => {
    const idStr = String(userId)
    setSelectedUsers((prev) => {
      const has = prev.some((id) => String(id) === idStr)
      if (has) return prev.filter((id) => String(id) !== idStr)
      return [...prev, userId]
    })
  }

  const assignableUsers = useMemo(() => users.filter(isAssignable), [users])
  const usersByType = useMemo(() => {
    if (scopedNonClinicalOnly) {
      return assignableUsers.filter((u) => {
        const t = resolvedUserAssignmentType(u)
        return t === 'NON_CLINICAL' || t === 'BOTH'
      })
    }
    if (scopedClinicalOnly) {
      return assignableUsers.filter((u) => {
        const t = resolvedUserAssignmentType(u)
        return t === 'CLINICAL' || t === 'BOTH'
      })
    }
    return assignableUsers.filter((u) => {
      if (userTypeFilter === 'ALL') return true
      return resolvedUserAssignmentType(u) === userTypeFilter
    })
  }, [assignableUsers, userTypeFilter, scopedNonClinicalOnly, scopedClinicalOnly])
  const filteredUsers = usersByType.filter((u) => userMatchesSearch(u, searchQuery))

  const isAssignedToSelectedForm = (userId) =>
    selectedForm && selectedUsers.some((id) => String(id) === String(userId))

  const getAssignedCount = (form) => getAssignedUserIds(form).length

  const handleSave = async () => {
    if (!selectedForm) return

    setSaving(true)
    try {
      await apiClient.put(`/form-templates/${selectedForm._id}/assign-users`, {
        userIds: selectedUsers,
      })
      alert('User assignment updated successfully')
      loadData()
      setSelectedForm(null)
      setSelectedUsers([])
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Assign Checklists to Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          If your profile is <strong>non-clinical</strong> or <strong>clinical</strong>, this page only lists matching forms and
          staff (no extra filters). If your profile is <strong>both</strong>, you can filter forms and staff by type here.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forms List */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50">
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Forms / Checklists</h3>
              <p className="text-sm text-slate-600 mt-1">Click a form to assign users</p>
            </div>
            {canSplitFilters ? (
              <div>
                <label htmlFor="form-type-filter" className="block text-xs font-semibold text-slate-700 mb-1">
                  Show forms
                </label>
                <select
                  id="form-type-filter"
                  value={formTypeFilter}
                  onChange={(e) => setFormTypeFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                >
                  {FORM_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {filteredForms.length} of {forms.length} form{forms.length !== 1 ? 's' : ''} shown
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-800">
                  {scopedClinicalOnly ? 'Clinical forms only' : 'Non-clinical forms only'}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {scopedClinicalOnly
                    ? 'Your user type is clinical — only clinical form templates are listed.'
                    : 'Your user type is non-clinical — only non-clinical form templates are listed.'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''} shown
                </p>
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredForms.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-600">No forms match this filter.</div>
            ) : (
              filteredForms.map((form) => (
              <div
                key={form._id}
                onClick={() => handleSelectForm(form)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedForm?._id === form._id
                    ? 'bg-maroon-50 border-l-4 border-maroon-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold text-slate-800">{form.name}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {form.departments?.map((d) => d.name).join(', ') || 'No department'}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-1.5 items-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded font-medium ${
                      form.formContext === 'CLINICAL'
                        ? 'bg-sky-100 text-sky-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {formContextLabel(form)}
                  </span>
                  {getAssignedCount(form) > 0 ? (
                    <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-medium">
                      {getAssignedCount(form)} user{getAssignedCount(form) !== 1 ? 's' : ''} assigned
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded">
                      No users assigned
                    </span>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        </div>

        {/* User Selection */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50">
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {selectedForm ? `Assign Users to: ${selectedForm.name}` : 'Select a form'}
              </h3>
              {selectedForm && (
                <p className="text-sm text-slate-600 mt-1">
                  Form type:{' '}
                  <span className="font-medium text-slate-800">{formContextLabel(selectedForm)}</span>
                </p>
              )}
            </div>
            {selectedForm &&
              (canSplitFilters ? (
                <div>
                  <label htmlFor="user-type-filter" className="block text-xs font-semibold text-slate-700 mb-1">
                    Show staff (user type from User Management)
                  </label>
                  <select
                    id="user-type-filter"
                    value={userTypeFilter}
                    onChange={(e) => setUserTypeFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  >
                    {USER_FILTER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {usersByType.length} assignable user{usersByType.length !== 1 ? 's' : ''} in this filter (of{' '}
                    {assignableUsers.length} total)
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-800">
                    {scopedClinicalOnly ? 'Clinical & both-capable staff' : 'Non-clinical & both-capable staff'}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {scopedClinicalOnly
                      ? 'Only users set to clinical or both appear (matches your clinical profile).'
                      : 'Only users set to non-clinical or both appear (matches your non-clinical profile).'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {usersByType.length} user{usersByType.length !== 1 ? 's' : ''} listed
                  </p>
                </div>
              ))}
          </div>
          {selectedForm ? (
            <div>
              <div className="p-4 space-y-4">
                {/* Search - by ID, name, email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Search users</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, name, or email..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  />
                </div>

                {assignableUsers.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    No users found. Create staff or supervisor users first.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[420px] overflow-y-auto">
                    <div className="text-xs font-semibold text-slate-700 mb-2 px-2">
                      Staff – by designation and department (tick to assign)
                    </div>
                    {filteredUsers.length === 0 ? (
                      <p className="text-xs text-slate-500 px-2 py-2">
                        {searchQuery ? 'No users match your search.' : 'No assignable users.'}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {groupByDesignationAndDepartment(filteredUsers).map(({ designation, departments: deptGroups }) => (
                          <div key={designation} className="rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                              {designation}
                            </div>
                            <div className="divide-y divide-slate-100">
                              {deptGroups.map(({ deptName, users: userList }) => (
                                <div key={`${designation}-${deptName}`}>
                                  <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium text-slate-600">
                                    {deptName}
                                  </div>
                                  <div className="space-y-0.5 p-2">
                                    {userList.map((user) => {
                                      const assigned = isAssignedToSelectedForm(user._id)
                                      return (
                                        <label
                                          key={user._id}
                                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                                            assigned ? 'bg-emerald-50 border-emerald-200' : 'border-transparent hover:border-maroon-200 hover:bg-maroon-50'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isUserSelected(user._id)}
                                            onChange={() => toggleUser(user._id)}
                                            className="w-5 h-5 text-maroon-700 border-slate-300 rounded focus:ring-2 focus:ring-maroon-500"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-medium text-slate-800 truncate text-sm">{user.name}</span>
                                              <span
                                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                                  resolvedUserAssignmentType(user) === 'BOTH'
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                    : resolvedUserAssignmentType(user) === 'CLINICAL'
                                                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}
                                              >
                                                {userTypeShortLabel(resolvedUserAssignmentType(user))}
                                              </span>
                                            </div>
                                            <div className="text-xs text-slate-600 truncate">{user.email}</div>
                                          </div>
                                          <span
                                            className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                              assigned ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                                            }`}
                                          >
                                            {assigned ? 'Assigned' : 'Not assigned'}
                                          </span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    {selectedUsers.length === 0 ? (
                      <span>No users assigned – only assigned users can access this checklist</span>
                    ) : (
                      <span>✓ {selectedUsers.length} user(s) assigned</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedForm(null)
                        setSelectedUsers([])
                      }}
                      className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                      {saving ? 'Saving...' : 'Save Assignment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-600 space-y-2">
              <p>Select a form from the left to assign users.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                With <strong>Both</strong> you choose filters here. With <strong>non-clinical</strong> or{' '}
                <strong>clinical</strong> you only see matching forms and staff.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
