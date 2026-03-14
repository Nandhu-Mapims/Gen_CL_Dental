import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from 'recharts'

const COLORS = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#60a5fa', '#93c5fd', '#dbeafe', '#f59e0b', '#ef4444', '#10b981']

export function Analytics() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timePeriod, setTimePeriod] = useState('month') // 'day', 'week', 'month'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    loadDepartments()
    loadAnalytics()
  }, [timePeriod, startDate, endDate])

  const loadDepartments = async () => {
    try {
      const deptData = await apiClient.get('/departments')
      setDepartments(deptData)
    } catch (err) {
      console.error('Error loading departments:', err)
    }
  }

  const loadAnalytics = async () => {
    try {
      setError('')
      setLoading(true)

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (timePeriod) params.append('groupBy', timePeriod)

      const [comprehensive, timeSeries, userActivity, admissionStats, formStats] = await Promise.all([
        apiClient.get(`/audits/analytics/comprehensive?${params.toString()}`),
        apiClient.get(`/audits/analytics/time-series?${params.toString()}`),
        apiClient.get(`/audits/analytics/user-activity?${params.toString()}`),
        apiClient.get(`/audits/analytics/admissions?${params.toString()}`),
        apiClient.get(`/audits/analytics/forms?${params.toString()}`),
      ])

      setAnalytics({
        comprehensive,
        timeSeries,
        userActivity,
        admissionStats,
        formStats,
      })
    } catch (err) {
      console.error('Error loading analytics', err)
      setError(err.response?.data?.message || err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }


  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const resetDateRange = () => {
    setStartDate('')
    setEndDate('')
  }

  if (loading && !analytics) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Comprehensive statistics and insights</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-maroon-700 border-t-transparent mb-4"></div>
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Comprehensive statistics and insights</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-800 font-semibold mb-2">Error Loading Analytics</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadAnalytics}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Comprehensive statistics and insights</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-dashed border-slate-300">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-slate-700 text-lg font-medium mb-2">No analytics data available</p>
        </div>
      </div>
    )
  }

  const { comprehensive, timeSeries, userActivity, admissionStats, formStats } = analytics

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Analytics Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Comprehensive statistics, trends, and performance insights
        </p>
      </div>

      {/* Date Range & Period Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Group By
              </label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="border-2 border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={resetDateRange}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        {(startDate || endDate) && (
          <div className="mt-4 text-sm text-slate-600">
            Showing data from{' '}
            <span className="font-semibold">{startDate ? formatDate(startDate) : 'beginning'}</span> to{' '}
            <span className="font-semibold">{endDate ? formatDate(endDate) : 'now'}</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Total Submissions
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
                {timeSeries?.summary?.totalSubmissions || comprehensive?.timeSeries?.monthly?.reduce((sum, d) => sum + d.submissions, 0) || 0}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-maroon-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-maroon-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Audit Sessions
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
                {admissionStats?.summary?.totalAdmissions || comprehensive?.admissionStats?.totalAdmissions || 0}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Active Users
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
                {userActivity?.summary?.totalUsers || 0}
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Avg Compliance
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-600">
                {userActivity?.summary?.averageComplianceRate || 0}%
              </p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-3">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Submissions Trend */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-slate-200">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Submissions Trend
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              {timePeriod === 'day' ? 'Daily' : timePeriod === 'week' ? 'Weekly' : 'Monthly'} submissions over time
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeries?.data || []}>
              <defs>
                <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="totalSubmissions"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorSubmissions)"
                name="Submissions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance Rate Trend */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-slate-200">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Compliance Rate Trend
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              {timePeriod === 'day' ? 'Daily' : timePeriod === 'week' ? 'Weekly' : 'Monthly'} compliance percentage
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeries?.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                }}
                formatter={(value) => [`${value}%`, 'Compliance']}
              />
              <Line
                type="monotone"
                dataKey="complianceRate"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                name="Compliance %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* User Activity & Form Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Users */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-slate-200">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Top Active Users
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Users with most submissions
            </p>
          </div>
          <div className="space-y-3">
            {userActivity?.users?.slice(0, 10).map((user, index) => (
              <div key={user.userId || index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-maroon-100 rounded-full flex items-center justify-center font-bold text-maroon-700 text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{user.userName || 'Unknown User'}</div>
                    <div className="text-xs text-slate-500">{user.userEmail || ''}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-maroon-600">{user.totalSubmissions}</div>
                  <div className="text-xs text-slate-500">submissions</div>
                </div>
              </div>
            ))}
            {(!userActivity?.users || userActivity.users.length === 0) && (
              <div className="text-center py-8 text-slate-500">No user activity data available</div>
            )}
          </div>
        </div>

        {/* Form Performance */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-slate-200">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Form Template Usage
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Most used forms
            </p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={formStats?.forms?.slice(0, 10) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="formName"
                stroke="#64748b"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                }}
              />
              <Bar dataKey="totalSubmissions" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Performance */}
      {comprehensive?.departmentStats && comprehensive.departmentStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-slate-200">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Department performance (by form&apos;s assigned department)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Compliance by form&apos;s department
            </p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={comprehensive.departmentStats.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="departmentId"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(value) => {
                  const dept = departments.find(d => d._id === value)
                  return dept?.code || 'N/A'
                }}
              />
              <YAxis yAxisId="left" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                }}
                formatter={(value, name) => {
                  if (name === 'complianceRate') return [`${value}%`, 'Compliance Rate']
                  return [value, name]
                }}
                labelFormatter={(value) => {
                  const dept = departments.find(d => d._id === value)
                  return dept?.name || 'Unknown'
                }}
              />
              <Bar yAxisId="left" dataKey="totalSubmissions" fill="#3b82f6" name="Submissions" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="complianceRate"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                name="Compliance %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly Trends */}
      {comprehensive?.timeSeries?.monthly && comprehensive.timeSeries.monthly.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 border border-slate-200">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Monthly Trends (Last 12 Months)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Submissions and cases over time
            </p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={comprehensive.timeSeries.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="left" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                }}
              />
              <Bar yAxisId="left" dataKey="submissions" fill="#3b82f6" name="Submissions" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cases"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', r: 4 }}
                name="Cases"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
