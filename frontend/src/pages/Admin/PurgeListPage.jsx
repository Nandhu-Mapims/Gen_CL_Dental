import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiClient } from '../../api/client'

const PAGE_CONFIG = {
  form: {
    title: 'Permanently delete forms',
    subtitle: 'Deactivated forms only. Removes form and checklist items from the database.',
    apiType: 'form',
    listPath: '/admin/purge/forms',
    backTo: '/admin/forms',
    backLabel: 'Form templates',
    empty: 'No deactivated forms. Use Deactivate on the forms page first.',
    columns: ['Name', 'Type', 'Department', 'Items', 'Submissions', 'Action'],
  },
  user: {
    title: 'Permanently delete users',
    subtitle: 'Deactivated users only. Cannot delete if linked to audit submissions.',
    apiType: 'user',
    listPath: '/admin/purge/users',
    backTo: '/admin/users',
    backLabel: 'User management',
    empty: 'No deactivated users. Use Deactivate on the users page first.',
    columns: ['Name', 'Email', 'Role', 'Department', 'Submissions', 'Action'],
  },
  department: {
    title: 'Permanently delete departments',
    subtitle: 'Inactive departments only. Must have no users, forms, or submissions.',
    apiType: 'department',
    listPath: '/admin/purge/departments',
    backTo: '/admin/departments',
    backLabel: 'Departments',
    empty: 'No inactive departments.',
    columns: ['Name', 'Code', 'Users', 'Forms', 'Submissions', 'Action'],
  },
}

export function PurgeListPage({ resourceType }) {
  const config = PAGE_CONFIG[resourceType]
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [purgingId, setPurgingId] = useState(null)
  const [message, setMessage] = useState('')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.get(config.listPath)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [config.listPath])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handlePurge = async (item) => {
    if (!item.canPurge) return
    const label = item.label || item.name || 'this record'
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return
    const typed = window.prompt('Type DELETE to confirm permanent removal.')
    if (typed !== 'DELETE') return

    setPurgingId(item.id)
    setMessage('')
    setError('')
    try {
      await apiClient.delete(`/admin/purge/${config.apiType}/${item.id}`)
      setMessage(`Deleted: ${label}`)
      await loadItems()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Delete failed')
    } finally {
      setPurgingId(null)
    }
  }

  if (!config) {
    return <p className="p-6 text-red-600">Unknown purge page.</p>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-4">
      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-red-900">{config.title}</h1>
          <p className="text-sm text-red-700 mt-1">{config.subtitle}</p>
          <p className="text-xs text-red-600 mt-2">Hidden page — not in sidebar. SUPER_ADMIN only.</p>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-3 text-sm">
          <Link to={config.backTo} className="text-maroon-600 hover:underline">
            ← {config.backLabel}
          </Link>
          <span className="text-slate-300">|</span>
          <Link to="/admin/forms/delete" className="text-slate-600 hover:underline">Forms delete</Link>
          <Link to="/admin/users/delete" className="text-slate-600 hover:underline">Users delete</Link>
          <Link to="/admin/departments/delete" className="text-slate-600 hover:underline">Departments delete</Link>
        </div>

        <div className="p-6 space-y-4">
          {loading && <p className="text-slate-600">Loading…</p>}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
          )}
          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">{message}</div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-slate-600 text-sm">{config.empty}</p>
          )}

          {!loading && items.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {config.columns.map((col) => (
                      <th key={col} className="text-left p-3 font-semibold text-slate-700">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="p-3 font-medium text-slate-900">{item.label}</td>
                      {resourceType === 'form' && (
                        <>
                          <td className="p-3 text-slate-600">{item.formContext || '—'}</td>
                          <td className="p-3 text-slate-600">{item.departments || '—'}</td>
                          <td className="p-3 text-slate-600">{item.checklistCount ?? 0}</td>
                          <td className="p-3 text-slate-600">{item.submissionCount ?? 0}</td>
                        </>
                      )}
                      {resourceType === 'user' && (
                        <>
                          <td className="p-3 text-slate-600">{item.email}</td>
                          <td className="p-3 text-slate-600">{item.role}</td>
                          <td className="p-3 text-slate-600">{item.department}</td>
                          <td className="p-3 text-slate-600">{item.submissionCount ?? 0}</td>
                        </>
                      )}
                      {resourceType === 'department' && (
                        <>
                          <td className="p-3 text-slate-600">{item.code}</td>
                          <td className="p-3 text-slate-600">{item.userCount ?? 0}</td>
                          <td className="p-3 text-slate-600">{item.formCount ?? 0}</td>
                          <td className="p-3 text-slate-600">{item.submissionCount ?? 0}</td>
                        </>
                      )}
                      <td className="p-3">
                        {item.canPurge ? (
                          <button
                            type="button"
                            disabled={purgingId === item.id}
                            onClick={() => handlePurge(item)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            {purgingId === item.id ? 'Deleting…' : 'Delete permanently'}
                          </button>
                        ) : (
                          <span className="text-xs text-amber-700" title={item.blockReason}>
                            Blocked
                          </span>
                        )}
                        {item.blockReason && !item.canPurge && (
                          <p className="text-xs text-amber-600 mt-1 max-w-xs">{item.blockReason}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
