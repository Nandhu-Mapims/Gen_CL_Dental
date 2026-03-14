import { useEffect, useState, Suspense } from 'react'
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
} from 'recharts'

// Skeleton loader component
const ChartSkeleton = () => (
  <div className="w-full h-[350px] bg-slate-100 rounded-lg animate-pulse" />
)

const MetricsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-4 animate-pulse" />
        <div className="h-10 bg-slate-200 rounded w-1/3 mb-2 animate-pulse" />
        <div className="h-3 bg-slate-200 rounded w-2/3 animate-pulse" />
      </div>
    ))}
  </div>
)

export function EnhancedAnalytics() {
  const [executiveData, setExecutiveData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [error, setError] = useState('')

  useEffect(() => {
    loadExecutiveAnalytics()
  }, [selectedPeriod])

  const loadExecutiveAnalytics = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.get(`/audits/executive-analytics?period=${selectedPeriod}`)
      setExecutiveData(data)
    } catch (err) {
      console.error('Error loading executive analytics', err)
      setError(err.response?.data?.message || err.message || 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  // Show UI immediately, load data progressively
  const showSkeleton = loading && !executiveData

  if (error && !executiveData) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 text-white rounded-xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-2">Executive Analytics</h2>
          <p className="text-maroon-100">Strategic insights and performance metrics</p>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-800 font-semibold mb-2">Error Loading Analytics Data</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadExecutiveAnalytics}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!executiveData && !loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 text-white rounded-xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-2">Executive Analytics</h2>
          <p className="text-maroon-100">Strategic insights and performance metrics</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <p className="text-slate-600">No analytics data available yet</p>
        </div>
      </div>
    )
  }

  // Safe destructuring with defaults
  // Safe destructuring with defaults
  const { summary = {}, trends = {}, departmentPerformance = [], riskIndicators = {}, insights = [], clearanceAnalysis = [] } = executiveData || {}

  const riskColor = summary?.riskLevel === 'low' ? 'green' : summary?.riskLevel === 'medium' ? 'yellow' : 'red'
  const riskText = summary?.riskLevel === 'low' ? 'text-green-800' : summary?.riskLevel === 'medium' ? 'text-yellow-800' : 'text-red-800'

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-maroon-700 via-maroon-700 to-maroon-800 text-white rounded-xl shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">
                Executive Analytics Dashboard
              </h2>
              <p className="text-maroon-100 text-lg">
                Strategic Performance Insights & Risk Analysis
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-maroon-200 mb-2">Period View</div>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white"
              >
                <option value="week" className="text-gray-900">Last Week</option>
                <option value="month" className="text-gray-900">Last Month</option>
                <option value="quarter" className="text-gray-900">Last Quarter</option>
                <option value="year" className="text-gray-900">Last Year</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Key Strategic Metrics */}
      {showSkeleton ? (
        <MetricsSkeleton />
      ) : executiveData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Overall Compliance */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-maroon-500">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-slate-600">Overall Compliance</div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${(summary?.complianceTrend || 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {(summary?.complianceTrend || 0) >= 0 ? '↑' : '↓'} {Math.abs(summary?.complianceTrend || 0)}%
              </div>
            </div>
            <div className="text-4xl font-bold text-maroon-600 mb-2">{summary?.complianceRate || 0}%</div>
            <div className="text-xs text-slate-500">
              Previous: {summary?.previousComplianceRate || 0}%
            </div>
            <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-maroon-500 rounded-full transition-all"
                style={{ width: `${summary?.complianceRate || 0}%` }}
              />
            </div>
          </div>

          {/* Total Audit Sessions */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-maroon-500">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-slate-600">Audit Sessions</div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${(summary?.submissionTrend || 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {(summary?.submissionTrend || 0) >= 0 ? '↑' : '↓'} {Math.abs(summary?.submissionTrend || 0)}%
              </div>
            </div>
            <div className="text-4xl font-bold text-maroon-600 mb-2">{summary?.totalCases || 0}</div>
            <div className="text-xs text-slate-500">
              {summary?.totalSubmissions || 0} submissions
            </div>
          </div>

          {/* Risk Level */}
          <div className={`bg-white rounded-xl shadow-lg p-6 border-l-4 border-${riskColor || 'green'}-500`}>
            <div className="text-sm font-medium text-slate-600 mb-4">Risk Level</div>
            <div className={`text-4xl font-bold mb-2 ${riskText || 'text-green-800'}`}>
              {riskIndicators?.overallRiskLevel || 'N/A'}
            </div>
            <div className="text-xs text-slate-500">
              {riskIndicators?.highRiskDepartments?.length || 0} high-risk departments
            </div>
          </div>

          {/* Issue Resolution */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="text-sm font-medium text-slate-600 mb-4">Issue Resolution</div>
            <div className="text-4xl font-bold text-green-600 mb-2">{summary?.closedIssues || 0}</div>
            <div className="text-xs text-slate-500">
              {summary?.openIssues || 0} open issues remaining
            </div>
            <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: (summary?.closedIssues || 0) + (summary?.openIssues || 0) > 0
                    ? `${((summary?.closedIssues || 0) / ((summary?.closedIssues || 0) + (summary?.openIssues || 0))) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Strategic Insights */}
      {executiveData && insights && insights.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">📊 Strategic Insights</h3>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${insight.type === 'positive'
                    ? 'bg-green-50 border-green-500'
                    : insight.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-500'
                      : 'bg-red-50 border-red-500'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {insight.type === 'positive' ? '✅' : insight.type === 'warning' ? '⚠️' : '🚨'}
                  </span>
                  <span className="font-medium text-slate-800">{insight.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends Over Time */}
      {showSkeleton ? (
        <ChartSkeleton />
      ) : executiveData && trends && trends.monthly && trends.monthly.length > 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">📈 Performance Trends (Last 6 Months)</h3>
          <Suspense fallback={<ChartSkeleton />}>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={trends.monthly}>
                <defs>
                  <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis yAxisId="left" stroke="#6366f1" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="complianceRate"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorCompliance)"
                  name="Compliance Rate %"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cases"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                  name="Cases"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Suspense>
        </div>
      ) : null}

      {/* Department Performance Ranking */}
      {executiveData && departmentPerformance && departmentPerformance.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
          <div className="bg-gradient-to-r from-maroon-700 to-maroon-700 text-white px-6 py-4">
            <h3 className="text-lg font-bold">🏆 Department Performance Ranking</h3>
            <p className="text-maroon-100 text-sm">By form&apos;s assigned department · ranked by compliance rate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-maroon-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase w-12">#</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase">Department</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase">Cases</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase">Compliance Rate</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase">Open Issues</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-700 uppercase">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {departmentPerformance.map((dept, idx) => (
                  <tr key={idx} className="hover:bg-maroon-50">
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-slate-100 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-maroon-100 text-maroon-700'
                        }`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{dept.departmentName || dept.departmentCode}</div>
                      <div className="text-xs text-slate-500">{dept.departmentCode}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-maroon-100 text-maroon-700 rounded-full text-sm font-semibold">
                        {dept.cases}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${dept.complianceRate >= 90 ? 'bg-green-100 text-green-700' :
                          dept.complianceRate >= 70 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                        {dept.complianceRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${dept.openIssues === 0 ? 'bg-green-100 text-green-700' :
                          dept.openIssues < 5 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                        {dept.openIssues}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${dept.complianceRate >= 90 ? 'bg-green-500' :
                                dept.complianceRate >= 70 ? 'bg-yellow-500' :
                                  'bg-red-500'
                              }`}
                            style={{ width: `${dept.complianceRate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risk Indicators */}
      {executiveData && riskIndicators && riskIndicators.highRiskDepartments && riskIndicators.highRiskDepartments.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">High-Risk Departments</h3>
              <p className="text-sm text-red-700">Requires immediate attention</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {riskIndicators.highRiskDepartments.map((dept, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border-2 border-red-300">
                <div className="font-semibold text-red-900 mb-2">{dept.name}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Compliance:</span>
                    <span className="font-bold text-red-600">{dept.complianceRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Open Issues:</span>
                    <span className="font-bold text-red-600">{dept.openIssues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Sessions:</span>
                    <span className="font-semibold">{dept.totalCases}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 100% Clearance Analysis */}
      {showSkeleton ? (
        <ChartSkeleton />
      ) : executiveData && clearanceAnalysis && clearanceAnalysis.length > 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">✅ 100% Clearance Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={clearanceAnalysis}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="departmentCode"
                stroke="#64748b"
                fontSize={11}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis stroke="#64748b" domain={[0, 100]} fontSize={12} />
              <Tooltip
                formatter={(value) => `${value}%`}
                labelFormatter={(label) => `Clearance Rate: ${label}`}
              />
              <Legend />
              <Bar dataKey="clearanceRate" fill="#10b981" name="Clearance Rate %" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}
