import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

export function SimpleFormBuilder() {
  const [forms, setForms] = useState([])
  const [selectedForm, setSelectedForm] = useState(null)
  const [sections, setSections] = useState([
    { name: '', description: '', order: 1, items: [] },
  ])
  const [editingFormId, setEditingFormId] = useState(null)
  const [activeSection, setActiveSection] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    console.log('sections updated:', sections.map(s => ({
      name: s.name,
      items: s.items.map(i => ({ label: i.label, responseType: i.responseType }))
    })))
  }, [sections])

  const loadData = async () => {
    try {
      const [deptsData, formsData] = await Promise.all([
        apiClient.get('/departments'),
        apiClient.get('/form-templates'),
      ])
      // Show all active departments (isActive is true or undefined for new departments)
      // ANAE and NUS are now included - they can be used for common forms
      const activeDepts = deptsData.filter(
        (d) => d.isActive === true || d.isActive === undefined
      )
      console.log('Form Builder - Loaded departments:', {
        total: deptsData.length,
        active: activeDepts.length,
        filtered: deptsData.length - activeDepts.length,
        departments: deptsData.map(d => ({ name: d.name, code: d.code, isActive: d.isActive }))
      })
      setForms(formsData)
    } catch (err) {
      console.error('Error loading data:', err)
      alert('Error loading departments and forms. Please refresh the page.')
    }
  }

  const handleAddSection = () => {
    setSections([
      ...sections,
      { name: '', description: '', order: sections.length + 1, items: [] },
    ])
    setActiveSection(sections.length)
  }

  const handleRemoveSection = (index) => {
    if (sections.length > 1) {
      const newSections = sections.filter((_, i) => i !== index)
      newSections.forEach((sec, i) => {
        sec.order = i + 1
      })
      setSections(newSections)
      if (activeSection >= newSections.length) {
        setActiveSection(newSections.length - 1)
      }
    }
  }

  const handleUpdateSection = (index, field, value) => {
    const newSections = [...sections]
    newSections[index][field] = value
    setSections(newSections)
  }

  const handleAddItem = (sectionIndex) => {
    const newSections = [...sections]
    newSections[sectionIndex].items.push({
      label: '',
      responseType: 'YES_NO',
      responseOptions: '',
      isMandatory: false,
      order: newSections[sectionIndex].items.length + 1,
    })
    setSections(newSections)
  }

  const handleRemoveItem = (sectionIndex, itemIndex) => {
    const newSections = [...sections]
    newSections[sectionIndex].items = newSections[sectionIndex].items.filter(
      (_, i) => i !== itemIndex
    )
    newSections[sectionIndex].items.forEach((item, i) => {
      item.order = i + 1
    })
    setSections(newSections)
  }

  const handleUpdateItem = (sectionIndex, itemIndex, field, value) => {
    const newSections = [...sections]
    const item = newSections[sectionIndex].items[itemIndex]

    // Update the field
    item[field] = value

    // Clear responseOptions when responseType changes to something other than MULTI_SELECT
    if (field === 'responseType') {
      if (value !== 'MULTI_SELECT') {
        item.responseOptions = ''
      } else if (!item.responseOptions) {
        // Initialize empty string for MULTI_SELECT if not set
        item.responseOptions = ''
      }
    }

    console.log(`Updated item ${itemIndex} in section ${sectionIndex}:`, { field, value, item })
    setSections(newSections)
  }

  const handleLoadForm = async (formId) => {
    try {
      // First, try to find form in the list, but also fetch it individually to ensure we have latest data
      let form = forms.find((f) => f._id === formId)

      // Fetch the form individually to ensure we have the latest data including sections
      try {
        const fetchedForm = await apiClient.get(`/form-templates/${formId}`)
        if (fetchedForm) {
          form = fetchedForm
        }
      } catch (fetchErr) {
        console.warn('Could not fetch individual form, using cached version:', fetchErr)
        // If individual fetch fails, use the form from the list
      }

      if (!form) {
        alert('Form not found. Please refresh the page and try again.')
        return
      }

      console.log('Loading form:', {
        id: form._id,
        name: form.name,
        sectionsCount: form.sections?.length || 0,
        sections: form.sections
      })

      setSelectedForm(form)
      setEditingFormId(formId)

      // Get department ID - handle both object and string formats
      const departmentId = form.departments && form.departments.length > 0
        ? (typeof form.departments[0] === 'object' ? form.departments[0]._id : form.departments[0])
        : ''

      let items = []
      if (departmentId) {
        try {
          items = await apiClient.get(
            `/checklists/department/${departmentId}?formTemplateId=${formId}`
          )
          console.log('Loaded items for department:', { departmentId, itemsCount: items?.length || 0 })
        } catch (err) {
          console.warn('Error loading checklist items:', err)
          // If items can't be loaded, continue with empty items array
          items = []
        }
      } else {
        // Try to get items without department filter if form has no departments
        try {
          items = await apiClient.get(`/checklists?formTemplateId=${formId}`)
          console.log('Loaded items without department filter:', { itemsCount: items?.length || 0 })
        } catch (err) {
          console.warn('Error loading checklist items:', err)
          items = []
        }
      }

      // Group items by section name
      const itemsBySection = {}
      if (items && Array.isArray(items)) {
        items.forEach((item) => {
          const sectionName = item.section || 'Other'
          if (!itemsBySection[sectionName]) {
            itemsBySection[sectionName] = []
          }
          itemsBySection[sectionName].push(item)
        })
        // Sort items within each section by order
        Object.keys(itemsBySection).forEach((sectionName) => {
          itemsBySection[sectionName].sort((a, b) => (a.order || 0) - (b.order || 0))
        })
      }

      const loadedSections = []

      // If form has sections defined, use them (even if they have no items yet)
      if (form.sections && form.sections.length > 0) {
        form.sections
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .forEach((section) => {
            const sectionItems = (itemsBySection[section.name] || [])
              .map((item) => ({
                id: item._id,
                label: item.label,
                responseType: item.responseType || 'YES_NO', // Ensure responseType is set
                responseOptions: (item.responseType === 'MULTI_SELECT' ? (item.responseOptions || '') : ''),
                isMandatory: item.isMandatory || false,
                order: item.order || 0,
              }))
              .sort((a, b) => (a.order || 0) - (b.order || 0))

            loadedSections.push({
              name: section.name,
              description: section.description || '',
              order: section.order || loadedSections.length + 1,
              items: sectionItems,
            })
          })

        // Also add any sections that exist in items but not in form.sections
        Object.keys(itemsBySection).forEach((sectionName) => {
          const existsInForm = form.sections.some(s => s.name === sectionName)
          if (!existsInForm) {
            loadedSections.push({
              name: sectionName,
              description: '',
              order: loadedSections.length + 1,
              items: itemsBySection[sectionName]
                .map((item) => ({
                  id: item._id,
                  label: item.label,
                  responseType: item.responseType || 'YES_NO',
                  responseOptions: item.responseOptions || '',
                  isMandatory: item.isMandatory,
                  order: item.order || 0,
                }))
                .sort((a, b) => (a.order || 0) - (b.order || 0)),
            })
          }
        })
      } else {
        // If form has no sections defined, create sections from items
        Object.keys(itemsBySection).forEach((sectionName, idx) => {
          loadedSections.push({
            name: sectionName,
            description: '',
            order: idx + 1,
            items: itemsBySection[sectionName]
              .map((item) => ({
                id: item._id,
                label: item.label,
                responseType: item.responseType || 'YES_NO',
                responseOptions: item.responseOptions || '',
                isMandatory: item.isMandatory,
                order: item.order || 0,
              }))
              .sort((a, b) => (a.order || 0) - (b.order || 0)),
          })
        })
      }

      console.log('Loaded sections:', {
        count: loadedSections.length,
        sections: loadedSections.map(s => ({
          name: s.name,
          itemsCount: s.items.length
        }))
      })

      if (loadedSections.length === 0) {
        setSections([{ name: '', description: '', order: 1, items: [] }])
      } else {
        setSections(loadedSections)
      }
      setActiveSection(0)
    } catch (err) {
      console.error('Error loading form:', err)
      alert('Error loading form data: ' + (err.response?.data?.message || err.message || 'Unknown error'))
      // Reset to empty state on error
      setSections([{ name: '', description: '', order: 1, items: [] }])
      setActiveSection(0)
    }
  }

  const handleSaveForm = async () => {
    if (!editingFormId) {
      alert('Please select a form from the dropdown above to build sections and items. Create forms in the Forms menu.')
      return
    }

    // Validate sections and items
    for (const section of sections) {
      if (!section.name.trim()) {
        alert(`Please enter a name for section ${section.order}`)
        return
      }
      for (const item of section.items) {
        if (!item.label.trim()) {
          alert(`Please enter a label for all items in section "${section.name}"`)
          return
        }
        // Validate MULTI_SELECT has options
        if (item.responseType === 'MULTI_SELECT' && (!item.responseOptions || !item.responseOptions.trim())) {
          alert(`Please provide options for Multi Select item "${item.label}" in section "${section.name}"`)
          return
        }
        // Ensure responseType is valid
        const validTypes = ['YES_NO', 'MULTI_SELECT', 'TEXT']
        if (item.responseType && !validTypes.includes(item.responseType)) {
          alert(`Invalid response type for item "${item.label}" in section "${section.name}". Must be one of: ${validTypes.join(', ')}`)
          return
        }
      }
    }

    try {
      const sectionsData = sections.map((sec) => ({
        name: sec.name,
        description: sec.description,
        order: sec.order,
      }))
      console.log('sectionsData===================', sections, sectionsData)

      let formTemplateId

      const form = forms.find((f) => f._id === editingFormId)
      if (!form) {
        alert('Form not found. Please select a valid form.')
        return
      }

      const formDepts = form.departments?.map((d) => (typeof d === 'object' ? d._id : d)) || []

      // Warn if form has no departments assigned
      if (formDepts.length === 0 && !form.isCommon) {
        const confirmSave = confirm(
          'Warning: This form has no departments assigned. Items will not be created for any department. ' +
          'Do you want to continue? You can assign departments in the Forms management page.'
        )
        if (!confirmSave) {
          return
        }
      }

      console.log('Updating form template:', editingFormId, {
        name: form.name,
        description: form.description || '',
        departmentIds: formDepts,
        sections: sectionsData,
        isCommon: form.isCommon || false,
        isActive: form.isActive !== undefined ? form.isActive : true,
      })

      await apiClient.put(`/form-templates/${editingFormId}`, {
        name: form.name,
        description: form.description || '',
        departmentIds: formDepts,
        sections: sectionsData,
        isCommon: form.isCommon || false,
        isActive: form.isActive !== undefined ? form.isActive : true,
      })

      console.log('Form template updated successfully')
      formTemplateId = editingFormId

      // Get ALL existing items for this form template to delete them before recreating
      let oldItems = []

      if (form.isCommon) {
        // For common forms, get items from any department (they should have ALL scope)
        // Try to get items from the first available department, or use a generic query
        try {
          const allDepts = await apiClient.get('/departments')
          if (allDepts && allDepts.length > 0) {
            const firstDeptId = allDepts[0]._id
            const deptItems = await apiClient.get(
              `/checklists/department/${firstDeptId}?formTemplateId=${editingFormId}`
            )
            if (Array.isArray(deptItems)) {
              oldItems = deptItems
            }
          }
        } catch (err) {
          console.warn(`Error loading old items for common form:`, err)
        }
      } else if (formDepts.length > 0) {
        // For non-common forms, collect items from all assigned departments
        const allOldItems = []
        for (const deptId of formDepts) {
          try {
            const deptItems = await apiClient.get(
              `/checklists/department/${deptId}?formTemplateId=${editingFormId}`
            )
            if (Array.isArray(deptItems)) {
              allOldItems.push(...deptItems)
            }
          } catch (err) {
            console.warn(`Error loading old items for department ${deptId}:`, err)
          }
        }
        // Remove duplicates (same item might be in multiple departments, but we only need to delete once)
        const uniqueItems = new Map()
        allOldItems.forEach(item => {
          if (!uniqueItems.has(item._id)) {
            uniqueItems.set(item._id, item)
          }
        })
        oldItems = Array.from(uniqueItems.values())
      }

      console.log(`Found ${oldItems.length} unique items to delete for form template ${editingFormId}`)

      // Delete all old items
      for (const item of oldItems) {
        try {
          const itemId = item._id || item.id
          if (itemId) {
            await apiClient.delete(`/checklists/${itemId}`)
          }
        } catch (err) {
          const itemId = item._id || item.id
          console.warn(`Error deleting item ${itemId}:`, err)
        }
      }

      // Create all items (since we deleted all old ones, we recreate everything)
      if (formDepts.length === 0 && !form.isCommon) {
        alert('Warning: No departments assigned to this form. Items cannot be created. Please assign at least one department in the Forms management page.')
        return
      }

      // If form is common, create items with ALL scope (no specific department)
      if (form.isCommon) {
        for (const section of sections) {
          for (const item of section.items) {
            // Ensure responseType is valid
            const responseType = (item.responseType && ['YES_NO', 'MULTI_SELECT', 'TEXT'].includes(item.responseType))
              ? item.responseType
              : 'YES_NO'

            let payload = {
              label: item.label,
              section: section.name,
              departmentScope: 'ALL',
              departmentId: undefined,
              formTemplateId: formTemplateId,
              responseType: responseType,
              isActive: true,
              order: item.order || 0,
              isMandatory: item.isMandatory || false,
            }
            // Only include responseOptions if responseType is MULTI_SELECT and options are provided
            if (responseType === 'MULTI_SELECT' && item.responseOptions && item.responseOptions.trim()) {
              payload.responseOptions = item.responseOptions.trim()
            }

            console.log(`Creating item "${item.label}" with responseType: ${responseType}`, { item, payload })
            try {
              await apiClient.post('/checklists', payload)
            } catch (err) {
              console.error(`Error creating item "${item.label}":`, err)
              console.error('Payload sent:', payload)
              console.error('Error response:', err.response?.data)
              throw err // Re-throw to stop the process
            }
          }
        }
      } else {
        // For non-common forms, create items for each assigned department
        for (const deptId of formDepts) {
          for (const section of sections) {
            for (const item of section.items) {
              // Ensure responseType is valid
              const responseType = (item.responseType && ['YES_NO', 'MULTI_SELECT', 'TEXT'].includes(item.responseType))
                ? item.responseType
                : 'YES_NO'

              let payload = {
                label: item.label,
                section: section.name,
                departmentScope: 'SINGLE',
                departmentId: deptId,
                formTemplateId: formTemplateId,
                responseType: responseType,
                isActive: true,
                order: item.order || 0,
                isMandatory: item.isMandatory || false,
              }
              // Only include responseOptions if responseType is MULTI_SELECT and options are provided
              if (responseType === 'MULTI_SELECT' && item.responseOptions && item.responseOptions.trim()) {
                payload.responseOptions = item.responseOptions.trim()
              }

              console.log(`Creating item "${item.label}" for dept ${deptId} with responseType: ${responseType}`, { item, payload })
              try {
                await apiClient.post('/checklists', payload)
              } catch (err) {
                console.error(`Error creating item "${item.label}" for department ${deptId}:`, err)
                console.error('Payload sent:', payload)
                console.error('Error response:', err.response?.data)
                throw err // Re-throw to stop the process
              }
            }
          }
        }
      }

      alert('Form sections and items updated successfully!')

      setSections([{ name: '', description: '', order: 1, items: [] }])
      setEditingFormId(null)
      setSelectedForm(null)
      setActiveSection(0)

      loadData()
    } catch (err) {
      console.error('Full error object:', err)
      console.error('Error response:', err.response)
      console.error('Error response data:', err.response?.data)
      console.error('Error response status:', err.response?.status)

      const status = err.response?.status
      const data = err.response?.data

      // 403 = insufficient role — show clear admin-login guidance
      if (status === 403) {
        const msg = data?.message || 'Admin access required.'
        alert(
          `Error saving form: ${msg}\n\n` +
          'Saving checklists requires an admin account. Log in as admin (e.g. admin@example.com) or log out and log in again to refresh your session.'
        )
        return
      }

      // Build comprehensive error message for other errors
      let errorMessage = 'Unknown error'
      let errorDetails = ''

      if (data) {
        errorMessage = data.error || data.message || data.msg || 'Server error'
        if (data.validationErrors) {
          errorDetails = `\n\nValidation errors:\n${JSON.stringify(data.validationErrors, null, 2)}`
        }
        if (data.stack && import.meta.env?.DEV) {
          errorDetails += `\n\nStack trace:\n${data.stack}`
        }
        if (data.requestBody) {
          errorDetails += `\n\nRequest body:\n${JSON.stringify(data.requestBody, null, 2)}`
        }
      } else if (err.message) {
        errorMessage = err.message
      }

      const fullError = `Error saving form: ${errorMessage}${errorDetails}`
      console.error('Displaying error to user:', fullError)
      alert(fullError)
    }
  }

  const handleNewForm = () => {
    setSections([{ name: '', description: '', order: 1, items: [] }])
    setEditingFormId(null)
    setSelectedForm(null)
    setActiveSection(0)
  }


  const totalItems = sections.reduce((sum, sec) => sum + sec.items.length, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-900 mb-1 sm:mb-2">
                Form Builder
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-slate-600">Build sections and checklist items for existing forms</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <select
                value={selectedForm?._id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const form = forms.find((f) => f._id === e.target.value)
                    setSelectedForm(form)
                    handleLoadForm(e.target.value)
                  } else {
                    handleNewForm()
                  }
                }}
                className="px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white text-slate-800 shadow-sm hover:border-slate-400 transition-all"
              >
                <option value="">-- Select a form to build --</option>
                {forms.map((form) => (
                  <option key={form._id} value={form._id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Sections Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          {/* Sections Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 border border-maroon-200/50 lg:sticky lg:top-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Sections</h3>
                <button
                  onClick={handleAddSection}
                  className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white rounded-lg flex items-center justify-center text-base sm:text-lg font-bold transition-all shadow-sm"
                >
                  +
                </button>
              </div>
              <div className="space-y-1.5 sm:space-y-2 max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
                {sections.map((section, index) => (
                  <div
                    key={index}
                    onClick={() => setActiveSection(index)}
                    className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-all ${activeSection === index
                        ? 'bg-gradient-to-r from-maroon-600 to-maroon-600 text-white shadow-lg shadow-maroon-500/50'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-transparent hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate">
                          {section.name || `Section ${index + 1}`}
                        </div>
                        <div
                          className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${activeSection === index ? 'text-maroon-100' : 'text-slate-500'
                            }`}
                        >
                          {section.items.length} item{section.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {sections.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveSection(index)
                          }}
                          className="ml-2 text-maroon-500 hover:text-maroon-700 text-base sm:text-lg flex-shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-200">
                <div className="text-[10px] sm:text-xs text-slate-600 space-y-0.5 sm:space-y-1">
                  <div className="flex justify-between">
                    <span>Total Sections:</span>
                    <span className="font-semibold">{sections.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span className="font-semibold">{totalItems}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {sections.length > 0 && sections[activeSection] && (
              <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-maroon-200/50">
                {/* Section Header */}
                <div className="mb-4 sm:mb-5 md:mb-6 pb-3 sm:pb-4 border-b-2 border-maroon-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">
                        Section Name *
                      </label>
                      <input
                        type="text"
                        value={sections[activeSection].name}
                        onChange={(e) =>
                          handleUpdateSection(activeSection, 'name', e.target.value)
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all bg-white font-medium"
                        placeholder="e.g., ADMISSION SLIP, CONSENT"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 sm:mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={sections[activeSection].description}
                        onChange={(e) =>
                          handleUpdateSection(activeSection, 'description', e.target.value)
                        }
                        className="w-full border-2 border-slate-300 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all bg-white"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-slate-800">Checklist Items</h3>
                    <button
                      onClick={() => handleAddItem(activeSection)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <span className="text-base sm:text-lg">+</span> Add Item
                    </button>
                  </div>

                  {sections[activeSection].items.length === 0 ? (
                    <div className="text-center py-8 sm:py-10 md:py-12 bg-slate-50 rounded-lg sm:rounded-xl border-2 border-dashed border-slate-300">
                      <div className="text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3">📝</div>
                      <p className="text-xs sm:text-sm md:text-base text-slate-600 font-medium">No items yet</p>
                      <p className="text-[10px] sm:text-xs md:text-sm text-slate-500 mt-1">
                        Click "Add Item" to create checklist items
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {sections[activeSection].items.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="p-3 sm:p-4 bg-white/95 backdrop-blur-md rounded-xl border border-maroon-200/50 hover:border-slate-300 transition-all shadow-sm"
                        >
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-maroon-50 text-maroon-700 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm">
                                  {itemIndex + 1}
                                </div>
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={(e) =>
                                    handleUpdateItem(activeSection, itemIndex, 'label', e.target.value)
                                  }
                                  className="flex-1 min-w-0 border border-slate-300 rounded-lg px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all bg-white font-medium text-slate-800"
                                  placeholder="Enter checklist item label..."
                                  required
                                />
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start">
                                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.isMandatory}
                                    onChange={(e) =>
                                      handleUpdateItem(
                                        activeSection,
                                        itemIndex,
                                        'isMandatory',
                                        e.target.checked
                                      )
                                    }
                                    className="w-4 h-4 sm:w-5 sm:h-5 text-maroon-600 border-slate-300 rounded focus:ring-maroon-500"
                                  />
                                  <span className="text-xs sm:text-sm font-medium text-slate-700">
                                    Mandatory
                                  </span>
                                </label>
                                <button
                                  onClick={() => handleRemoveItem(activeSection, itemIndex)}
                                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-maroon-600 hover:text-maroon-700 hover:bg-maroon-50 rounded-lg transition-all text-lg sm:text-xl"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                            {/* Response Type Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                              <div>
                                <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1">
                                  Response Type
                                </label>
                                <select
                                  value={item.responseType || 'YES_NO'}
                                  onChange={(e) => {
                                    const newValue = e.target.value
                                    console.log(`Changing responseType from ${item.responseType} to ${newValue} for item:`, item.label)
                                    handleUpdateItem(activeSection, itemIndex, 'responseType', newValue)
                                  }}
                                  className="w-full border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white"
                                >
                                  <option value="YES_NO">Yes or No</option>
                                  <option value="MULTI_SELECT">Multi Select - Options</option>
                                  <option value="TEXT">Text Box</option>
                                </select>
                              </div>
                              {(item.responseType === 'MULTI_SELECT') && (
                                <div>
                                  <label className="block text-[10px] sm:text-xs font-medium text-slate-700 mb-1">
                                    Options (comma-separated) *
                                  </label>
                                  <input
                                    type="text"
                                    value={item.responseOptions || ''}
                                    onChange={(e) =>
                                      handleUpdateItem(activeSection, itemIndex, 'responseOptions', e.target.value)
                                    }
                                    className="w-full border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white"
                                    placeholder="Option1, Option2, Option3"
                                    required={item.responseType === 'MULTI_SELECT'}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 sm:p-5 md:p-6 border border-maroon-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{sections.length}</span> sections •{' '}
              <span className="font-semibold text-slate-800">{totalItems}</span> items
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={handleNewForm}
                className="px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs sm:text-sm font-medium transition-all shadow-sm"
              >
                Clear All
              </button>
              <button
                onClick={handleSaveForm}
                className="px-6 sm:px-7 md:px-8 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white rounded-lg text-xs sm:text-sm md:text-base font-semibold transition-all shadow-sm"
              >
                Save Sections & Items
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
