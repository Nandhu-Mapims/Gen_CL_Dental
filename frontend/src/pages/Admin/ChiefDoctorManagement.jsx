import { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'

export function ChiefDoctorManagement() {
  const [chiefDoctors, setChiefDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    designation: 'Unit Supervisor',
    departmentId: '',
    isActive: true,
    order: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [chiefs, depts, masterData] = await Promise.all([
        apiClient.get('/chief-doctors'),
        apiClient.get('/departments'),
        apiClient.get('/master-data'),
      ])
      setChiefDoctors(chiefs)
      setDepartments(depts)
      setDesignations(masterData.designations || [])
    } catch (err) {
      alert('Error loading data: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('Name is required')
      return
    }

    try {
      const payload = {
        name: formData.name.trim(),
        designation: formData.designation.trim() || 'Unit Supervisor',
        departmentId: formData.departmentId || null,
        isActive: formData.isActive,
        order: parseInt(formData.order) || 0,
      }

      if (editingId) {
        await apiClient.put(`/chief-doctors/${editingId}`, payload)
        alert('Unit supervisor updated successfully')
      } else {
        await apiClient.post('/chief-doctors', payload)
        alert('Unit supervisor created successfully')
      }

      setFormData({ name: '', designation: 'Unit Supervisor', departmentId: '', isActive: true, order: 0 })
      setEditingId(null)
      loadData()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleEdit = (chief) => {
    setFormData({
      name: chief.name,
      designation: chief.designation || 'Unit Supervisor',
      departmentId: chief.department?._id || '',
      isActive: chief.isActive,
      order: chief.order || 0,
    })
    setEditingId(chief._id)
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete unit supervisor "${name}"?`)) return

    try {
      await apiClient.delete(`/chief-doctors/${id}`)
      alert('Unit supervisor deleted successfully')
      loadData()
    } catch (err) {
      alert('Error deleting: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleCancel = () => {
    setFormData({ name: '', designation: 'Unit Supervisor', departmentId: '', isActive: true, order: 0 })
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Unit Supervisor Management</h1>
        <p className="mt-1 text-sm text-slate-600">Manage unit supervisors — they appear as dropdown options when staff submit audit checklists</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          {editingId ? 'Edit Unit Supervisor' : 'Add New Unit Supervisor'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="e.g. Jane Smith, John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
              <select
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">Select designation</option>
                {designations.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Department <span className="text-xs text-slate-500">(Optional - All if blank)</span>
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Order</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-maroon-700 border-slate-300 rounded focus:ring-2 focus:ring-maroon-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              {editingId ? 'Update' : 'Add'} Unit Supervisor
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">
            Unit Supervisors List ({chiefDoctors.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-600">Loading...</div>
        ) : chiefDoctors.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No unit supervisors added yet. Add one using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 w-12">#</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Order</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Designation</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Department</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {chiefDoctors.map((chief, idx) => (
                  <tr key={chief._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-slate-500 font-medium text-sm">{idx + 1}</td>
                    <td className="p-3 text-sm text-slate-600">{chief.order}</td>
                    <td className="p-3 text-sm font-medium text-slate-800">{chief.name}</td>
                    <td className="p-3 text-sm text-slate-600">{chief.designation || 'Unit Supervisor'}</td>
                    <td className="p-3 text-sm text-slate-600">
                      {chief.department ? `${chief.department.name} (${chief.department.code})` : 'All Departments'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          chief.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {chief.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(chief)}
                          className="text-maroon-700 hover:text-maroon-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(chief._id, chief.name)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
