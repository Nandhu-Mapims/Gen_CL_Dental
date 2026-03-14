import { useEffect, useState, useMemo } from 'react'
import { apiClient } from '../../api/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function useDepartmentHierarchy(departments) {
  return useMemo(() => {
    const list = Array.isArray(departments) ? departments : []
    const topLevel = list.filter((d) => !d.parent)
    const childrenOf = {}
    list.filter((d) => d.parent).forEach((d) => {
      const pid = d.parent?._id ?? d.parent
      if (!pid) return
      const key = String(pid)
      if (!childrenOf[key]) childrenOf[key] = []
      childrenOf[key].push(d)
    })
    return { topLevel, childrenOf }
  }, [departments])
}

export function FormBuilderWithSections() {
  const [forms, setForms] = useState([])
  const [departments, setDepartments] = useState([])
  const { topLevel, childrenOf } = useDepartmentHierarchy(departments)
  const [selectedForm, setSelectedForm] = useState(null)
  const [checklistItems, setChecklistItems] = useState([])
  const [showFormModal, setShowFormModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editingForm, setEditingForm] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    departmentIds: [],
    isCommon: false,
    sections: [],
  })
  const [itemData, setItemData] = useState({
    label: '',
    section: '',
    departmentScope: 'SINGLE',
    departmentId: '',
    formTemplateId: '',
    responseType: 'YES_NO',
    responseOptions: '',
    isMandatory: false,
    order: 0,
  })
  const [sectionData, setSectionData] = useState({
    name: '',
    description: '',
    order: 0,
  })


  const loadData = async () => {
    const [formsData, deptsData] = await Promise.all([
      apiClient.get('/form-templates'),
      apiClient.get('/departments'),
    ])
    setForms(formsData)
    setDepartments(deptsData)
  }

  const loadChecklistItems = async () => {
    if (!selectedForm) return
    try {
      const items = await apiClient.get(
        `/checklists/department/${selectedForm.departments[0]?._id || ''}?formTemplateId=${selectedForm._id}`
      )
      setChecklistItems(items)
    } catch (err) {
      console.error('Error loading checklist items', err)
      setChecklistItems([])
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  useEffect(() => {
    if (selectedForm) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadChecklistItems()
    }
  }, [selectedForm])

  const handleCreateForm = async (e) => {
    e.preventDefault()
    try {
      await apiClient.post('/form-templates', formData)
      setShowFormModal(false)
      setFormData({
        name: '',
        description: '',
        departmentIds: [],
        isCommon: false,
        sections: [],
      })
      loadData()
    } catch (err) {
      alert('Error creating form')
      console.error(err)
    }
  }

  const handleEdit = (form) => {
    setEditingForm(form)
    setFormData({
      name: form.name,
      description: form.description || '',
      departmentIds: form.departments?.map((d) => (typeof d === 'object' ? d._id : d)) || [],
      isCommon: form.isCommon || false,
      sections: form.sections || [],
    })
    setShowFormModal(true)
  }

  const handleUpdateForm = async (e) => {
    e.preventDefault()
    try {
      await apiClient.put(`/form-templates/${editingForm._id}`, formData)
      setShowFormModal(false)
      setEditingForm(null)
      setFormData({
        name: '',
        description: '',
        departmentIds: [],
        isCommon: false,
        sections: [],
      })
      loadData()
      if (selectedForm?._id === editingForm._id) {
        const updated = await apiClient.get(`/form-templates/${editingForm._id}`)
        setSelectedForm(updated)
      }
    } catch (err) {
      alert('Error updating form')
      console.error(err)
    }
  }

  const handleAddSection = async (e) => {
    e.preventDefault()
    if (!selectedForm) return
    try {
      const updatedSections = [...(selectedForm.sections || []), sectionData]
      await apiClient.put(`/form-templates/${selectedForm._id}`, {
        ...selectedForm,
        sections: updatedSections,
      })
      setShowSectionModal(false)
      setSectionData({ name: '', description: '', order: 0 })
      loadData()
      const updated = await apiClient.get(`/form-templates/${selectedForm._id}`)
      setSelectedForm(updated)
    } catch (err) {
      alert('Error adding section')
      console.error(err)
    }
  }

  const handleCreateItem = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...itemData,
        formTemplateId: selectedForm._id,
      }
      // Only include responseOptions if responseType is MULTI_SELECT and options are provided
      if (payload.responseType !== 'MULTI_SELECT' || !payload.responseOptions || !payload.responseOptions.trim()) {
        delete payload.responseOptions
      } else {
        payload.responseOptions = payload.responseOptions.trim()
      }
      await apiClient.post('/checklists', payload)
      setShowItemModal(false)
      setItemData({
        label: '',
        section: '',
        departmentScope: 'SINGLE',
        departmentId: '',
        formTemplateId: '',
        responseType: 'YES_NO',
        responseOptions: '',
        isMandatory: false,
        order: 0,
      })
      loadChecklistItems()
    } catch (err) {
      alert('Error creating checklist item')
      console.error(err)
    }
  }

  const handleEditItem = (item) => {
    setEditingItem(item)
    setItemData({
      label: item.label,
      section: item.section || '',
      departmentScope: item.departmentScope,
      departmentId: item.department?._id || '',
      formTemplateId: item.formTemplate?._id || '',
      responseType: item.responseType || 'YES_NO',
      responseOptions: item.responseOptions || '',
      isMandatory: item.isMandatory,
      order: item.order,
    })
    setShowItemModal(true)
  }

  const handleUpdateItem = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...itemData,
        formTemplateId: selectedForm._id,
      }
      // Only include responseOptions if responseType is MULTI_SELECT and options are provided
      if (payload.responseType !== 'MULTI_SELECT' || !payload.responseOptions || !payload.responseOptions.trim()) {
        delete payload.responseOptions
      } else {
        payload.responseOptions = payload.responseOptions.trim()
      }
      await apiClient.put(`/checklists/${editingItem._id}`, payload)
      setShowItemModal(false)
      setEditingItem(null)
      setItemData({
        label: '',
        section: '',
        departmentScope: 'SINGLE',
        departmentId: '',
        formTemplateId: '',
        responseType: 'YES_NO',
        responseOptions: '',
        isMandatory: false,
        order: 0,
      })
      loadChecklistItems()
    } catch (err) {
      alert('Error updating checklist item')
      console.error(err)
    }
  }

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this checklist item?')) return
    try {
      await apiClient.delete(`/checklists/${id}`)
      loadChecklistItems()
    } catch {
      alert('Error deleting item')
    }
  }

  // Group items by section
  const itemsBySection = checklistItems.reduce((acc, item) => {
    const section = item.section || 'Other'
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Form Builder with Sections</h2>
          <p className="text-slate-600 mt-1">
            Create forms with sections and add checklist items to each section
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingForm(null)
            setFormData({
              name: '',
              description: '',
              departmentIds: [],
              isCommon: false,
              sections: [],
            })
            setShowFormModal(true)
            setSelectedForm(null)
          }}
          className="bg-maroon-600 hover:bg-maroon-700 text-white"
        >
          + Create New Form
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-maroon-50 border-l-4 border-maroon-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-maroon-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-maroon-900 mb-1">📋 Form-to-Department Assignment</h3>
            <p className="text-sm text-maroon-800">
              <strong>Important:</strong> Forms must be assigned to at least one department to be visible to users.
              You can assign a form to multiple departments if it's relevant to them.
              Use the <strong>"Assigned Departments"</strong> section below to manage assignments.
            </p>
            <p className="text-xs text-maroon-700 mt-2 italic">
              💡 Tip: Assign departments during form creation, or use the quick assign dropdown after selecting a form.
            </p>
          </div>
        </div>
      </div>

      {/* Form Selection */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select Form to Edit:
        </label>
        <select
          value={selectedForm?._id || ''}
          onChange={(e) => {
            const form = forms.find((f) => f._id === e.target.value)
            setSelectedForm(form)
          }}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-maroon-500"
        >
          <option value="">-- Select a form --</option>
          {forms.map((form) => (
            <option key={form._id} value={form._id}>
              {form.name} {form.isCommon ? '(Common)' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedForm && (
        <div className="space-y-4">
          {/* Form Info */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">{selectedForm.name}</h3>
                <p className="text-sm text-slate-600">{selectedForm.description}</p>
              </div>
              <button
                onClick={() => {
                  const form = forms.find((f) => f._id === selectedForm._id)
                  if (form) {
                    handleEdit(form)
                  }
                }}
                className="text-sm text-maroon-600 hover:text-maroon-700 px-3 py-1.5 rounded hover:bg-maroon-50"
              >
                Edit Form Details
              </button>
            </div>

            {/* Assigned Departments - Enhanced Section */}
            <div className="mb-3 p-4 bg-gradient-to-r from-maroon-50 to-maroon-50 rounded-lg border-2 border-maroon-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-maroon-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-800">Assigned Departments</span>
                  {selectedForm.departments && selectedForm.departments.length > 0 && (
                    <Badge className="px-2 py-0.5 bg-maroon-600 text-white text-xs font-medium rounded-full">
                      {selectedForm.departments.length} department{selectedForm.departments.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <select
                  onChange={async (e) => {
                    if (e.target.value) {
                      const form = forms.find((f) => f._id === selectedForm._id)
                      if (!form) return
                      const currentDepts = form.departments?.map((d) => (typeof d === 'object' ? d._id : d)) || []
                      if (!currentDepts.includes(e.target.value)) {
                        await apiClient.put(`/form-templates/${selectedForm._id}`, {
                          ...form,
                          departmentIds: [...currentDepts, e.target.value],
                        })
                        loadData()
                        const updated = await apiClient.get(`/form-templates/${selectedForm._id}`)
                        setSelectedForm(updated)
                      }
                      e.target.value = ''
                    }
                  }}
                  className="text-xs border-2 border-maroon-300 rounded-lg px-3 py-1.5 bg-white hover:border-maroon-400 focus:outline-none focus:ring-2 focus:ring-maroon-500 transition-colors font-medium"
                >
                  <option value="">➕ Quick Assign Department</option>
                  {departments
                    .filter((d) => {
                      const formDepts = selectedForm.departments?.map((d) => (typeof d === 'object' ? d._id : d)) || []
                      return d.code !== 'ANAE' && d.code !== 'NUS' && !formDepts.includes(d._id)
                    })
                    .map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                </select>
              </div>
              <div className="text-xs text-slate-600 mb-3 italic">
                💡 Users in assigned departments will see this form. You can assign to multiple departments.
              </div>
              {selectedForm.departments && selectedForm.departments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedForm.departments.map((dept) => {
                    const deptObj = typeof dept === 'object' ? dept : departments.find((d) => d._id === dept)
                    if (!deptObj) return null
                    return (
                      <Badge
                        key={deptObj._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-maroon-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-maroon-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {deptObj.name} ({deptObj.code})
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove "${deptObj.name}" from this form? Users in this department will lose access.`)) return
                            const form = forms.find((f) => f._id === selectedForm._id)
                            if (!form) return
                            const updatedDepts = form.departments
                              ?.map((d) => (typeof d === 'object' ? d._id : d))
                              .filter((id) => id !== deptObj._id) || []
                            await apiClient.put(`/form-templates/${selectedForm._id}`, {
                              ...form,
                              departmentIds: updatedDepts,
                            })
                            loadData()
                            const updated = await apiClient.get(`/form-templates/${selectedForm._id}`)
                            setSelectedForm(updated)
                          }}
                          className="ml-1 hover:text-red-200 transition-colors font-bold"
                          title="Remove from this department"
                        >
                          ×
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-yellow-800 font-medium">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>⚠️ No departments assigned - This form will not be visible to any users</span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1 ml-7">Assign at least one department using the dropdown above or edit form details.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowSectionModal(true)}
                className="bg-maroon-600 hover:bg-maroon-700 text-white"
              >
                + Add Section
              </Button>
            </div>
          </div>

          {/* Sections List — enable section to create items */}
          {selectedForm.sections && selectedForm.sections.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h4 className="font-semibold text-slate-800 mb-3">Form Sections (add items under a section)</h4>
              <div className="space-y-2">
                {selectedForm.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div>
                        <span className="font-medium text-slate-800">{section.name}</span>
                        {section.description && (
                          <span className="text-sm text-slate-600 ml-2">- {section.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">Order: {section.order}</span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setEditingItem(null)
                            setItemData({
                              label: '',
                              section: section.name,
                              responseType: 'YES_NO',
                              responseOptions: '',
                              departmentScope: 'SINGLE',
                              departmentId: selectedForm.departments?.[0]?._id || '',
                              formTemplateId: selectedForm._id,
                              isMandatory: false,
                              order: (itemsBySection[section.name]?.length ?? 0) + 1,
                            })
                            setShowItemModal(true)
                          }}
                          className="bg-maroon-600 hover:bg-maroon-700 text-white text-xs"
                        >
                          + Create item
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Checklist Items by Section */}
          <div className="space-y-4">
            {Object.keys(itemsBySection).length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-slate-500">
                No checklist items yet. Click "Add Checklist Item" to get started.
              </div>
            ) : (
              Object.keys(itemsBySection)
                .sort()
                .map((sectionName) => (
                  <div key={sectionName} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 text-white px-6 py-3">
                      <h4 className="font-semibold text-lg">{sectionName}</h4>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {itemsBySection[sectionName]
                        .sort((a, b) => a.order - b.order)
                        .map((item) => (
                          <div key={item._id} className="p-4 hover:bg-slate-50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-800">{item.label}</span>
                                  {item.isMandatory && (
                                    <span className="px-2 py-0.5 bg-maroon-100 text-maroon-700 text-xs rounded">
                                      Mandatory
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Scope: {item.departmentScope === 'ALL' ? 'All departments' : 'Single'}
                                  {item.departmentScope === 'SINGLE' && item.department && (
                                    <span> - {item.department.name}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleEditItem(item)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-maroon-600 hover:text-maroon-700"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleDeleteItem(item._id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingItem(null)
                          setItemData({
                            label: '',
                            section: sectionName,
                            responseType: 'YES_NO',
                            responseOptions: '',
                            departmentScope: 'SINGLE',
                            departmentId: selectedForm.departments?.[0]?._id || '',
                            formTemplateId: selectedForm._id,
                            isMandatory: false,
                            order: (itemsBySection[sectionName]?.length ?? 0) + 1,
                          })
                          setShowItemModal(true)
                        }}
                        className="w-full text-maroon-700 border-maroon-200 hover:bg-maroon-50"
                      >
                        + Add item to this section
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Add Item Button */}
          <Button
            onClick={() => {
              setEditingItem(null)
              setItemData({
                label: '',
                section: '',
                responseType: 'YES_NO',
                responseOptions: '',
                departmentScope: 'SINGLE',
                departmentId: selectedForm.departments[0]?._id || '',
                formTemplateId: selectedForm._id,
                isMandatory: false,
                order: checklistItems.length + 1,
              })
              setShowItemModal(true)
            }}
            className="w-full bg-maroon-600 hover:bg-maroon-700 text-white"
          >
            + Add Checklist Item to Form
          </Button>
        </div>
      )
      }

      {/* Create Form Modal */}
      {
        showFormModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingForm ? 'Edit Form' : 'Create New Form'}
              </h3>
              <form onSubmit={editingForm ? handleUpdateForm : handleCreateForm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Form Name *</label>
                  <Input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., MAPIMS - Case Sheet Audit Checklist"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    rows="3"
                  />
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-slate-800">
                      📋 Assign to Departments *
                    </label>
                    <span className="text-xs text-slate-600 bg-maroon-50 px-2 py-1 rounded border border-maroon-200">
                      {formData.departmentIds.length} selected
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-3 italic">
                    💡 Select one or more departments. Users in these departments will have access to this form.
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border-2 border-slate-300 rounded-lg p-4 bg-white">
                    {departments
                      .filter((d) => d.isActive !== false)
                      .map((dept) => (
                        <label
                          key={dept._id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${formData.departmentIds.includes(dept._id)
                            ? 'bg-maroon-50 border-2 border-maroon-300'
                            : 'hover:bg-slate-50 border-2 border-transparent'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.departmentIds.includes(dept._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  departmentIds: [...formData.departmentIds, dept._id],
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  departmentIds: formData.departmentIds.filter((id) => id !== dept._id),
                                })
                              }
                            }}
                            className="w-4 h-4 text-maroon-600 border-slate-300 rounded focus:ring-maroon-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-slate-800">{dept.name}</span>
                            <span className="text-xs text-slate-500 ml-1">({dept.code})</span>
                          </div>
                        </label>
                      ))}
                  </div>
                  {formData.departmentIds.length === 0 && (
                    <div className="mt-3 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-2">
                      <p className="text-xs text-yellow-800 font-medium">
                        ⚠️ Please select at least one department. Forms without assigned departments will not be visible to any users.
                      </p>
                    </div>
                  )}
                  {formData.departmentIds.length > 0 && (
                    <div className="mt-3 bg-green-50 border-2 border-green-200 rounded-lg p-2">
                      <p className="text-xs text-green-800 font-medium">
                        ✓ Form will be accessible to {formData.departmentIds.length} department{formData.departmentIds.length !== 1 ? 's' : ''}.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="bg-maroon-600 hover:bg-maroon-700 text-white"
                  >
                    {editingForm ? 'Update' : 'Create'} Form
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowFormModal(false)
                      setEditingForm(null)
                      setFormData({
                        name: '',
                        description: '',
                        departmentIds: [],
                        isCommon: false,
                        sections: [],
                      })
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Add Section Modal */}
      {
        showSectionModal && selectedForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Add Section to Form</h3>
              <form onSubmit={handleAddSection} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section Name *</label>
                  <Input
                    type="text"
                    required
                    value={sectionData.name}
                    onChange={(e) => setSectionData({ ...sectionData, name: e.target.value })}
                    placeholder="e.g., ADMISSION SLIP, CONSENT, OT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <Input
                    type="text"
                    value={sectionData.description}
                    onChange={(e) => setSectionData({ ...sectionData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order</label>
                  <Input
                    type="number"
                    value={sectionData.order}
                    onChange={(e) =>
                      setSectionData({ ...sectionData, order: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="bg-maroon-600 hover:bg-maroon-700 text-white"
                  >
                    Add Section
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowSectionModal(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Add/Edit Item Modal */}
      {
        showItemModal && selectedForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingItem ? 'Edit Checklist Item' : 'Add Checklist Item'}
              </h3>
              <form onSubmit={editingItem ? handleUpdateItem : handleCreateItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Label *</label>
                  <Input
                    type="text"
                    required
                    value={itemData.label}
                    onChange={(e) => setItemData({ ...itemData, label: e.target.value })}
                    placeholder="e.g., PATIENT NAME, DATE OF ADMISSION"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Section * (Select from form sections)
                  </label>
                  <select
                    required
                    value={itemData.section}
                    onChange={(e) => setItemData({ ...itemData, section: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="">-- Select Section --</option>
                    {selectedForm.sections
                      ?.sort((a, b) => a.order - b.order)
                      .map((section, idx) => (
                        <option key={idx} value={section.name}>
                          {section.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department Scope</label>
                  <select
                    value={itemData.departmentScope}
                    onChange={(e) => setItemData({ ...itemData, departmentScope: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="SINGLE">Single (overall or specific sub-department)</option>
                    <option value="ALL">All Departments (Common)</option>
                  </select>
                </div>
                {itemData.departmentScope === 'SINGLE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Department — Overall or specific sub-department
                    </label>
                    <select
                      value={itemData.departmentId}
                      onChange={(e) => setItemData({ ...itemData, departmentId: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
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
                                    └ {sub.name} ({sub.code}) — specific
                                  </option>
                                ))}
                            </optgroup>
                          )
                        })}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose <strong>overall</strong> for the whole department or <strong>specific</strong> sub-department (e.g. Ward Cleaning Unit).
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Response Type</label>
                  <select
                    value={itemData.responseType || 'YES_NO'}
                    onChange={(e) => setItemData({ ...itemData, responseType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="YES_NO">Yes, No, or N/A</option>
                    <option value="MULTI_SELECT">Multi Select - Options</option>
                    <option value="TEXT">Text Box</option>
                  </select>
                </div>
                {itemData.responseType === 'MULTI_SELECT' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Options (comma-separated) *
                    </label>
                    <Input
                      type="text"
                      required={itemData.responseType === 'MULTI_SELECT'}
                      value={itemData.responseOptions || ''}
                      onChange={(e) => setItemData({ ...itemData, responseOptions: e.target.value })}
                      placeholder="Option1, Option2, Option3"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isMandatory"
                    checked={itemData.isMandatory}
                    onChange={(e) => setItemData({ ...itemData, isMandatory: e.target.checked })}
                    className="w-4 h-4 text-maroon-600"
                  />
                  <label htmlFor="isMandatory" className="text-sm text-slate-700">
                    Mandatory
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order</label>
                  <Input
                    type="number"
                    value={itemData.order}
                    onChange={(e) =>
                      setItemData({ ...itemData, order: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="bg-maroon-600 hover:bg-maroon-700 text-white"
                  >
                    {editingItem ? 'Update' : 'Create'} Item
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowItemModal(false)
                      setEditingItem(null)
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  )
}

