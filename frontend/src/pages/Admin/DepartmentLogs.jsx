import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

export function DepartmentLogs() {
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedDepts, setExpandedDepts] = useState(new Set())
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [searchByDept, setSearchByDept] = useState({})

  // Build structured preview from flat submissions array
  const buildPreviewFromSubmissions = (submissions) => {
    if (!submissions || submissions.length === 0) return null
    const first = submissions[0]
    const context = {
      location: first?.location || '',
      shift: first?.shift || '',
      label: [first?.location, first?.shift].filter(Boolean).join(' / ') || 'General',
    }
    const deptMap = new Map()
    submissions.forEach((sub) => {
      const deptId = sub.department?._id || sub.department
      const deptName = sub.department?.name || 'Unknown Department'
      const deptCode = sub.department?.code || 'N/A'
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          department: { _id: deptId, name: deptName, code: deptCode },
          sections: new Map(),
          submittedBy: sub.submittedBy,
          submittedAt: sub.submittedAt,
        })
      }
      const deptData = deptMap.get(deptId)
      const sectionName = sub.checklistItemId?.section || 'General'
      if (!deptData.sections.has(sectionName)) {
        deptData.sections.set(sectionName, { sectionName, items: [] })
      }
      deptData.sections.get(sectionName).items.push({
        checklistItemId: {
          _id: sub.checklistItemId?._id,
          label: sub.checklistItemId?.label || 'N/A',
          responseType: sub.checklistItemId?.responseType || 'YES_NO',
        },
        responseValue: sub.responseValue || sub.yesNoNa || 'N/A',
        remarks: sub.remarks || '-',
        corrective: sub.corrective || '-',
        preventive: sub.preventive || '-',
      })
    })
    return {
      context,
      departments: Array.from(deptMap.values()).map((dept) => ({
        department: dept.department,
        sections: Array.from(dept.sections.values()),
        submittedBy: dept.submittedBy,
        submittedAt: dept.submittedAt,
      })),
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setError(null)
      const data = await apiClient.get('/departments/logs')
      setLogs(data)
    } catch (err) {
      console.error('Error loading department logs', err)
      setError(err.response?.data?.message || err.message || 'Failed to load department logs')
    } finally {
      setLoading(false)
    }
  }

  const toggleDeptExpand = (deptId) => {
    const next = new Set(expandedDepts)
    if (next.has(deptId)) next.delete(deptId)
    else next.add(deptId)
    setExpandedDepts(next)
  }

  const openPreview = async (submissionId, department) => {
    if (!submissionId) return
    setPreviewModalOpen(true)
    setSelectedDepartment(department || null)
    setPreviewData(null)
    setLoadingPreview(true)
    try {
      const submissions = await apiClient.get(`/audits/session/${submissionId}`)
      const data = buildPreviewFromSubmissions(submissions || [])
      setPreviewData(
        data || {
          context: { location: '', shift: '', label: 'General' },
          departments: [],
        }
      )
    } catch (err) {
      console.error('Error loading session preview:', err)
      setPreviewData({
        error: err.response?.data?.message || err.message || 'Failed to load',
        context: { location: '', shift: '', label: 'General' },
        departments: [],
      })
    } finally {
      setLoadingPreview(false)
    }
  }

  const closePreview = () => {
    setPreviewModalOpen(false)
    setSelectedDepartment(null)
    setPreviewData(null)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateOnly = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'N/A'
    const diffMs = Date.now() - new Date(dateString).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return formatDateOnly(dateString)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon-600 mb-4"></div>
          <div className="text-slate-600 font-medium">Loading department logs...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Department Activity Logs</h1>
          <p className="mt-1 text-sm text-slate-600">Track form submissions across all departments</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-800 font-semibold mb-2">Error Loading Department Logs</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadLogs}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!logs || !logs.departments || logs.departments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Department Activity Logs</h1>
          <p className="mt-1 text-sm text-slate-600">Department-wise audit submissions and checklist drilldown</p>
        </div>
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-12 text-center border border-dashed border-slate-300">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-700 text-lg font-medium mb-2">No department activity yet</p>
          <p className="text-sm text-slate-500">Start submitting forms to see logs here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Department Activity Logs</h1>
        <p className="mt-1 text-sm text-slate-600">Department-wise view of audit submissions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">Total Departments</p>
              <p className="text-3xl font-bold text-slate-900">{logs.totalDepartments || logs.departments.length}</p>
            </div>
            <div className="w-14 h-14 bg-maroon-50 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-maroon-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">Total Forms Submitted</p>
              <p className="text-3xl font-bold text-slate-900">
                {logs.departments.reduce((sum, dept) => sum + (dept.totalFormsSubmitted || 0), 0)}
              </p>
            </div>
            <div className="w-14 h-14 bg-maroon-50 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-maroon-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">Recently Edited</p>
              <p className="text-3xl font-bold text-amber-600">
                {logs.departments.reduce((sum, dept) => sum + (dept.recentlyEditedCount || 0), 0)}
              </p>
            </div>
            <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Department Logs */}
      <div className="space-y-4">
        {logs.departments.map((deptLog) => {
          const isExpanded = expandedDepts.has(deptLog.department._id)
          const deptId = deptLog.department._id
          const searchText = (searchByDept[deptId] || '').trim().toLowerCase()
          const filteredSubmissions = (deptLog.allSubmissions || []).filter((sub) => {
            if (!searchText) return true
            const desc = [sub.location, sub.shift, sub.formTemplateName].filter(Boolean).join(' ').toLowerCase()
            return desc.includes(searchText)
          })
          const submissionsToShow = filteredSubmissions.slice(0, 50)

          return (
            <div key={deptId} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div
                className="bg-slate-50/80 p-4 sm:p-5 cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-200"
                onClick={() => toggleDeptExpand(deptId)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{deptLog.department.name}</h3>
                    <div className="mt-2">
                      <span className="px-2 py-0.5 bg-maroon-50 text-maroon-700 text-[11px] font-medium rounded-full border border-maroon-100">
                        {deptLog.department.code}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600">Sessions:</span>
                        <span className="ml-2 font-bold text-slate-800">{(deptLog.allSubmissions || []).length}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Submissions:</span>
                        <span className="ml-2 font-bold text-slate-800">{deptLog.totalSubmissions || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Last:</span>
                        <span className="ml-2 font-semibold text-slate-700">
                          {deptLog.latestSubmissionDate ? getTimeAgo(deptLog.latestSubmissionDate) : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="text-slate-600 hover:text-slate-800 transition-colors mt-1">
                    {isExpanded ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                      <span className="inline-block w-1 h-5 rounded-full bg-violet-500" />
                      Submissions
                    </h4>
                    <input
                      type="text"
                      value={searchByDept[deptId] || ''}
                      onChange={(e) => setSearchByDept((prev) => ({ ...prev, [deptId]: e.target.value }))}
                      placeholder="Search location, shift or form..."
                      className="w-44 sm:w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <div className="text-sm text-slate-500">No submissions for this department.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left p-2 font-semibold text-slate-700">Date</th>
                            <th className="text-left p-2 font-semibold text-slate-700">Form</th>
                            <th className="text-left p-2 font-semibold text-slate-700">Submitted by</th>
                            <th className="text-left p-2 font-semibold text-slate-700">Context</th>
                            <th className="text-left p-2 font-semibold text-slate-700">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissionsToShow.map((sub) => (
                            <tr key={sub.id} className="border-b border-slate-100 hover:bg-violet-50/50">
                              <td className="p-2">{sub.submittedAt ? formatDate(sub.submittedAt) : 'N/A'}</td>
                              <td className="p-2">{sub.formTemplateName || '—'}</td>
                              <td className="p-2">{sub.submittedBy?.name || '—'}</td>
                              <td className="p-2">{[sub.location, sub.shift].filter(Boolean).join(' / ') || '—'}</td>
                              <td className="p-2">
                                <button
                                  type="button"
                                  onClick={() => openPreview(sub.id, deptLog.department)}
                                  className="text-violet-600 font-medium hover:underline"
                                >
                                  Preview
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredSubmissions.length > 50 && (
                        <p className="text-xs text-slate-500 mt-2">Showing first 50 of {filteredSubmissions.length}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Audit Session Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Audit Session Preview</h2>
                <p className="text-sm text-slate-500">
                  {selectedDepartment?.name && (
                    <span>Department: {selectedDepartment.name} ({selectedDepartment.code || 'N/A'})</span>
                  )}
                </p>
              </div>
              <button
                onClick={closePreview}
                className="ml-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-2 transition-colors text-2xl font-bold w-10 h-10 flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPreview ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-maroon-600 mb-4"></div>
                  <div className="text-slate-500 font-medium">Loading checklist data...</div>
                </div>
              ) : previewData?.error ? (
                <div className="text-center py-12 text-red-600">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="font-semibold mb-2">Error loading data</p>
                  <p className="text-sm text-slate-600">{previewData.error}</p>
                </div>
              ) : previewData && previewData.departments && previewData.departments.length > 0 ? (
                <div className="space-y-6">
                  {/* Session context */}
                  <div className="bg-gradient-to-r from-maroon-50 to-slate-50 rounded-lg p-5 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-3 text-base">Session Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {previewData.context?.location && (
                        <div>
                          <span className="font-semibold text-slate-600">Location:</span>{' '}
                          <span className="text-slate-800">{previewData.context.location}</span>
                        </div>
                      )}
                      {previewData.context?.shift && (
                        <div>
                          <span className="font-semibold text-slate-600">Shift:</span>{' '}
                          <span className="text-slate-800">{previewData.context.shift}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Department-wise checklist data */}
                  {previewData.departments.map((deptData, deptIdx) => (
                    <div key={deptIdx} className="bg-white rounded-lg border-2 border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 text-white px-5 py-3">
                        <h3 className="font-bold text-base">
                          {deptData.department.name}{' '}
                          <span className="text-maroon-200 font-normal">({deptData.department.code})</span>
                        </h3>
                      </div>
                      <div className="p-5">
                        {(() => {
                          const allSections = deptData.sections || []
                          const nonGenericSections = allSections.filter(
                            (s) => !['general', 'other', 'archived'].includes(String(s.sectionName || '').trim().toLowerCase())
                          )
                          const sectionsToRender = nonGenericSections.length > 0 ? nonGenericSections : allSections

                          if (sectionsToRender.length === 0) {
                            return <p className="text-slate-500 text-sm">No checklist data available.</p>
                          }

                          return sectionsToRender.map((section, sectionIdx) => (
                            <div key={sectionIdx} className={sectionIdx > 0 ? 'mt-6 pt-6 border-t border-slate-200' : ''}>
                              <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide border-b-2 border-maroon-200 pb-2">
                                {section.sectionName}
                              </h4>
                              <div className="overflow-x-auto -mx-4 px-4">
                                <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 w-10">#</th>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[200px]">Item</th>
                                      <th className="px-4 py-3 text-center font-semibold text-slate-700 w-[100px]">Response</th>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[150px]">Remarks</th>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[150px]">Corrective</th>
                                      <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[150px]">Preventive</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200">
                                    {section.items.map((item, itemIdx) => (
                                      <tr key={itemIdx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 align-top text-slate-500 font-medium">{itemIdx + 1}</td>
                                        <td className="px-4 py-3 align-top text-slate-800 font-medium leading-relaxed">
                                          {item.checklistItemId?.label || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 align-top text-center font-semibold text-slate-700">
                                          {item.responseValue || item.yesNoNa || '—'}
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-600">
                                          <div className="break-words max-w-[200px]">
                                            {item.remarks && item.remarks !== '-' ? item.remarks : (
                                              <span className="text-slate-400 italic">—</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-600">
                                          <div className="break-words max-w-[150px]">
                                            {item.corrective && item.corrective !== '-' ? item.corrective : (
                                              <span className="text-slate-400 italic">—</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-slate-600">
                                          <div className="break-words max-w-[150px]">
                                            {item.preventive && item.preventive !== '-' ? item.preventive : (
                                              <span className="text-slate-400 italic">—</span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))
                        })()}

                        {/* Signature Section */}
                        <div className="mt-8 pt-6 border-t-2 border-slate-300">
                          <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">
                            Signature & Verification
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">Name</label>
                                <div className="border-b-2 border-slate-400 pb-2 min-h-[30px]">
                                  <span className="text-slate-800 font-medium">
                                    {typeof deptData.submittedBy === 'object' && deptData.submittedBy?.name
                                      ? deptData.submittedBy.name
                                      : typeof deptData.submittedBy === 'string'
                                      ? deptData.submittedBy
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>
                              {typeof deptData.submittedBy === 'object' && deptData.submittedBy?.designation && (
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-2">Designation</label>
                                  <div className="border-b-2 border-slate-400 pb-2 min-h-[30px]">
                                    <span className="text-slate-800 font-medium">{deptData.submittedBy.designation}</span>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">Signature</label>
                                <div className="border-b-2 border-slate-400 pb-2 min-h-[30px] flex items-end">
                                  <span className="text-slate-600 italic text-sm">
                                    {(typeof deptData.submittedBy === 'object' && deptData.submittedBy?.name) ||
                                    (typeof deptData.submittedBy === 'string' && deptData.submittedBy)
                                      ? 'Signed'
                                      : 'Not available'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">Date</label>
                                <div className="border-b-2 border-slate-400 pb-2 min-h-[30px]">
                                  <span className="text-slate-800 font-medium">
                                    {deptData.submittedAt
                                      ? new Date(deptData.submittedAt).toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">Time</label>
                                <div className="border-b-2 border-slate-400 pb-2 min-h-[30px]">
                                  <span className="text-slate-800 font-medium">
                                    {deptData.submittedAt
                                      ? new Date(deptData.submittedAt).toLocaleTimeString('en-GB', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                        })
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !loadingPreview ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No checklist data found for this session.</p>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end">
              <button
                onClick={closePreview}
                className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white font-medium px-8 py-2.5 rounded-lg text-sm transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
