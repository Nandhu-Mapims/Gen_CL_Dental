import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { SIGNATURE_CANVAS_STYLE } from '../../constants/signatureCanvas'

const DRAFT_KEY_PREFIX = 'form_draft_'

export function Form() {
  const { formTemplateId } = useParams()
  const { user } = useAuth()
  const [formTemplate, setFormTemplate] = useState(null)
  const [department, setDepartment] = useState(null)
  const [departmentId, setDepartmentId] = useState('')
  const [departmentsList, setDepartmentsList] = useState([])
  const [items, setItems] = useState([])
  const [answers, setAnswers] = useState({})
  const [selectedSections, setSelectedSections] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [locationType, setLocationType] = useState('')
  const [locationId, setLocationId] = useState('')
  const [location, setLocation] = useState('')
  const [assetId, setAssetId] = useState('')
  const [asset, setAsset] = useState('')
  const [locationsList, setLocationsList] = useState([])
  // eslint-disable-next-line no-unused-vars
  const [assetsList, setAssetsList] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [submittedContext, setSubmittedContext] = useState(null)
  const [showRestoreDraftModal, setShowRestoreDraftModal] = useState(false)
  const [draftToRestore, setDraftToRestore] = useState(null)
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState(null)
  const [patientUhid, setPatientUhid] = useState('')
  const [patientName, setPatientName] = useState('')

  const isClinicalForm = formTemplate?.formContext === 'CLINICAL'

  // Staff signature (per submission)
  const signatureCanvasRef = useRef(null)
  const isSignatureDrawingRef = useRef(false)
  const didDrawSignatureRef = useRef(false)
  const [signatureFile, setSignatureFile] = useState(null)
  const [signaturePreviewLocal, setSignaturePreviewLocal] = useState(null)
  const [signatureError, setSignatureError] = useState('')

  useEffect(() => {
    if (!signatureFile) {
      setSignaturePreviewLocal(null)
      return undefined
    }
    const u = URL.createObjectURL(signatureFile)
    setSignaturePreviewLocal(u)
    return () => URL.revokeObjectURL(u)
  }, [signatureFile])

  const initStaffSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssWidth = rect.width || 320
    const cssHeight = rect.height || 320
    if (cssWidth < 8 || cssHeight < 8) return

    const dpr = window.devicePixelRatio || 1

    canvas.width = Math.floor(cssWidth * dpr)
    canvas.height = Math.floor(cssHeight * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2.8

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    didDrawSignatureRef.current = false
  }, [])

  const getSignatureCanvasPoint = (e) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return {
      x: Math.max(0, Math.min(rect.width || 320, x)),
      y: Math.max(0, Math.min(rect.height || 320, y)),
    }
  }

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const cssWidth = rect.width || 320
    const cssHeight = rect.height || 320

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cssWidth, cssHeight)
    didDrawSignatureRef.current = false
    isSignatureDrawingRef.current = false
    setSignatureFile(null)
    setSignatureError('')
  }

  const handleSignaturePointerDown = (e) => {
    const canvas = signatureCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    e.preventDefault()

    isSignatureDrawingRef.current = true
    didDrawSignatureRef.current = true
    setSignatureFile(null)
    setSignatureError('')

    const { x, y } = getSignatureCanvasPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handleSignaturePointerMove = (e) => {
    if (!isSignatureDrawingRef.current) return
    const canvas = signatureCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    e.preventDefault()

    const { x, y } = getSignatureCanvasPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const handleSignaturePointerUp = () => {
    isSignatureDrawingRef.current = false
  }

  const saveDrawnSignatureToFile = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    if (!didDrawSignatureRef.current) {
      setSignatureError('Please draw your signature first.')
      return
    }
    setSignatureError('')
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setSignatureError('Could not capture signature. Please try again.')
          return
        }
        if (blob.size > 2 * 1024 * 1024) {
          setSignatureError('Signature must be 2 MB or smaller. Please redraw smaller.')
          return
        }
        const file = new File([blob], 'staff-signature.jpg', { type: 'image/jpeg' })
        setSignatureFile(file)
      },
      'image/jpeg',
      0.9
    )
  }

  // Draft helpers
  const getDraftKey = useCallback(() => {
    const uid = user?.id || user?._id || 'anon'
    return `${DRAFT_KEY_PREFIX}${formTemplateId}_${uid}`
  }, [formTemplateId, user])

  const saveDraft = useCallback(() => {
    const key = getDraftKey()
    const draft = {
      departmentId,
      locationType,
      locationId,
      assetId,
      location,
      asset,
      answers,
      selectedSections,
      formTemplateId,
      formName: formTemplate?.name,
      patientUhid,
      patientName,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem(key, JSON.stringify(draft))
      setLastDraftSavedAt(new Date().toISOString())
    } catch (e) {
      console.warn('Failed to save draft:', e)
    }
  }, [getDraftKey, departmentId, locationType, locationId, assetId, location, asset, answers, selectedSections, formTemplateId, formTemplate?.name, patientUhid, patientName])

  const availableLocationTypes = useMemo(() => {
    const TYPE_ORDER = ['ZONE', 'FLOOR', 'WARD', 'UNIT', 'ROOM', 'OTHER']
    const typeSet = new Set(
      (Array.isArray(locationsList) ? locationsList : [])
        .map((l) => String(l?.locationType || 'OTHER').toUpperCase())
        .filter(Boolean)
    )
    return TYPE_ORDER.filter((t) => typeSet.has(t))
  }, [locationsList])

  // If a draft restored locationId exists, backfill locationType from DB list
  useEffect(() => {
    if (locationType) return
    if (!locationId) return
    const loc = (Array.isArray(locationsList) ? locationsList : []).find((x) => (x._id?.toString?.() || String(x._id)) === String(locationId))
    if (!loc) return
    const t = String(loc.locationType || 'OTHER').toUpperCase()
    if (t) setLocationType(t)
  }, [locationId, locationType, locationsList])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(getDraftKey())
    } catch (e) {
      console.warn('Failed to clear draft:', e)
    }
  }, [getDraftKey])

  const hasUnsavedChanges =
    departmentId ||
    (!isClinicalForm && (locationId || location.trim() || assetId || asset.trim())) ||
    (isClinicalForm && (patientUhid.trim() || patientName.trim())) ||
    selectedSections.length !== new Set(items.map((it) => it.section || 'Other')).size ||
    Object.values(answers).some(
      (a) =>
        (a?.yesNoNa && String(a.yesNoNa).trim()) ||
        (a?.responseValue && String(a.responseValue).trim()) ||
        (a?.remarks && String(a.remarks).trim())
    )

  // Auto-save draft (debounced) for every form/field change so local draft is always up to date
  useEffect(() => {
    if (!formTemplateId || !getDraftKey() || showRestoreDraftModal) return
    if (!hasUnsavedChanges || items.length === 0) return

    const timeoutId = setTimeout(() => {
      saveDraft()
    }, 800)

    return () => clearTimeout(timeoutId)
  }, [formTemplateId, hasUnsavedChanges, items.length, showRestoreDraftModal, departmentId, locationId, assetId, location, asset, answers, getDraftKey, saveDraft])

  // Clear "Draft saved" indicator after 2.5s
  useEffect(() => {
    if (!lastDraftSavedAt) return
    const t = setTimeout(() => setLastDraftSavedAt(null), 2500)
    return () => clearTimeout(t)
  }, [lastDraftSavedAt])

  // beforeunload for refresh/close (in-app navigation is not blocked; use data router + useBlocker if needed)
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // Audit date/time are set on the backend only (auto-fetched on submit). General checklist: no UHID/IPID.

  useEffect(() => {
    ; (async () => {
      if (!formTemplateId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError(null)
      setMessage('')

      try {
        console.log('Loading form template: meow meow meow', formTemplateId)

        const form = await apiClient.get(`/form-templates/${formTemplateId}`)
        setFormTemplate(form)
        setPatientUhid('')
        setPatientName('')

        try {
          const list = await apiClient.get('/auth/users/supervisors')
          setSupervisors(Array.isArray(list) ? list : [])
        } catch {
          setSupervisors([])
        }

        if ((user?.role === 'SUPERVISOR' || user?.role === 'DEPT_ADMIN') && form) {
          // Get user's department
          let userDeptId = null
          if (user?.department) {
            userDeptId = typeof user.department === 'object'
              ? (user.department.id || user.department._id)
              : user.department
          }

          // Check if form is assigned to chief's department
          if (userDeptId && form.departments) {
            const formDeptIds = form.departments.map(d =>
              typeof d === 'object' ? (d._id?.toString() || d.id?.toString()) : d.toString()
            )
            const userDeptIdStr = userDeptId.toString()

            if (!formDeptIds.includes(userDeptIdStr)) {
              // Form is not assigned to chief's department
              const depts = await apiClient.get('/departments')
              const userDept = depts.find(d => d._id?.toString() === userDeptIdStr)
              const formDepts = depts.filter(d => formDeptIds.includes(d._id?.toString()))

              setLoadError(
                `This form is not assigned to your department (${userDept?.name || 'Unknown'}). ` +
                `It is currently assigned to: ${formDepts.map(d => d.name).join(', ') || 'No departments'}. ` +
                `Please contact your administrator to assign this form to your department, or select a form from the navigation menu that is available to you.`
              )
              setLoading(false)
              return
            }
          }
        }

        // Get user's department - handle both object and string formats
        let userDeptId = null
        if (user?.department) {
          userDeptId = typeof user.department === 'object'
            ? (user.department.id || user.department._id)
            : user.department
        }

        if (!userDeptId && user?.role === 'SUPER_ADMIN' && form.departments && form.departments.length > 0) {
          // Admin can use first department from form
          userDeptId = typeof form.departments[0] === 'object'
            ? (form.departments[0]._id || form.departments[0].id)
            : form.departments[0]
        }

        if (!userDeptId && ['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(user?.role)) {
          setLoadError('No department assigned. Please contact your administrator.')
          setLoading(false)
          return
        }

        const depts = await apiClient.get('/departments')
        const deptsActive = (depts || []).filter((d) => d.isActive !== false)
        const formDeptIds = (form.departments || []).map((d) =>
          (d && (d._id || d.id) ? String(d._id || d.id) : String(d))
        )
        const departmentOptions = formDeptIds.length
          ? deptsActive.filter((d) => formDeptIds.includes(String(d._id)))
          : deptsActive

        // Auto-select department based primarily on the form template:
        // - If the form has departments, pick the first one from that list.
        // - Otherwise, fall back to the first active department (if any).
        const initialDept = departmentOptions.length > 0 ? departmentOptions[0] : null

        setDepartmentsList(departmentOptions)
        setDepartment(initialDept)
        setDepartmentId(initialDept ? initialDept._id?.toString() || initialDept._id : '')
        try {
          if (form.formContext === 'CLINICAL') {
            setLocationsList([])
            setAssetsList([])
          } else {
            const [locations, assets] = await Promise.all([
              apiClient.get('/locations?selectable=true').catch(() => []),
              apiClient.get('/assets').catch(() => []),
            ])
            setLocationsList(Array.isArray(locations) ? locations : [])
            setAssetsList(Array.isArray(assets) ? assets : [])
          }
        } catch (err) {
          console.error(err)
          setLocationsList([])
          setAssetsList([])
        }

        // Load checklist items for this form template
        if (userDeptId) {
          try {
            console.log(`[DEBUG] Loading checklist items for department: ${userDeptId}, formTemplate: ${formTemplateId}`)
            const checklist = await apiClient.get(
              `/checklists/department/${userDeptId}?formTemplateId=${formTemplateId}`
            )
            console.log('[DEBUG] Checklist items response:', checklist)
            console.log('[DEBUG] Checklist items loaded:', checklist?.length || 0)

            if (!checklist || !Array.isArray(checklist)) {
              console.warn('[DEBUG] Invalid checklist response:', checklist)
              setItems([])
              setAnswers({})
              setMessage('Warning: Invalid response from server. Please check backend logs.')
              return
            }

            setItems(checklist || [])
            const sectionsFromItems = Array.from(new Set((checklist || []).map((it) => it.section || 'Other')))
            setSelectedSections(sectionsFromItems)

            // Initialize answers - all empty, no defaults
            const init = {}
            if (checklist && Array.isArray(checklist) && checklist.length > 0) {
              checklist.forEach((it) => {
                init[it._id] = {
                  yesNoNa: '',
                  responseValue: '',
                  remarks: '',
                }
              })
            } else {
              // No items found: form has no checklist items yet (admin adds them in Form Builder)
              if (user?.role === 'SUPERVISOR' || user?.role === 'DEPT_ADMIN') {
                setLoadError(
                  `No checklist items for this form. Add items in Form Builder (Admin) or contact your administrator.`
                )
                setLoading(false)
                return
              } else {
                setMessage('No checklist items for this form. Add items in Form Builder (Admin) or contact your administrator.')
              }
            }
            setAnswers(init)

            // Auto-restore draft so every field value persists after refresh or navigating away
            try {
              const key = `${DRAFT_KEY_PREFIX}${formTemplateId}_${user?.id || user?._id || 'anon'}`
              const raw = localStorage.getItem(key)
              if (raw) {
                const draft = JSON.parse(raw)
                if (draft.formTemplateId === formTemplateId) {
                  if (draft.departmentId) {
                    setDepartmentId(draft.departmentId)
                    const d = deptsActive.find((x) => (x._id?.toString() || x._id) === draft.departmentId)
                    if (d) setDepartment(d)
                  }
                  if (form.formContext !== 'CLINICAL') {
                    setLocationId(draft.locationId || '')
                    setLocation(draft.location || '')
                    setLocationType(draft.locationType || '')
                    setAssetId(draft.assetId || '')
                    setAsset(draft.asset || '')
                  }
                  const merged = {}
                    ; (checklist || []).forEach((it) => {
                      const draftAns = draft.answers?.[it._id]
                      merged[it._id] = draftAns
                        ? { yesNoNa: draftAns.yesNoNa || '', responseValue: draftAns.responseValue || '', remarks: draftAns.remarks || '' }
                        : { yesNoNa: '', responseValue: '', remarks: '' }
                    })
                  setAnswers(merged)
                  const validSections = Array.from(new Set((checklist || []).map((it) => it.section || 'Other')))
                  if (Array.isArray(draft.selectedSections) && draft.selectedSections.length > 0) {
                    setSelectedSections(draft.selectedSections.filter((s) => validSections.includes(s)))
                  } else {
                    setSelectedSections(validSections)
                  }
                  if (form.formContext === 'CLINICAL') {
                    setPatientUhid(typeof draft.patientUhid === 'string' ? draft.patientUhid : '')
                    setPatientName(typeof draft.patientName === 'string' ? draft.patientName : '')
                  }
                }
              }
            } catch (err) {
              console.error(err)
            }
          } catch (checklistErr) {
            console.error('[DEBUG] Error loading checklist items:', checklistErr)
            console.error('[DEBUG] Error details:', {
              message: checklistErr.message,
              response: checklistErr.response?.data,
              status: checklistErr.response?.status,
              statusText: checklistErr.response?.statusText
            })
            // For chiefs, show error instead of empty form
            if (user?.role === 'SUPERVISOR' || user?.role === 'DEPT_ADMIN') {
              const errorMsg = checklistErr.response?.data?.message || checklistErr.message || 'Unknown error'
              setLoadError(
                `Unable to load checklist items for this form. ${errorMsg}. Please contact your administrator.`
              )
              setLoading(false)
              return
            }

            setItems([])
            setAnswers({})
            const errorMsg = checklistErr.response?.data?.message || checklistErr.message || 'Unknown error'
            setMessage(`Could not load checklist items: ${errorMsg}. Please contact your administrator.`)
          }
        } else {
          // No department, but still show form (admin case)
          setItems([])
          setAnswers({})
        }

        setLoading(false)
      } catch (err) {
        console.error('[ERROR] Error loading form:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
        })

        let errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error loading form'

        // Handle HTML error responses (backend not running or route not found)
        if (typeof errorMsg === 'string' && errorMsg.includes('<!DOCTYPE html>')) {
          errorMsg = 'Backend server error. Please ensure the backend server is running and restart it if needed.'
        } else if (err.response?.status === 404) {
          errorMsg = 'Form template not found. The form may have been deleted or the ID is invalid.'
          setFormTemplate(null)
        } else if (err.response?.status === 401) {
          errorMsg = 'Authentication failed. Please log in again.'
        } else if (err.response?.status === 403) {
          errorMsg = 'You do not have permission to access this form.'
        } else if (err.response?.status === 500) {
          errorMsg = `Server error: ${errorMsg}. Please check the backend console for details.`
        }

        setLoadError(`Error loading form: ${errorMsg}. Please try again.`)
        setLoading(false)
      }
    })()
  }, [formTemplateId, user])

  useEffect(() => {
    if (formTemplate?.formContext === 'CLINICAL') return
    if (!locationId) {
      apiClient.get('/assets').then((data) => setAssetsList(Array.isArray(data) ? data : [])).catch(() => setAssetsList([]))
      return
    }
    apiClient.get(`/assets?locationId=${locationId}`).then((data) => setAssetsList(Array.isArray(data) ? data : [])).catch(() => setAssetsList([]))
  }, [locationId, formTemplate?.formContext])

  // Duplicate submission checks and 24h countdown have been removed – submissions are always allowed

  const resetToNewForm = () => {
    setDepartmentId(department?._id?.toString() || department?._id || '')
    setLocationType('')
    setLocationId('')
    setLocation('')
    setAssetId('')
    setAsset('')
    setSelectedSupervisorId('')
    setPatientUhid('')
    setPatientName('')
    setMessage('')
    setSelectedSections(Array.from(new Set(items.map((it) => it.section || 'Other'))))
    clearDraft()
    const init = {}
    items.forEach((it) => {
      init[it._id] = {
        yesNoNa: '',
        responseValue: '',
        remarks: '',
      }
    })
    setAnswers(init)
  }

  // Group items by section
  const itemsBySection = items.reduce((acc, item) => {
    const section = item.section || 'Other'
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})
  const allSectionNames = useMemo(() => Object.keys(itemsBySection).sort(), [itemsBySection])

  // Canvas mounts only after sections load; initializing in an effect with [] runs before the ref exists.
  useLayoutEffect(() => {
    if (allSectionNames.length === 0) return
    initStaffSignatureCanvas()
  }, [allSectionNames.length, initStaffSignatureCanvas])

  const selectedSectionSet = useMemo(() => new Set(selectedSections), [selectedSections])
  const selectedItems = useMemo(
    () => items.filter((it) => selectedSectionSet.has(it.section || 'Other')),
    [items, selectedSectionSet]
  )
  const allSectionsSelected = allSectionNames.length > 0 && selectedSections.length === allSectionNames.length

  const toggleSection = (sectionName) => {
    setSelectedSections((prev) =>
      prev.includes(sectionName) ? prev.filter((s) => s !== sectionName) : [...prev, sectionName]
    )
  }

  const toggleAllSections = () => {
    setSelectedSections((prev) => (prev.length === allSectionNames.length ? [] : allSectionNames))
  }

  const updateAnswer = (id, field, value) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formTemplateId) {
      setMessage('Missing form information. Please refresh the page.')
      return
    }

    // Get user department ID
    let userDeptId = null
    if (user?.department) {
      userDeptId = typeof user.department === 'object'
        ? (user.department.id || user.department._id)
        : user.department
    }

    if (!userDeptId && user?.role !== 'SUPER_ADMIN') {
      setMessage('No department assigned. Please contact your administrator.')
      return
    }

    const deptForSubmit = departmentId || userDeptId
    if (!deptForSubmit) {
      setMessage('Please select a department.')
      return
    }
    if (!isClinicalForm && !locationId) {
      setMessage('Please select a location.')
      return
    }
    if (!selectedSupervisorId) {
      setMessage('Please select a supervisor to submit to.')
      return
    }

    if (isClinicalForm) {
      if (!patientUhid.trim() || !patientName.trim()) {
        setMessage('Please enter patient UHID and patient name for this clinical form.')
        return
      }
    }

    // Validate responses (YES_NO can be stored in responseValue or yesNoNa)
    if (selectedItems.length === 0) {
      setMessage('Please select at least one section to submit.')
      return
    }

    for (const it of selectedItems) {
      const answer = answers[it._id]
      const responseType = it.responseType || 'YES_NO'
      const value = (answer?.responseValue || answer?.yesNoNa || '').toString().trim()

      // Validate mandatory items
      if (it.isMandatory) {
        if (!value) {
          setMessage(`Response is required for mandatory item: ${it.label}`)
          setSubmitting(false)
          return
        }
      }

      // Validate that remarks are provided when NO is selected (for YES_NO type)
      if (responseType === 'YES_NO' && value.toUpperCase() === 'NO' && (!answer?.remarks || !String(answer.remarks || '').trim())) {
        setMessage(`Remarks are required when "NO" is selected for: ${it.label}`)
        setSubmitting(false)
        return
      }

      // Validate TEXT type has content if mandatory
      if (responseType === 'TEXT' && it.isMandatory && (!answer?.responseValue || !answer.responseValue.trim())) {
        setMessage(`Text response is required for: ${it.label}`)
        setSubmitting(false)
        return
      }
    }

    if (!signatureFile) {
      setMessage('Please draw and save your signature before submitting.')
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      let departmentIdForSubmit = deptForSubmit
      if (formTemplate?.departments?.length) {
        const formDeptIds = formTemplate.departments.map((d) => d && (d._id || d.id) ? String(d._id || d.id) : String(d))
        const deptStr = departmentIdForSubmit ? String(departmentIdForSubmit) : ''
        if (!formDeptIds.includes(deptStr)) {
          departmentIdForSubmit = formTemplate.departments[0]._id || formTemplate.departments[0].id || formTemplate.departments[0]
        }
      }
      const payload = {
        departmentId: departmentIdForSubmit,
        formTemplateId: formTemplateId,
        ...(isClinicalForm
          ? {}
          : { locationId: locationId || undefined, location: location.trim() || '' }),
        assignedToUserId: selectedSupervisorId || undefined,
        ...(isClinicalForm
          ? { patientUhid: patientUhid.trim(), patientName: patientName.trim() }
          : {}),
        items: selectedItems.map((it) => ({
          checklistItemId: it._id,
          ...answers[it._id],
        })),
      }

      const created = await apiClient.post('/audits', payload)
      const firstId = Array.isArray(created) ? (created[0]?._id || created[0]?.id) : (created?._id || created?.id)
      if (firstId) {
        const fd = new FormData()
        fd.append('signature', signatureFile)
        await apiClient.postFormData(`/audits/session/${firstId}/submitted-signature`, fd)
      }
      clearDraft()
      setSubmittedContext(
        isClinicalForm
          ? { patientUhid: patientUhid.trim(), patientName: patientName.trim() }
          : { location: location.trim(), asset: asset.trim() }
      )
      setShowSuccessModal(true)
      // Reset form
      resetToNewForm()
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to submit form'
      if (errorMsg.includes('wait 24 hours') || errorMsg.includes('same checklist form')) {
        setMessage(errorMsg)
      } else if (errorMsg.includes('already been submitted') || errorMsg.includes('wait 24 hours')) {
        setMessage('For the same checklist form, please wait 24 hours from your last submission.')
      } else {
        setMessage(errorMsg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-maroon-200 p-8 sm:p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-maroon-200 border-t-maroon-600 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading form...</h2>
          <p className="text-slate-600 text-sm">Please wait while we load the checklist.</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 px-4 py-6">
        <div className="bg-white/95 backdrop-blur-md border border-maroon-200/50 rounded-2xl shadow-xl px-5 py-4 sm:py-5">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Form Access Restricted</h1>
          <p className="text-sm text-slate-600">Unable to access this form</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📋</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Access Denied</h3>
              <p className="text-slate-700 mb-4 leading-relaxed">{loadError}</p>

              {user?.role === 'chief' && (
                <div className="bg-maroon-50 border border-maroon-200 rounded-lg p-4 mt-4">
                  <p className="text-sm font-semibold text-slate-900 mb-2">What you can do:</p>
                  <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                    <li>Check the navigation menu for forms assigned to your department</li>
                    <li>Contact your administrator to assign this form to your department</li>
                    <li>Use the "Department Logs" page to view submissions from your department</li>
                  </ul>
                </div>
              )}

              {formTemplate && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Form:</span> {formTemplate.name}
                  </p>
                  {formTemplate.description && (
                    <p className="text-sm text-slate-600 mt-1">
                      <span className="font-semibold">Description:</span> {formTemplate.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            to="/"
            className="px-6 py-3 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <Link
            to="/admin/department-logs"
            className="px-6 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors"
          >
            View Department Logs
          </Link>
        </div>
      </div>
    )
  }

  // Show not found state
  if (!formTemplate) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-200 p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Form not found</h2>
          <p className="text-slate-600 mb-4">Please select a valid form from the sidebar or dashboard.</p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white font-medium rounded-lg"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 px-4 py-4">
      {/* Page header - form name and back link */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50 px-5 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Link
              to="/"
              className="text-sm font-medium text-maroon-600 hover:text-maroon-800 mb-2 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">{formTemplate.name}</h1>
            {formTemplate.description && (
              <p className="text-slate-600 text-sm mt-1">{formTemplate.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              {isClinicalForm ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-800 px-2.5 py-0.5 border border-sky-200 font-medium">
                  Clinical form — patient UHID and name required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 border border-slate-200 font-medium">
                  Non-clinical checklist
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500">Checklist items: {items.length}</div>
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={resetToNewForm}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Start fresh
                </button>
              )}
            </div>
            {lastDraftSavedAt && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Draft saved
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg shadow-sm border-2 flex items-start gap-3 ${message.includes('successfully') || message.includes('Success')
              ? 'bg-green-50 border-green-300 text-green-800'
              : message.includes('Error') || message.includes('error') || message.includes('failed')
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-maroon-50 border-maroon-300 text-maroon-800'
            }`}
        >
          {message.includes('successfully') || message.includes('Success') ? (
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : message.includes('Error') || message.includes('error') || message.includes('failed') ? (
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-sm font-medium flex-1">{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General checklist – optional details */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Operational context{' '}
              <span className="text-xs font-normal text-slate-600 ml-2">
                {isClinicalForm
                  ? '(Department/Service, Patient, Supervisor)'
                  : '(Department/Service, Location, Supervisor)'}
              </span>
            </h3>
          </div>
          <div className="px-4 pt-3" />
          <div className="p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Department / Service <span className="text-red-600">*</span></label>
                <select
                  value={departmentId}
                  onChange={(e) => {
                    const id = e.target.value
                    setDepartmentId(id)
                    const d = departmentsList.find((x) => (x._id?.toString() || x._id) === id)
                    setDepartment(d || null)
                  }}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all border-slate-300 hover:border-slate-400"
                  required
                >
                  <option value="">Select department</option>
                  {departmentsList.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} {d.code ? `(${d.code})` : ''}</option>
                  ))}
                </select>
              </div>
              {!isClinicalForm && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Location Type <span className="text-red-600">*</span></label>
                    <select
                      value={locationType}
                      onChange={(e) => {
                        const t = e.target.value
                        setLocationType(t)
                        setLocationId('')
                        setLocation('')
                        setAssetId('')
                        setAsset('')
                      }}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all border-slate-300 hover:border-slate-400"
                      required
                    >
                      <option value="">Select type</option>
                      {availableLocationTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Location <span className="text-red-600">*</span></label>
                    <select
                      value={locationId}
                      onChange={(e) => {
                        const id = e.target.value
                        setLocationId(id)
                        const loc = locationsList.find((x) => (x._id?.toString() || x._id) === id)
                        setLocation(loc ? [loc.areaName, loc.building, loc.floor].filter(Boolean).join(' / ') : '')
                        const t = String(loc?.locationType || 'OTHER').toUpperCase()
                        if (t) setLocationType(t)
                        setAssetId('')
                        setAsset('')
                      }}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all border-slate-300 hover:border-slate-400"
                      disabled={!locationType}
                      required
                    >
                      <option value="">{locationType ? 'Select location' : 'Select type first'}</option>
                      {(() => {
                        const getType = (loc) => String(loc?.locationType || 'OTHER').toUpperCase()
                        const getZoneName = (loc) => (loc?.parent?.areaName ?? (loc?.parent && typeof loc.parent === 'object' ? loc.parent.areaName : null))
                        const getLabel = (loc) => ([loc?.areaName, loc?.building, loc?.floor].filter(Boolean).join(' / ') || loc?.code || loc?._id || '—')
                        const list = (Array.isArray(locationsList) ? locationsList : []).filter((loc) => getType(loc) === locationType)
                        list.sort((a, b) => String(a?.areaName || '').localeCompare(String(b?.areaName || '')))
                        return list.map((loc) => {
                          const zoneName = getZoneName(loc)
                          const baseLabel = getLabel(loc)
                          const fullLabel = zoneName ? `${baseLabel} (${zoneName})` : baseLabel
                          return (
                            <option key={loc._id} value={loc._id}>
                              {fullLabel}
                            </option>
                          )
                        })
                      })()}
                    </select>
                  </div>
                </>
              )}

              {isClinicalForm && (
                <>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Patient UHID <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={patientUhid}
                      onChange={(e) => setPatientUhid(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all border-slate-300 hover:border-slate-400"
                      placeholder="e.g. UHID000123"
                      autoComplete="off"
                      required={isClinicalForm}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Patient name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all border-slate-300 hover:border-slate-400"
                      placeholder="Full name as per record"
                      autoComplete="name"
                      required={isClinicalForm}
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Submit to Supervisor <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all border-slate-300 hover:border-slate-400"
                  required
                >
                  <option value="">Select supervisor</option>
                  {supervisors.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}{s.designation ? ` — ${s.designation}` : ''}{s.department?.name ? ` (${s.department.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Checklist Sections */}
        {allSectionNames.length > 0 && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900">Section selection</h3>
              <button
                type="button"
                onClick={toggleAllSections}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              >
                {allSectionsSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {allSectionNames.map((sectionName) => {
                const checked = selectedSectionSet.has(sectionName)
                return (
                  <label key={sectionName} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer ${checked ? 'bg-maroon-50 border-maroon-300 text-maroon-700' : 'bg-white border-slate-300 text-slate-700'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSection(sectionName)}
                      className="w-3.5 h-3.5"
                    />
                    <span>{sectionName}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
        {allSectionNames.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50 p-6 text-center">
            <div className="text-slate-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">No checklist items available for this form.</p>
          </div>
        ) : (
          allSectionNames
            .filter((sectionName) => selectedSectionSet.has(sectionName))
            .map((sectionName) => (
              <div key={sectionName} className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-maroon-200/50 overflow-hidden">
                {/* Section Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                  <h3 className="font-semibold text-sm text-slate-900">
                    {sectionName}
                  </h3>
                </div>

                {/* Table Layout */}
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-slate-100 border-b-2 border-slate-200">
                      <tr>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-bold text-[10px] sm:text-xs text-slate-700 uppercase tracking-wide w-12">#</th>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-bold text-[10px] sm:text-xs text-slate-700 uppercase tracking-wide w-[35%]">Checklist Item</th>
                        <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-bold text-[10px] sm:text-xs text-slate-700 uppercase tracking-wide w-[15%] min-w-[150px]">Response</th>
                        <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-bold text-[10px] sm:text-xs text-slate-700 uppercase tracking-wide w-[25%]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsBySection[sectionName]
                        .sort((a, b) => a.order - b.order)
                        .map((it, idx) => {
                          const responseType = it.responseType || 'YES_NO'
                          const currentValue = answers[it._id]?.responseValue || answers[it._id]?.yesNoNa || ''
                          const isTextType = responseType === 'TEXT'

                          return (
                            <tr key={it._id} className={`hover:bg-maroon-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 align-top text-slate-500 font-medium">{idx + 1}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 align-top">
                                <div className="font-semibold text-xs sm:text-sm text-slate-800 mb-1">{it.label}</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    {it.departmentScope === 'ALL' ? 'All departments' : it.department?.name || 'Dept specific'}
                                  </span>
                                  {it.isMandatory && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-semibold">
                                      Mandatory
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 align-middle" colSpan={isTextType ? 3 : 1}>
                                {/* Handle different response types */}
                                {responseType === 'TEXT' ? (
                                  <textarea
                                    className="border-2 border-maroon-300 rounded-md w-full px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-maroon-50 resize-y min-h-[100px] transition-all"
                                    value={answers[it._id]?.responseValue || ''}
                                    onChange={(e) => {
                                      updateAnswer(it._id, 'responseValue', e.target.value)
                                      updateAnswer(it._id, 'yesNoNa', '')
                                    }}
                                    placeholder={it.isMandatory ? 'Enter details (required)*' : 'Enter details'}
                                    required={it.isMandatory}
                                    rows={4}
                                  />
                                ) : responseType === 'MULTI_SELECT' ? (
                                  <select
                                    className="border-2 border-slate-300 rounded-md w-full px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-white transition-all"
                                    value={currentValue}
                                    onChange={(e) => {
                                      updateAnswer(it._id, 'responseValue', e.target.value)
                                      updateAnswer(it._id, 'yesNoNa', e.target.value)
                                    }}
                                    required={it.isMandatory}
                                  >
                                    <option value="">Select an option</option>
                                    {it.responseOptions && it.responseOptions.split(',').map((opt, idx) => (
                                      <option key={idx} value={opt.trim()}>
                                        {opt.trim()}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="flex items-center justify-center gap-3 flex-nowrap">
                                    {['YES', 'NO'].map((opt) => (
                                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer group shrink-0">
                                        <input
                                          type="radio"
                                          name={`resp_${it._id}`}
                                          value={opt}
                                          checked={currentValue === opt}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            updateAnswer(it._id, 'responseValue', val)
                                            updateAnswer(it._id, 'yesNoNa', val)
                                            if (val === 'YES') {
                                              updateAnswer(it._id, 'remarks', '')
                                            }
                                          }}
                                          className="w-4 h-4 text-maroon-600 border-2 border-slate-300 focus:ring-2 focus:ring-maroon-500 focus:ring-offset-2"
                                        />
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-maroon-600 transition-colors whitespace-nowrap">{opt}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </td>
                              {!isTextType && (
                                <>
                                  <td className="px-4 py-3 align-top">
                                    {responseType === 'YES_NO' && currentValue === 'NO' ? (
                                      <input
                                        type="text"
                                        className="border-2 border-maroon-300 rounded-md w-full px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 bg-maroon-50 transition-all"
                                        value={answers[it._id]?.remarks || ''}
                                        onChange={(e) => updateAnswer(it._id, 'remarks', e.target.value)}
                                        placeholder="Remarks required when NO"
                                        required
                                      />
                                    ) : (
                                      <span className="text-xs text-slate-400 italic">—</span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
        )}

        {/* Submit Button */}
        {allSectionNames.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Staff signature</h3>
                <p className="text-xs text-slate-600">
                  Draw your signature (required). Click “Save signature” before submitting.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="border border-slate-300 rounded-md bg-white p-2 inline-block">
                    <canvas
                      ref={signatureCanvasRef}
                      className="touch-none block"
                      style={SIGNATURE_CANVAS_STYLE}
                      onPointerDown={handleSignaturePointerDown}
                      onPointerMove={handleSignaturePointerMove}
                      onPointerUp={handleSignaturePointerUp}
                      onPointerLeave={handleSignaturePointerUp}
                      onPointerCancel={handleSignaturePointerUp}
                      aria-label="Draw staff signature canvas"
                    />
                  </div>
                  {signaturePreviewLocal && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">Saved</p>
                      <div className="border border-slate-300 rounded-md bg-white p-2 inline-block">
                        <img
                          src={signaturePreviewLocal}
                          alt="Signature preview"
                          className="max-h-24 w-[clamp(200px,20vw,400px)] object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={clearSignatureCanvas}
                    className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={saveDrawnSignatureToFile}
                    className="px-3 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Save signature
                  </button>
                </div>
                {signatureError && <p className="text-xs text-red-600">{signatureError}</p>}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetToNewForm()
                    clearSignatureCanvas()
                  }}
                  className="px-6 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-all text-sm"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white font-semibold px-8 py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm text-sm flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Submit Form
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Form Submitted Successfully!</h3>
              <div className="text-sm text-slate-600 mb-4 space-y-1">
                <p>
                  <span className="font-semibold">Checklist submitted.</span>{' '}
                  {submittedContext?.patientUhid &&
                    ` (${submittedContext.patientName} — ${submittedContext.patientUhid})`}
                  {submittedContext &&
                    !submittedContext.patientUhid &&
                    [submittedContext.location, submittedContext.asset]
                      .filter(Boolean)
                      .length > 0 &&
                    ` (${[submittedContext.location, submittedContext.asset].filter(Boolean).join(', ')})`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  setSubmittedContext(null)
                }}
                className="w-full bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors shadow-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

