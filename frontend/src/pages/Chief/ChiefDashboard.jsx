import { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

export function ChiefDashboard() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionSubmissions, setSessionSubmissions] = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [actions, setActions] = useState({})
  const [savingActions, setSavingActions] = useState({})
  const [showSaveSuccessPopup, setShowSaveSuccessPopup] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    loadSessions()
  }, [user])

  const loadSessions = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.get('/chief/sessions')
      setSessions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading sessions:', err)
      setError(err.response?.data?.message || 'Failed to load audit sessions')
    } finally {
      setLoading(false)
    }
  }

  const openSession = async (session) => {
    setSelectedSession(session)
    setLoadingSubmissions(true)
    setSaveError('')
    try {
      const params = new URLSearchParams({
        submittedById: session.submittedBy?._id || session.submittedBy,
        date: session.date,
        formTemplateId: session.formTemplate?._id || session.formTemplate,
        departmentId: session.department?._id || session.department,
      })
      const subs = await apiClient.get(`/chief/session-submissions?${params}`)
      setSessionSubmissions(Array.isArray(subs) ? subs : [])
      const init = {}
      ;(Array.isArray(subs) ? subs : []).forEach((s) => {
        init[s._id] = { corrective: s.corrective || '', preventive: s.preventive || '' }
      })
      setActions(init)
    } catch (err) {
      console.error('Error loading session submissions:', err)
      setSessionSubmissions([])
    } finally {
      setLoadingSubmissions(false)
    }
  }

  const closeSession = () => {
    setSelectedSession(null)
    setSessionSubmissions([])
    setActions({})
    setSaveError('')
  }

  const handleSaveAction = async (submissionId) => {
    const { corrective, preventive } = actions[submissionId] || {}
    if (!corrective?.trim() && !preventive?.trim()) {
      setSaveError('Enter at least one of Corrective or Preventive action before saving.')
      return
    }
    setSavingActions((prev) => ({ ...prev, [submissionId]: true }))
    setSaveError('')
    try {
      await apiClient.put(`/chief/submissions/${submissionId}/corrective-preventive`, {
        corrective: corrective?.trim() || '',
        preventive: preventive?.trim() || '',
      })
      setShowSaveSuccessPopup(true)
      setTimeout(() => setShowSaveSuccessPopup(false), 2500)
      setSessionSubmissions((prev) =>
        prev.map((s) =>
          s._id === submissionId
            ? { ...s, corrective: corrective?.trim() || '', preventive: preventive?.trim() || '' }
            : s
        )
      )
      setSessions((prev) =>
        prev.map((sess) =>
          sess.sessionKey === selectedSession?.sessionKey
            ? { ...sess, withActions: sess.withActions + 1 }
            : sess
        )
      )
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save action')
    } finally {
      setSavingActions((prev) => ({ ...prev, [submissionId]: false }))
    }
  }

  // Group submissions by section
  const itemsBySection = sessionSubmissions.reduce((acc, sub) => {
    const sec = sub.checklistItemId?.section || 'General'
    if (!acc[sec]) acc[sec] = []
    acc[sec].push(sub)
    return acc
  }, {})

  // Unique departments for filter
  const allDepts = [...new Set(sessions.map((s) => s.department?.name).filter(Boolean))]

  const filteredSessions = sessions.filter((s) => {
    if (filterDept && s.department?.name !== filterDept) return false
    if (filterDate && s.date !== filterDate) return false
    return true
  })

  // Summary stats
  const totalSessions = sessions.length
  const totalNO = sessions.reduce((sum, s) => sum + s.noCount, 0)
  const pendingActions = sessions.reduce((sum, s) => sum + s.pendingActions, 0)
  const avgCompliance =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.complianceRate, 0) / sessions.length)
      : 0

  // ─── Session list view ──────────────────────────────────────────────────────
  const SessionListView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Supervisor Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Audit sessions for your department — review and add corrective / preventive actions
            </p>
          </div>
          <button
            onClick={loadSessions}
            className="self-start sm:self-auto px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: totalSessions, color: 'slate', icon: '📋' },
          { label: 'Avg Compliance', value: `${avgCompliance}%`, color: 'emerald', icon: '✅' },
          { label: 'NO Responses', value: totalNO, color: 'amber', icon: '⚠️' },
          { label: 'Pending Actions', value: pendingActions, color: 'red', icon: '🔴' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color === 'emerald' ? 'text-emerald-600' : card.color === 'amber' ? 'text-amber-600' : card.color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>
                  {card.value}
                </p>
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500"
          >
            <option value="">All Departments</option>
            {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500"
          />
        </div>
        {(filterDept || filterDate) && (
          <button
            onClick={() => { setFilterDept(''); setFilterDate('') }}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Clear filters
          </button>
        )}
        <div className="text-xs text-slate-500 self-center ml-auto">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Session table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium text-slate-700">No audit sessions found</p>
            <p className="text-sm mt-1">
              No checklist submissions have been made in your department yet.
            </p>
            {(filterDept || filterDate) && (
              <button
                onClick={() => { setFilterDept(''); setFilterDate('') }}
                className="mt-4 px-4 py-2 bg-maroon-600 text-white text-sm rounded-lg hover:bg-maroon-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-700 w-10">#</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Staff Member</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Department</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Form</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Shift</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Items</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Compliance</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Pending</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session, idx) => (
                  <tr key={session.sessionKey} className="border-b border-slate-100 hover:bg-maroon-50 transition-colors">
                    <td className="p-3 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{session.date}</div>
                      <div className="text-xs text-slate-500">{session.time}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{session.submittedBy?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{session.submittedBy?.designation || session.submittedBy?.role || ''}</div>
                    </td>
                    <td className="p-3 text-slate-700">{session.department?.name || '—'}</td>
                    <td className="p-3 text-slate-700 text-xs">{session.formTemplate?.name || '—'}</td>
                    <td className="p-3 text-xs text-slate-600">{session.location || '—'}</td>
                    <td className="p-3 text-xs text-slate-600">{session.shift || '—'}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">{session.totalItems}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${session.complianceRate >= 80 ? 'bg-emerald-100 text-emerald-700' : session.complianceRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {session.complianceRate}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {session.pendingActions > 0 ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">{session.pendingActions}</span>
                      ) : (
                        <span className="text-emerald-500 text-xs font-medium">✓ Done</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => openSession(session)}
                        className="px-3 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hint when no data at all */}
      {sessions.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="font-semibold text-slate-900 mb-1">No audit sessions found for your department</h4>
          <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
            <li>Sessions will appear here when staff in your department submit audit checklists</li>
            <li>Ensure your account has a department assigned (contact Admin)</li>
            <li>Ensure forms are assigned to your department via <strong>Configure → Form Management</strong></li>
          </ul>
        </div>
      )}
    </div>
  )

  // ─── Session detail / review modal ─────────────────────────────────────────
  const SessionDetailView = () => (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4">
        <button
          onClick={closeSession}
          className="text-sm font-medium text-maroon-600 hover:text-maroon-800 mb-2 inline-block"
        >
          ← Back to Sessions
        </button>
        <h2 className="text-xl font-semibold text-slate-900">
          Review: {selectedSession?.formTemplate?.name || 'Audit Session'}
        </h2>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
          <span>📅 {selectedSession?.date}</span>
          <span>👤 {selectedSession?.submittedBy?.name}</span>
          <span>🏢 {selectedSession?.department?.name}</span>
          {selectedSession?.location && <span>📍 {selectedSession.location}</span>}
          {selectedSession?.shift && <span>🕐 {selectedSession.shift}</span>}
        </div>
      </div>

      {showSaveSuccessPopup && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-pulse">
          ✓ Action saved successfully
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm">
          {saveError}
        </div>
      )}

      {loadingSubmissions ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">Loading checklist...</div>
      ) : sessionSubmissions.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-slate-500">No checklist items found for this session.</div>
      ) : (
        Object.entries(itemsBySection).sort().map(([sectionName, items]) => (
          <div key={sectionName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold text-sm text-slate-900">{sectionName}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700 w-8">#</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700 w-[35%]">Checklist Item</th>
                    <th className="text-center px-4 py-2 font-semibold text-slate-700 w-20">Response</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Remarks</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Corrective Action</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700">Preventive Action</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-700 w-24">Save</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items
                    .sort((a, b) => (a.checklistItemId?.order ?? 0) - (b.checklistItemId?.order ?? 0))
                    .map((sub, idx) => {
                      const resp = (sub.responseValue || sub.yesNoNa || '').toString().trim().toUpperCase()
                      const isNo = resp === 'NO'
                      const alreadySaved = !!(sub.corrective || sub.preventive)
                      return (
                        <tr key={sub._id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} ${isNo ? 'border-l-4 border-l-amber-400' : ''}`}>
                          <td className="px-4 py-3 text-slate-500 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 text-xs">{sub.checklistItemId?.label || '—'}</div>
                            {sub.checklistItemId?.isMandatory && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Mandatory</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${resp === 'YES' ? 'bg-emerald-100 text-emerald-700' : resp === 'NO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                              {resp || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{sub.remarks || '—'}</td>
                          <td className="px-4 py-3">
                            <textarea
                              className={`w-full border rounded px-2 py-1.5 text-xs resize-y min-h-[56px] focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 ${isNo ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'}`}
                              value={actions[sub._id]?.corrective ?? sub.corrective ?? ''}
                              onChange={(e) => isNo && setActions((prev) => ({ ...prev, [sub._id]: { ...prev[sub._id], corrective: e.target.value } }))}
                              placeholder={isNo ? 'Enter corrective action…' : 'Only for NO responses'}
                              disabled={!isNo}
                              rows={2}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              className={`w-full border rounded px-2 py-1.5 text-xs resize-y min-h-[56px] focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 ${isNo ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'}`}
                              value={actions[sub._id]?.preventive ?? sub.preventive ?? ''}
                              onChange={(e) => isNo && setActions((prev) => ({ ...prev, [sub._id]: { ...prev[sub._id], preventive: e.target.value } }))}
                              placeholder={isNo ? 'Enter preventive action…' : 'Only for NO responses'}
                              disabled={!isNo}
                              rows={2}
                            />
                          </td>
                          <td className="px-4 py-3">
                            {isNo ? (
                              <button
                                onClick={() => handleSaveAction(sub._id)}
                                disabled={!!savingActions[sub._id]}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${alreadySaved ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300' : 'bg-maroon-600 text-white hover:bg-maroon-700'} disabled:opacity-50`}
                              >
                                {savingActions[sub._id] ? '…' : alreadySaved ? '✓ Update' : 'Save'}
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className="flex gap-3">
        <button
          onClick={closeSession}
          className="px-5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors"
        >
          ← Back to Sessions
        </button>
      </div>
    </div>
  )

  // ─── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-maroon-200 border-t-maroon-600 mb-3" />
          <p className="text-slate-600 text-sm">Loading audit sessions…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4">
          <h1 className="text-2xl font-semibold text-slate-900">Supervisor Dashboard</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={() => { setError(''); loadSessions() }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return selectedSession ? <SessionDetailView /> : <SessionListView />
}
