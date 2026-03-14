import { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../../api/client'

function useDepartmentHierarchy(departments) {
  return useMemo(() => {
    const list = Array.isArray(departments) ? departments : []
    const topLevel = list.filter((d) => !d.parent)
    const childrenOf = {}
    list.filter((d) => d.parent).forEach((d) => {
      const pid = d.parent?._id ?? d.parent
      if (!pid) return
      const key = typeof pid === 'object' ? String(pid) : String(pid)
      if (!childrenOf[key]) childrenOf[key] = []
      childrenOf[key].push(d)
    })
    return { topLevel, childrenOf }
  }, [departments])
}

export function FormBuilder() {
  const [departments, setDepartments] = useState([])
  const [items, setItems] = useState([])
  const [label, setLabel] = useState('')
  const [scope, setScope] = useState('SINGLE')
  const [departmentId, setDepartmentId] = useState('')
  const [isMandatory, setIsMandatory] = useState(false)
  const { topLevel, childrenOf } = useDepartmentHierarchy(departments)


  useEffect(() => {
    ; (async () => {
      const depts = await apiClient.get('/departments')
      setDepartments(Array.isArray(depts) ? depts : [])
      if (depts?.length) {
        const first = depts.find((d) => !d.parent) ?? depts[0]
        const id = first._id
        setDepartmentId(id)
        const checklist = await apiClient.get('/checklists/department/' + id)
        setItems(checklist)
      }
    })()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    await apiClient.post('/checklists', {
      label,
      departmentScope: scope,
      departmentId: scope === 'SINGLE' ? departmentId : undefined,
      isMandatory,
    })
    setLabel('')
    setIsMandatory(false)
    const checklist = await apiClient.get('/checklists/department/' + departmentId)
    setItems(checklist)
  }

  const handleReorder = async (id, direction) => {
    const idx = items.findIndex((i) => i._id === id)
    if (idx === -1) return
    const newItems = [...items]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= newItems.length) return
      ;[newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]]
    setItems(newItems)
    await apiClient.post('/checklists/reorder', {
      items: newItems.map((it, index) => ({ id: it._id, order: index + 1 })),
    })
  }

  const toggleActive = async (item) => {
    await apiClient.put(`/checklists/${item._id}`, {
      label: item.label,
      departmentScope: item.departmentScope,
      departmentId: item.department?._id,
      isActive: !item.isActive,
      order: item.order,
      isMandatory: item.isMandatory,
    })
    const checklist = await apiClient.get('/checklists/department/' + departmentId)
    setItems(checklist)
  }

  const handleDepartmentChange = async (id) => {
    setDepartmentId(id)
    const checklist = await apiClient.get('/checklists/department/' + id)
    setItems(checklist)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Checklist Item Builder</h2>
      <p className="text-slate-600">
        Create and manage individual checklist items that will appear in audit forms
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-slate-700">Preview for department or sub-department:</label>
        <select
          className="border rounded px-2 py-1 text-sm min-w-[220px]"
          value={departmentId}
          onChange={(e) => handleDepartmentChange(e.target.value)}
        >
          {topLevel.map((parent) => {
            const subs = childrenOf[String(parent._id)] ?? []
            return (
              <optgroup key={parent._id} label={parent.name}>
                <option value={parent._id}>{parent.name} — overall</option>
                {subs.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((sub) => (
                  <option key={sub._id} value={sub._id}>└ {sub.name}</option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-white shadow rounded p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
          <input
            className="border rounded w-full px-2 py-1 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
          <select
            className="border rounded w-full px-2 py-1 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="SINGLE">Single Department</option>
            <option value="ALL">All Departments (Common)</option>
          </select>
        </div>
        {scope === 'SINGLE' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Department or sub-department</label>
            <select
              className="border rounded w-full px-2 py-1 text-sm min-w-[200px]"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {topLevel.map((parent) => {
                const subs = childrenOf[String(parent._id)] ?? []
                return (
                  <optgroup key={parent._id} label={parent.name}>
                    <option value={parent._id}>{parent.name} — overall</option>
                    {subs.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((sub) => (
                      <option key={sub._id} value={sub._id}>└ {sub.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            id="mandatory"
            type="checkbox"
            checked={isMandatory}
            onChange={(e) => setIsMandatory(e.target.checked)}
          />
          <label htmlFor="mandatory" className="text-xs text-slate-700">
            Mandatory
          </label>
        </div>
        <div>
          <button
            type="submit"
            className="bg-maroon-600 text-white px-3 py-2 rounded text-sm w-full"
          >
            Add Checklist Item
          </button>
        </div>
      </form>

      <div className="bg-white shadow rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">Label</th>
              <th className="text-left px-3 py-2">Scope</th>
              <th className="text-left px-3 py-2">Mandatory</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it._id} className="border-t">
                <td className="px-3 py-2 text-slate-500 font-medium">{idx + 1}</td>
                <td className="px-3 py-2">{it.label}</td>
                <td className="px-3 py-2 text-xs">
                  {it.departmentScope === 'ALL'
                    ? 'All departments'
                    : it.department?.name || 'Single'}
                </td>
                <td className="px-3 py-2 text-xs">{it.isMandatory ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${it.isActive ? 'bg-maroon-50 text-maroon-700' : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {it.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={() => handleReorder(it._id, 'up')}
                    className="text-xs text-slate-700 underline"
                  >
                    Up
                  </button>
                  <button
                    onClick={() => handleReorder(it._id, 'down')}
                    className="text-xs text-slate-700 underline"
                  >
                    Down
                  </button>
                  <button
                    onClick={() => toggleActive(it)}
                    className="text-xs text-slate-700 underline"
                  >
                    {it.isActive ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


