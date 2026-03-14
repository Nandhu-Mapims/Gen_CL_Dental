import { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#10b981', '#ef4444', '#94a3b8']

export function AuditorAnalytics() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [user])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const userId = user?.id || user?._id
      if (!userId) { setLoading(false); return }
      const submissions = await apiClient.get(`/audits?submittedBy=${encodeURIComponent(userId)}`)

      const responseVal = (s) => (s.responseValue || s.yesNoNa || '').toString().toUpperCase()
      const yesCount = submissions.filter(s => responseVal(s) === 'YES').length
      const noCount = submissions.filter(s => responseVal(s) === 'NO').length
      const unansweredCount = submissions.filter(s => !responseVal(s) || (responseVal(s) !== 'YES' && responseVal(s) !== 'NO')).length

      // Documentation thoroughness: when auditor marked NO, did they add remarks?
      const noSubs = submissions.filter(s => responseVal(s) === 'NO')
      const noWithRemarks = noSubs.filter(s => s.remarks && String(s.remarks).trim()).length
      const thoroughnessRate = noSubs.length > 0 ? Math.round((noWithRemarks / noSubs.length) * 100) : 100

      // Count unique audit sessions (same submittedAt second + department + form)
      const uniqueSessions = new Set(
        submissions.map(s => {
          const t = s.submittedAt ? Math.floor(new Date(s.submittedAt).getTime() / 1000) : 0
          const d = s.department?._id || s.department || ''
          const f = s.formTemplate?._id || s.formTemplate || ''
          return `${t}_${d}_${f}`
        })
      ).size

      const byDepartment = {}
      submissions.forEach(s => {
        const deptName = s.department?.name || 'Unknown'
        if (!byDepartment[deptName]) {
          byDepartment[deptName] = { name: deptName, count: 0 }
        }
        byDepartment[deptName].count++
      })

      const byDate = {}
      const today = new Date()
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        byDate[dateStr] = { date: dateStr, submissions: 0 }
      }
      submissions.forEach(s => {
        const subDate = new Date(s.submittedAt)
        const dateStr = subDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (byDate[dateStr]) {
          byDate[dateStr].submissions++
        }
      })

      setStats({
        responseDistribution: [
          { name: 'YES', value: yesCount },
          { name: 'NO', value: noCount },
          { name: 'Unanswered', value: unansweredCount },
        ],
        departmentDistribution: Object.values(byDepartment),
        dailyActivity: Object.values(byDate),
        totalSubmissions: submissions.length,
        uniqueSessions,
        thoroughnessRate,
      })
    } catch (err) {
      console.error('Error loading analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Auditor Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">Your productivity and documentation metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Submissions</p>
              <p className="text-4xl font-bold text-slate-900 mt-2">{stats?.totalSubmissions || 0}</p>
            </div>
            <div className="bg-maroon-50 p-4 rounded-full">
              <svg className="w-8 h-8 text-maroon-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Audit Sessions</p>
              <p className="text-4xl font-bold text-slate-900 mt-2">{stats?.uniqueSessions || 0}</p>
            </div>
            <div className="bg-maroon-50 p-4 rounded-full">
              <svg className="w-8 h-8 text-maroon-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Documentation Thoroughness</p>
              <p className="text-4xl font-bold text-emerald-600 mt-2">{stats?.thoroughnessRate ?? 0}%</p>
              <p className="text-xs text-slate-500 mt-1">NOs with remarks</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-full">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Responses You Recorded</h3>
          <p className="text-xs text-slate-500 mb-2">What you observed in your audits (department compliance)</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.responseDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {stats?.responseDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Daily Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="submissions" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats?.departmentDistribution && stats.departmentDistribution.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Submissions by department (form&apos;s assigned)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.departmentDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#10b981" name="Submissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
