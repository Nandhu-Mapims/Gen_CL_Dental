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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'

const COLORS = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#60a5fa', '#93c5fd', '#dbeafe']

export function Dashboard() {
  const [stats, setStats] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setError('')
      setLoading(true)
      // Load basic stats first (without clearance stats for faster response)
      // Clearance stats can be loaded separately if needed
      const [statData, deptData] = await Promise.all([
        apiClient.get('/audits/stats?includeClearance=false'),
        apiClient.get('/departments'),
      ])
      setStats(statData)
      setDepartments(deptData)
      
      // Optionally load clearance stats in background (non-blocking)
      // This can be enabled later if needed
      // apiClient.get('/audits/stats?includeClearance=true')
      //   .then(fullStats => {
      //     if (fullStats.clearanceStats) {
      //       setStats(prev => ({ ...prev, clearanceStats: fullStats.clearanceStats }))
      //     }
      //   })
      //   .catch(err => console.warn('Failed to load clearance stats:', err))
    } catch (err) {
      console.error('Error loading dashboard data', err)
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load dashboard data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getDeptName = (id) => {
    if (!id) return 'Unknown'
    const dept = departments.find((d) => d._id === id || d._id?.toString() === id?.toString())
    return dept?.name || 'Unknown'
  }

  const getDeptCode = (id) => {
    if (!id) return 'N/A'
    const dept = departments.find((d) => d._id === id || d._id?.toString() === id?.toString())
    return dept?.code || 'N/A'
  }

  // Show UI immediately with skeleton
  const MetricsSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-maroon-200/50">
          <div className="h-3 bg-gradient-to-r from-maroon-100 to-maroon-100 rounded w-1/2 mb-3 animate-pulse" />
          <div className="h-8 bg-gradient-to-r from-maroon-200 to-maroon-200 rounded w-1/3 mb-2 animate-pulse" />
          <div className="h-2 bg-gradient-to-r from-maroon-100 to-maroon-100 rounded w-2/3 animate-pulse" />
        </div>
      ))}
    </div>
  )

  if (loading && !stats) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-maroon-600 to-maroon-600 bg-clip-text text-transparent">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Comprehensive department-wise quality audit compliance analytics (by form&apos;s assigned department)</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-maroon-600 to-maroon-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-maroon-500/50">
              ADMIN ROLE
            </span>
          </div>
        </div>
        <MetricsSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-maroon-600 to-maroon-600 bg-clip-text text-transparent">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Department-wise quality audit compliance analytics (by form&apos;s assigned department)</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-maroon-600 to-maroon-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-maroon-500/50">
              ADMIN ROLE
            </span>
          </div>
        </div>
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 text-center shadow-lg">
          <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-800 font-semibold mb-2">Error Loading Dashboard Data</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!stats || !stats.departmentStats || stats.departmentStats.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-maroon-600 to-maroon-600 bg-clip-text text-transparent">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Department-wise quality audit compliance analytics (by form&apos;s assigned department)</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-maroon-600 to-maroon-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-maroon-500/50">
              ADMIN ROLE
            </span>
          </div>
        </div>
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-12 text-center border-2 border-dashed border-maroon-300">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-slate-700 text-lg font-medium mb-2">No audit data available yet</p>
          <p className="text-sm text-slate-500">
            Start creating audit submissions to see statistics here
          </p>
        </div>
      </div>
    )
  }

  const { departmentStats, overall, totalCases } = stats

  // Prepare chart data
  const barChartData = departmentStats.map((s) => ({
    name: getDeptCode(s._id),
    fullName: getDeptName(s._id),
    sessions: s.caseCount || 0,
    submissions: s.total || 0,
    compliant: s.compliant || 0,
    nonCompliant: s.nonCompliant || 0,
    compliance: s.total > 0 ? Math.round((s.compliant / s.total) * 100) : 0,
  }))

  const pieChartData = departmentStats.map((s) => ({
    name: getDeptCode(s._id),
    value: s.caseCount || 0,
  }))

  const complianceData = departmentStats.map((s) => ({
    name: getDeptCode(s._id),
    compliance: s.total > 0 ? Math.round((s.compliant / s.total) * 100) : 0,
  }))

  const totalCompliance =
    overall.totalSubmissions > 0
      ? Math.round((overall.totalCompliant / overall.totalSubmissions) * 100)
      : 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-maroon-600 to-maroon-600 bg-clip-text text-transparent">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Comprehensive department-wise quality audit compliance analytics</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-maroon-600 to-maroon-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-maroon-500/50">
            ADMIN ROLE
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-maroon-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Audit Sessions
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-maroon-600 to-maroon-600 bg-clip-text text-transparent">{totalCases}</p>
              <p className="text-[9px] sm:text-xs text-slate-500 mt-1">Total audit sessions</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-maroon-100 to-maroon-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 shadow-sm">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-maroon-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-maroon-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Submissions
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-maroon-600 to-maroon-600 bg-clip-text text-transparent">
                {overall.totalSubmissions || 0}
              </p>
              <p className="text-[9px] sm:text-xs text-slate-500 mt-1">Total entries</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-maroon-100 to-maroon-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 shadow-sm">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-maroon-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-maroon-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Compliance
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-600">{totalCompliance}%</p>
              <p className="text-[9px] sm:text-xs text-slate-500 mt-1">Overall rate</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 shadow-sm">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-maroon-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-slate-600 mb-1 font-medium uppercase tracking-wide">
                Open Issues
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-600">
                {overall.totalOpenIssues || 0}
              </p>
              <p className="text-[9px] sm:text-xs text-slate-500 mt-1">Requires attention</p>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 shadow-sm">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Cases by Department */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-5 sm:p-6 border border-maroon-200/50">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Audit Sessions by Department
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">Sessions distribution across departments</p>
          </div>
          <ResponsiveContainer width="100%" height={280} className="sm:h-[320px]">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={11}
                tick={{ fill: '#64748b' }}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11}
                tick={{ fill: '#64748b' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '12px',
                }}
                formatter={(value, name) => {
                  if (name === 'sessions') return [value, 'Sessions']
                  if (name === 'submissions') return [value, 'Submissions']
                  return [value, name]
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar 
                dataKey="sessions" 
                fill="url(#colorCases)" 
                name="Sessions" 
                radius={[8, 8, 0, 0]}
                stroke="#2563eb"
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cases Distribution */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-5 sm:p-6 border border-maroon-200/50">
          <div className="mb-4 sm:mb-5">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
              Department Distribution
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">Sessions breakdown by department</p>
          </div>
          <ResponsiveContainer width="100%" height={280} className="sm:h-[320px]">
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compliance Chart */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-5 sm:p-6 border border-maroon-200/50">
        <div className="mb-4 sm:mb-5">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">
            Compliance Rate by Department
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">Trend analysis across departments</p>
        </div>
        <ResponsiveContainer width="100%" height={280} className="sm:h-[320px]">
          <AreaChart data={complianceData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              stroke="#64748b" 
              fontSize={11}
              tick={{ fill: '#64748b' }}
            />
            <YAxis 
              stroke="#64748b" 
              domain={[0, 100]} 
              fontSize={11}
              tick={{ fill: '#64748b' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                padding: '12px',
              }}
              formatter={(value) => [`${value}%`, 'Compliance']}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Area
              type="monotone"
              dataKey="compliance"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#colorCompliance)"
              name="Compliance %"
            />
            <Line
              type="monotone"
              dataKey="compliance"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ fill: '#2563eb', r: 5, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Department-wise Detailed Stats */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-maroon-200/50">
        <div className="bg-gradient-to-r from-maroon-50 to-maroon-50 border-b border-maroon-200/50 px-5 sm:px-6 py-4 sm:py-5">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900">Department-wise Statistics</h3>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">By form&apos;s assigned department (not submitter&apos;s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">#</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sessions
                </th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Submissions
                </th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Compliant
                </th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Non-Compliant
                </th>
                <th className="px-4 sm:px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Compliance %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {barChartData.map((dept, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-maroon-50 transition-colors duration-150"
                >
                  <td className="px-4 sm:px-6 py-4 text-slate-500 font-medium">{index + 1}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="font-semibold text-sm sm:text-base text-slate-800">{dept.fullName}</div>
                    <div className="text-xs text-slate-500">({dept.name})</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs sm:text-sm font-semibold">
                      {dept.sessions}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center text-sm sm:text-base text-slate-700 font-medium">
                    {dept.submissions}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs sm:text-sm font-semibold">
                      {dept.compliant}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-center">
                    <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs sm:text-sm font-semibold">
                      {dept.nonCompliant}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 sm:w-24 md:w-32 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-maroon-600 to-maroon-600 rounded-full transition-all duration-500"
                          style={{ width: `${dept.compliance}%` }}
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 w-12 text-right">
                        {dept.compliance}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
