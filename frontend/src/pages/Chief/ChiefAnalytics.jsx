import { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const CHART_COLORS = {
  primary: '#4f46e5',
  primaryLight: '#818cf8',
  success: '#059669',
  successLight: '#34d399',
  warning: '#d97706',
  warningLight: '#fbbf24',
  danger: '#dc2626',
  dangerLight: '#f87171',
  neutral: '#64748b',
}

export function ChiefAnalytics() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAnalytics()
  }, [user?.name])

  const loadAnalytics = async () => {
    if (!user?.name) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.get(`/chief/my-analytics?chiefName=${encodeURIComponent(user.name)}`)
      setData(res)
    } catch (err) {
      console.error('Chief analytics load error', err)
      setError(err.response?.data?.message || err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-4">
        <div className="w-10 h-10 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading analytics…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-medium">{error}</p>
        <button
          type="button"
          onClick={loadAnalytics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  const s = data?.summary || {}
  const byDept = data?.byDepartment || []
  const last7 = data?.last7Days || []
  const complianceRate = Number(s.complianceRate) || 0
  const actionRate = Number(s.actionCoverageRate) || 0

  const responseMix = [
    { name: 'YES', value: s.yesCount || 0, color: CHART_COLORS.success },
    { name: 'NO', value: s.noCount || 0, color: CHART_COLORS.warning },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Corrective & preventive actions – overview and trends</p>
          <p className="mt-1 text-xs text-maroon-600 bg-maroon-50 rounded px-2 py-1 inline-block">
            These numbers are for audits where you were selected as Unit Supervisor.
          </p>
        </div>
        {data?.generatedAt && (
          <p className="text-xs text-slate-400">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* KPI strip – clear numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Checklist responses"
          value={s.totalSubmissions ?? 0}
          sub="Total (one per question answered)"
          accent="maroon"
        />
        <KpiCard
          label="Audit Sessions"
          value={s.totalPatients ?? 0}
          sub="Unique audit records"
          accent="slate"
        />
        <KpiCard
          label="Compliance"
          value={`${complianceRate}%`}
          sub="YES responses"
          accent="emerald"
        />
        <KpiCard
          label="Actions added"
          value={s.withActionsCount ?? 0}
          sub="Corrective / preventive"
          accent="violet"
        />
        <KpiCard
          label="Action coverage"
          value={`${actionRate}%`}
          sub="NO items with actions"
          accent="amber"
        />
      </div>

      {/* Trend + mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Last 7 days trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Activity – last 7 days</h2>
            <p className="text-xs text-slate-500 mt-0.5">Submissions per day</p>
          </div>
          <div className="p-4 h-64">
            {last7.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    formatter={(value) => [value, 'Submissions']}
                  />
                  <Area type="monotone" dataKey="count" stroke={CHART_COLORS.primary} fill="url(#activityGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-1">
                <span>No activity in the last 7 days</span>
                <span className="text-xs">Data will appear when staff submit forms with you as Unit Supervisor.</span>
              </div>
            )}
          </div>
        </div>

        {/* Response mix YES / NO */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Response mix</h2>
            <p className="text-xs text-slate-500 mt-0.5">YES vs NO</p>
          </div>
          <div className="p-4 h-64 flex items-center justify-center">
            {responseMix.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={responseMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {responseMix.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Items']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
                <span>No responses yet</span>
                <span className="text-xs">Data will appear when staff submit with you as Unit Supervisor.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* By department – advanced table + bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">By form&apos;s department</h2>
          <p className="text-xs text-slate-500 mt-0.5">Submissions and actions per department the form is tagged to</p>
        </div>
        <div className="p-4">
          {byDept.length > 0 ? (
            <>
              <div className="hidden sm:block mb-6">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byDept} layout="vertical" margin={{ top: 8, right: 24, left: 100, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="departmentName" width={96} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalSubmissions" name="Items" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="withActions" name="With actions" fill={CHART_COLORS.success} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-medium">
                      <th className="text-left py-3 px-2 w-12">#</th>
                      <th className="text-left py-3 px-2">Department</th>
                      <th className="text-right py-3 px-2">Items</th>
                      <th className="text-right py-3 px-2">NO</th>
                      <th className="text-right py-3 px-2">Actions</th>
                      <th className="text-right py-3 px-2">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDept.map((row, idx) => (
                      <tr key={row.departmentName} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-2 text-slate-500 font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-2 font-medium text-slate-800">{row.departmentName}</td>
                        <td className="py-2.5 px-2 text-right text-slate-700">{row.totalSubmissions}</td>
                        <td className="py-2.5 px-2 text-right text-amber-700">{row.noCount}</td>
                        <td className="py-2.5 px-2 text-right text-emerald-700">{row.withActions}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600">{row.patientCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">
              <p>No department data yet</p>
              <p className="text-xs mt-1">Data will appear when staff submit forms with you as Unit Supervisor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, accent = 'maroon' }) {
  const valueColor = {
    maroon: 'text-maroon-700',
    slate: 'text-slate-800',
    emerald: 'text-emerald-700',
    violet: 'text-violet-700',
    amber: 'text-amber-700',
  }[accent] || 'text-slate-800'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
