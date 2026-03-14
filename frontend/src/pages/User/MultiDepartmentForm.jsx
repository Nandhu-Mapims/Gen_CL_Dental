import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

export function MultiDepartmentForm() {
  const { user } = useAuth()
  const [forms, setForms] = useState([])
  const [recentSubmissions, setRecentSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user?._id) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const [formList, submissions] = await Promise.all([
          apiClient.get('/form-templates/accessible/list'),
          apiClient.get(`/audits?submittedBy=${user._id}&limit=15`).catch(() => []),
        ])
        setForms(Array.isArray(formList) ? formList : [])
        setRecentSubmissions(Array.isArray(submissions) ? submissions.slice(0, 15) : [])
      } catch (err) {
        console.error('Error loading multi-department data:', err)
        setForms([])
        setRecentSubmissions([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?._id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Multi-Department Checklist</h1>
        <p className="mt-1 text-sm text-slate-600">Choose a checklist to fill or view your recent submissions</p>
      </div>

      {/* Available checklists */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Available checklists</h2>
        {forms.length === 0 ? (
          <p className="text-slate-600 text-sm">No checklists assigned. Contact your administrator.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <Link
                key={form._id}
                to={`/form/${form._id}`}
                className="block p-4 border border-slate-200 rounded-lg hover:border-maroon-300 hover:bg-maroon-50/50 transition-colors"
              >
                <div className="font-medium text-slate-900">{form.name}</div>
                {form.departments?.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">
                    {form.departments.map((d) => d?.name || d).join(', ')}
                  </div>
                )}
                <span className="inline-block mt-2 text-sm text-maroon-600 font-medium">Fill checklist →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent submissions */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Your recent submissions</h2>
        {recentSubmissions.length === 0 ? (
          <p className="text-slate-600 text-sm">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {recentSubmissions.map((sub) => (
              <li key={sub._id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {sub.formTemplate?.name || sub.formTemplateId || 'Checklist'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}
                  </span>
                </div>
                {(sub.patientName || sub.ward || sub.unitNo) && (
                  <p className="text-xs text-slate-600 mt-1">
                    {[sub.patientName, sub.ward, sub.unitNo].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
