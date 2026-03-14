import { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../../api/client'

// Build hierarchy: top-level departments and their sub-departments (for form-under-sub-department selection)
function useDepartmentHierarchy(departments) {
  return useMemo(() => {
    const list = Array.isArray(departments) ? departments : []
    const topLevel = list.filter((d) => !d.parent)
    const childrenOf = {}
    list.filter((d) => d.parent).forEach((d) => {
      const pid = d.parent?._id ?? d.parent
      if (!pid) return
      const key = typeof pid === 'object' ? pid.toString() : String(pid)
      if (!childrenOf[key]) childrenOf[key] = []
      childrenOf[key].push(d)
    })
    return { topLevel, childrenOf }
  }, [departments])
}

export function FormTemplateManagement() {
  const [departments, setDepartments] = useState([])
  const [forms, setForms] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingForm, setEditingForm] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    departmentId: '',
    isCommon: false,
    isActive: true,
  })
  const [loadError, setLoadError] = useState('')

  const { topLevel, childrenOf } = useDepartmentHierarchy(departments)

  const getFormDepartments = (form) => {
    return form.departments?.map((d) => (typeof d === 'object' ? d : null)).filter(Boolean) || []
  }

  const loadData = async () => {
    try {
      setLoadError('')
      const [formsData, deptsData] = await Promise.all([
        apiClient.get('/form-templates'),
        apiClient.get('/departments'),
      ])
      setForms(Array.isArray(formsData) ? formsData : [])
      setDepartments(Array.isArray(deptsData) ? deptsData : [])
    } catch (err) {
      console.error('Error loading form templates', err)
      setLoadError(err.response?.data?.message || err.message || 'Failed to load form templates')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.departmentId) {
      alert('Please select the department this form belongs to (required for analytics).')
      return
    }
    const payload = {
      ...formData,
      departmentIds: formData.departmentId ? [formData.departmentId] : [],
    }
    try {
      if (editingForm) {
        await apiClient.put(`/form-templates/${editingForm._id}`, payload)
      } else {
        await apiClient.post('/form-templates', payload)
      }
      setShowForm(false)
      setEditingForm(null)
      setFormData({
        name: '',
        description: '',
        departmentId: '',
        isCommon: false,
        isActive: true,
      })
      loadData()
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      alert(msg || 'Error saving form template')
      console.error(err)
    }
  }

  const handleEdit = (form) => {
    setEditingForm(form)
    const firstDept = form.departments?.[0]
    const departmentId = firstDept ? (typeof firstDept === 'object' ? firstDept._id : firstDept) : ''
    setFormData({
      name: form.name,
      description: form.description || '',
      departmentId: departmentId || '',
      isCommon: form.isCommon || false,
      isActive: form.isActive !== undefined ? form.isActive : true,
    })
    setShowForm(true)
  }

  const handleDeleteClick = (id) => {
    setDeleteConfirmId(id)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    try {
      await apiClient.delete(`/form-templates/${deleteConfirmId}`)
      setDeleteConfirmId(null)
      loadData()
    } catch (err) {
      alert('Error deleting form template')
      console.error(err)
    }
  }


  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={loadData} className="text-red-600 hover:text-red-800 font-medium">Retry</button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Form Templates</h2>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1">Create forms and assign them to departments</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingForm(null)
            setFormData({
              name: '',
              description: '',
              departmentId: '',
              isCommon: false,
              isActive: true,
            })
          }}
          className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-sm transition-colors text-xs sm:text-sm font-medium"
        >
          Create New Form
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {editingForm ? 'Edit Form Template' : 'Create New Form Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Form Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g., MAPIMS - Case Sheet Audit Checklist"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                rows="3"
                placeholder="Brief description of this form template"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Form belongs to department or sub-department <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">Select overall department or specific sub-department</option>
                {topLevel
                  .filter((d) => d.isActive !== false)
                  .map((parent) => {
                    const subs = childrenOf[String(parent._id)] ?? []
                    return (
                      <optgroup key={parent._id} label={parent.name}>
                        <option value={parent._id}>
                          {parent.name} ({parent.code}) — overall
                        </option>
                        {subs
                          .filter((s) => s.isActive !== false)
                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                          .map((sub) => (
                            <option key={sub._id} value={sub._id}>
                              └ {sub.name} ({sub.code})
                            </option>
                          ))}
                      </optgroup>
                    )
                  })}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Create the form under the overall department or a specific sub-department. User assignment in Configure → Assign Forms.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-maroon-600 border-slate-300 rounded focus:ring-maroon-500"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">Active</label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white px-6 py-2 rounded-lg shadow-sm transition-colors font-medium"
              >
                {editingForm ? 'Update' : 'Create'} Form
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingForm(null)
                }}
                className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-sm text-slate-700 uppercase tracking-wide w-12">#</th>
                <th className="text-left px-6 py-4 font-semibold text-sm text-slate-700 uppercase tracking-wide">Form Name</th>
                <th className="text-left px-6 py-4 font-semibold text-sm text-slate-700 uppercase tracking-wide">Description</th>
                <th className="text-left px-6 py-4 font-semibold text-sm text-slate-700 uppercase tracking-wide">Departments</th>
                <th className="text-left px-6 py-4 font-semibold text-sm text-slate-700 uppercase tracking-wide">Status</th>
                <th className="text-center px-6 py-4 font-semibold text-sm text-slate-700 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {forms.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    No form templates created yet. Click "Create New Form" to get started.
                  </td>
                </tr>
              ) : (
                forms.map((form, idx) => {
                  const assignedDepts = getFormDepartments(form)
                  return (
                    <tr key={form._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{form.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                        {form.description || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {assignedDepts.length === 0 ? (
                          <span className="text-sm text-amber-600 font-medium">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {assignedDepts.map((dept) => (
                              <span
                                key={dept._id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-maroon-50 border border-maroon-200 text-maroon-700 rounded-full text-xs font-medium"
                              >
                                {dept.name} ({dept.code})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${form.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {form.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(form)}
                            className="text-maroon-700 hover:text-maroon-800 text-sm font-medium px-3 py-1 rounded hover:bg-maroon-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(form._id)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal - centered, small popup */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-sm">
            <p className="text-slate-800 font-medium text-center mb-5">
              Are you sure you want to delete this form template?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
