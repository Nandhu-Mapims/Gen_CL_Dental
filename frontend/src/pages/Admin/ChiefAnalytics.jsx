import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

export function ChiefAnalytics() {
  const { user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const userContext =
    authUser?.userContext === 'CLINICAL' || authUser?.userContext === 'NON_CLINICAL' || authUser?.userContext === 'BOTH'
      ? authUser.userContext
      : 'NON_CLINICAL'
  const canSplitFormTypes = userContext === 'BOTH'
  const [chiefAnalyticsMode, setChiefAnalyticsMode] = useState('BOTH') // BOTH | CLINICAL | NON_CLINICAL

  useEffect(() => {
    loadAnalytics()
  }, [chiefAnalyticsMode, userContext])

  const loadAnalytics = async () => {
    try {
      setError('')
      setLoading(true)
      const effectiveFormContext = canSplitFormTypes
        ? chiefAnalyticsMode === 'BOTH'
          ? ''
          : chiefAnalyticsMode
        : userContext === 'CLINICAL'
          ? 'CLINICAL'
          : 'NON_CLINICAL'
      const res = await apiClient.get(
        effectiveFormContext ? `/chief/admin/analytics?formContext=${encodeURIComponent(effectiveFormContext)}` : '/chief/admin/analytics'
      )
      setData(res)
    } catch (err) {
      console.error('Error loading chief analytics', err)
      setError(err.response?.data?.message || err.message || 'Failed to load chief analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
          <h1 className="text-2xl font-semibold text-slate-900">Chief Analytics</h1>
          <p className="text-slate-600 text-sm mt-1">Statistics, trends, and performance insights of chiefs</p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-maroon-600 border-t-transparent mb-4"></div>
            <div className="text-slate-600">Loading chief analytics...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
          <h1 className="text-2xl font-semibold text-slate-900">Chief Analytics</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={loadAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { summary = {}, chiefs = [], generatedAt } = data || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Supervisor Analytics</h1>
            <p className="mt-1 text-sm text-slate-600">
              Statistics, trends, and performance insights per Unit Supervisor
            </p>
            <p className="text-xs text-slate-500 mt-1">Generated: {formatDate(generatedAt)}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            {canSplitFormTypes ? (
              <div className="sm:w-[240px]">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Form type</label>
                <select
                  value={chiefAnalyticsMode}
                  onChange={(e) => setChiefAnalyticsMode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                >
                  <option value="BOTH">Clinical & Non-clinical</option>
                  <option value="CLINICAL">Clinical</option>
                  <option value="NON_CLINICAL">Non-clinical</option>
                </select>
              </div>
            ) : (
              <div className="text-xs text-slate-600 sm:w-[240px]">
                Mode: <span className="font-semibold">{userContext === 'CLINICAL' ? 'Clinical' : 'Non-clinical'}</span>
              </div>
            )}

            <button
              onClick={loadAnalytics}
              disabled={loading}
              className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Supervisors</div>
          <div className="text-2xl font-bold text-slate-900">{summary.totalChiefs ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Unique Unit Supervisors with submissions</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Submissions</div>
          <div className="text-2xl font-bold text-maroon-600">
            {summary.totalChecklistFields ?? summary.totalSubmissions ?? 0}
            <span className="text-base font-normal text-slate-600 ml-1">
              (from {summary.totalSubmissions ?? 0} form submissions)
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Checklist fields from submitted forms</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">NO Responses</div>
          <div className="text-2xl font-bold text-amber-600">{summary.totalNoResponses ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Require corrective/preventive</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">With Actions Filled</div>
          <div className="text-2xl font-bold text-emerald-600">{summary.totalWithActions ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Corrective/preventive entered</div>
        </div>
      </div>

      {/* Chiefs performance table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">Supervisor Performance</h2>
          <p className="text-sm text-slate-600 mt-0.5">Per-supervisor statistics and trends</p>
        </div>
        <div className="overflow-x-auto">
          {chiefs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="text-4xl mb-2">👔</div>
              <p className="font-medium">No supervisor data yet</p>
              <p className="text-sm mt-1">Submissions assigned to a Unit Supervisor will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-700 w-12">#</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Supervisor Name</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Submissions</th>
                  <th className="text-right p-3 font-semibold text-slate-700">YES</th>
                  <th className="text-right p-3 font-semibold text-slate-700">NO</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Sessions</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Compliance %</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Actions Filled</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Coverage %</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Trend (7d / prev 7d)</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {chiefs.map((chief, idx) => (
                  <tr
                    key={chief.chiefName || idx}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-3 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-800">{chief.chiefName}</td>
                    <td className="p-3 text-right text-slate-700">{chief.totalSubmissions}</td>
                    <td className="p-3 text-right text-emerald-600">{chief.yesCount}</td>
                    <td className="p-3 text-right text-amber-600">{chief.noCount}</td>
                    <td className="p-3 text-right text-slate-700">{chief.totalPatients}</td>
                    <td className="p-3 text-right">
                      <span
                        className={
                          chief.complianceRate >= 80
                            ? 'text-emerald-600 font-medium'
                            : chief.complianceRate >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }
                      >
                        {chief.complianceRate}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-700">{chief.withActionsCount}</td>
                    <td className="p-3 text-right text-slate-700">{chief.actionCoverageRate}%</td>
                    <td className="p-3 text-slate-600">
                      <span className="font-mono text-xs">
                        {chief.trendLast7} / {chief.trendPrev7}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs">{formatDate(chief.lastSubmittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
