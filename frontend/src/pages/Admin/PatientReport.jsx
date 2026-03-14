import React, { useState, useEffect } from 'react'
import { apiClient } from '../../api/client'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export function PatientReport() {
  const [departments, setDepartments] = useState([])
  const [locationsList, setLocationsList] = useState([])
  const [shiftsList, setShiftsList] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [locationId, setLocationId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [status, setStatus] = useState('all') // all | compliant | non-compliant
  const [sessions, setSessions] = useState([]) // { firstId, submittedAt, formName, submittedBy, description, submissions, isCompliant }
  const [reportSummary, setReportSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [error, setError] = useState('')
  const [location, setLocation] = useState('')
  const [shift, setShift] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  useEffect(() => {
    Promise.all([
      apiClient.get('/departments').then((d) => Array.isArray(d) ? d : []).catch(() => []),
      apiClient.get('/locations?selectable=true').then((d) => Array.isArray(d) ? d : []).catch(() => []),
      apiClient.get('/shifts').then((d) => Array.isArray(d) ? d : []).catch(() => []),
    ]).then(([depts, locs, shfts]) => {
      setDepartments(depts)
      setLocationsList(locs)
      setShiftsList(shfts)
    })
  }, [])

  // Build report data from a list of submissions (operational context only)
  const buildReportDataFromSubmissions = (submissions) => {
    if (!submissions || submissions.length === 0) return null
    const deptMap = new Map()
    const first = submissions[0]
    const desc = [first?.location, first?.shift].filter(Boolean).join(' / ') || 'General'
    const context = { location: first?.location || '', shift: first?.shift || '', label: desc }
    submissions.forEach(sub => {
      const deptId = sub.department?._id || sub.department
      const deptName = sub.department?.name || 'Unknown Department'
      const deptCode = sub.department?.code || 'N/A'
      const formId = sub.formTemplate?._id || sub.formTemplate
      const formName = sub.formTemplate?.name || 'Unknown Form'
      const key = `${deptId}_${formId}`
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          department: { _id: deptId, name: deptName, code: deptCode },
          form: { _id: formId, name: formName },
          submittedBy: sub.submittedBy,
          submittedAt: sub.submittedAt,
          sections: new Map()
        })
      }
      const deptData = deptMap.get(key)
      const sectionName = sub.checklistItemId?.section || 'General'
      if (!deptData.sections.has(sectionName)) {
        deptData.sections.set(sectionName, { sectionName, items: [] })
      }
      const section = deptData.sections.get(sectionName)
      section.items.push({
        checklistItemId: {
          _id: sub.checklistItemId?._id,
          label: sub.checklistItemId?.label || 'N/A',
          section: sub.checklistItemId?.section,
          responseType: sub.checklistItemId?.responseType || 'YES_NO',
          order: 0,
        },
        responseValue: sub.responseValue || sub.yesNoNa || '',
        remarks: sub.remarks || '',
        corrective: sub.corrective || '',
        preventive: sub.preventive || '',
        submittedAt: sub.submittedAt,
      })
    })
    return {
      context,
      departments: Array.from(deptMap.values()).map(deptData => ({
        department: deptData.department,
        form: deptData.form,
        submittedBy: deptData.submittedBy,
        submittedAt: deptData.submittedAt,
        sections: Array.from(deptData.sections.values()).map(section => ({
          sectionName: section.sectionName,
          items: section.items.sort((a, b) => (a.checklistItemId?.order || 0) - (b.checklistItemId?.order || 0)),
        })),
      })),
      totalSubmissions: submissions.length,
    }
  }

  // Load submissions and report summary by filters (date range, department, location, shift), then group by session and filter by status
  const loadSessions = async (e) => {
    e?.preventDefault()
    if (!departmentId) {
      setError('Please select a department')
      return
    }
    setLoading(true)
    setError('')
    setSessions([])
    setReportData(null)
    setReportSummary(null)
    setSelectedSessionId(null)
    try {
      const params = new URLSearchParams({ departmentId, limit: '1000' })
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (locationId) params.set('locationId', locationId)
      if (shiftId) params.set('shiftId', shiftId)
      const summaryParams = new URLSearchParams()
      if (fromDate) summaryParams.set('fromDate', fromDate)
      if (toDate) summaryParams.set('toDate', toDate)
      if (departmentId) summaryParams.set('departmentId', departmentId)
      if (locationId) summaryParams.set('locationId', locationId)
      if (shiftId) summaryParams.set('shiftId', shiftId)

      const [rows, summary] = await Promise.all([
        apiClient.get(`/audits?${params.toString()}`),
        apiClient.get(`/audits/report-summary?${summaryParams.toString()}`).catch(() => null),
      ])
      setReportSummary(summary)

      const list = Array.isArray(rows) ? rows : []
      const groupKey = (s) => {
        const d = s.department?._id || s.department
        const f = s.formTemplate?._id || s.formTemplate
        const t = s.submittedAt ? new Date(s.submittedAt).getTime() : 0
        const sec = Math.floor(t / 1000) * 1000
        const u = s.submittedBy?._id || s.submittedBy
        return `${d}_${f}_${sec}_${u}`
      }
      const groups = new Map()
      list.forEach((s) => {
        const key = groupKey(s)
        const val = s.responseValue || s.yesNoNa || ''
        const isYes = /^yes$/i.test(String(val))
        if (!groups.has(key)) {
          const subAt = s.submittedAt ? new Date(s.submittedAt) : null
          groups.set(key, {
            firstId: s._id,
            submittedAt: subAt,
            formName: s.formTemplate?.name || s.formTemplate || 'Unknown',
            submittedBy: s.submittedBy?.name || s.submittedBy?.email || 'Unknown',
            description: [s.location, s.shift].filter(Boolean).join(' / ') || 'General',
            submissions: [],
            yesCount: 0,
            totalCount: 0,
          })
        }
        const g = groups.get(key)
        g.submissions.push(s)
        g.totalCount += 1
        if (isYes) g.yesCount += 1
      })

      let sessionList = Array.from(groups.values()).map((g) => ({
        ...g,
        isCompliant: g.totalCount > 0 && g.yesCount === g.totalCount,
      }))
      sessionList = sessionList.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))

      if (status === 'compliant') sessionList = sessionList.filter((s) => s.isCompliant)
      else if (status === 'non-compliant') sessionList = sessionList.filter((s) => !s.isCompliant)

      setSessions(sessionList)
      if (sessionList.length === 0) setError('No submissions found for the selected filters.')
    } catch (err) {
      console.error('Error loading sessions:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const handleViewSession = async (firstId) => {
    setLoadingSession(true)
    setError('')
    setReportData(null)
    setSelectedSessionId(firstId)
    try {
      const submissions = await apiClient.get(`/audits/session/${firstId}`)
      const data = buildReportDataFromSubmissions(submissions)
      setReportData(data)
      const first = submissions?.[0]
      if (first) {
        setLocation(first.location || '')
        setShift(first.shift || '')
      }
    } catch (err) {
      console.error('Error loading session:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load report')
    } finally {
      setLoadingSession(false)
    }
  }

  const handleExportSummaryCSV = () => {
    if (!reportSummary) return
    const rows = []
    rows.push('Report Summary')
    rows.push(`Completion %,${reportSummary.completionPercent ?? 0}`)
    rows.push(`Total sessions,${reportSummary.totalSessions ?? 0}`)
    rows.push(`Fully compliant sessions,${reportSummary.fullyCompliantSessions ?? 0}`)
    rows.push(`Overdue (non-compliant) items,${reportSummary.overdueCount ?? 0}`)
    rows.push('')
    rows.push('Rejection reasons')
    rows.push('Checklist item,Remarks,Count')
      ; (reportSummary.rejectionReasons || []).forEach((r) => {
        rows.push(`"${(r.checklistLabel || '').replace(/"/g, '""')}","${(r.remarks || '').replace(/"/g, '""')}",${r.count}`)
      })
    rows.push('')
    rows.push('Staff performance')
    rows.push('Staff,Total submissions,Compliant count,Compliance %')
      ; (reportSummary.staffPerformance || []).forEach((s) => {
        rows.push(`"${(s.name || '').replace(/"/g, '""')}",${s.totalSubmissions ?? 0},${s.compliantCount ?? 0},${s.complianceRate ?? 0}`)
      })
    const csv = rows.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Report_Summary_${fromDate || 'from'}_${toDate || 'to'}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    if (!reportData) return

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Header
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('MAPIMS - GENERAL AUDIT CHECKLIST', 105, 15, { align: 'center' })

    const submittedByName = reportData.departments?.[0]?.submittedBy?.name || reportData.departments?.[0]?.submittedBy?.email || ''
    let yPos = 22
    doc.setFontSize(9)
    doc.text('SUBMITTED BY:', 20, yPos)
    doc.text(submittedByName || '_______________________', 55, yPos)
    doc.text('LOCATION:', 120, yPos)
    doc.text(location || '___________', 145, yPos)
    yPos += 5
    doc.text('SHIFT:', 20, yPos)
    doc.text(shift || '____', 40, yPos)

    yPos = 40

    // Report / Description
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')
    doc.text('DETAILS', 20, yPos)
    yPos += 5
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(`Context: ${reportData.context?.label || 'General'}`, 20, yPos)
    const departmentNames = reportData.departments && reportData.departments.length > 0
      ? reportData.departments.map(dept => dept.department.name).join(', ')
      : 'N/A'
    doc.text(`Department: ${departmentNames}`, 100, yPos)
    yPos += 8

    // Main table header (landscape layout needed for more columns)
    doc.setFontSize(7)
    doc.setFont(undefined, 'bold')
    doc.setFillColor(240, 240, 240)
    doc.rect(15, yPos, 180, 8, 'F')

    // Table headers - adjusted positions for all 6 columns
    doc.text('STANDARD & OBJECTIVE ELEMENTS', 17, yPos + 5)
    doc.text('Y', 90, yPos + 5)
    doc.text('N', 97, yPos + 5)
    doc.text('Remarks', 105, yPos + 5)
    doc.text('Corrective', 130, yPos + 5)
    doc.text('Preventive', 160, yPos + 5)

    yPos += 9

    // Department-wise checklist
    reportData.departments.forEach((deptData) => {
      // Check page break
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }

      // Department header
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`${deptData.department.name} (${deptData.department.code})`, 20, yPos)
      yPos += 5

      // Sections
      deptData.sections.forEach((section) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }

        // Section name
        doc.setFontSize(9)
        doc.setFont(undefined, 'bold')
        doc.text(section.sectionName, 22, yPos)
        yPos += 4

        // Checklist items
        section.items.forEach((item, idx) => {
          if (yPos > 270) {
            doc.addPage()
            yPos = 20
          }

          const label = item.checklistItemId?.label || 'N/A'
          const responseValue = item.responseValue || item.yesNoNa || ''
          const isYes = responseValue === 'YES' || responseValue === 'Yes'
          const isNo = responseValue === 'NO' || responseValue === 'No'
          const remarks = item.remarks || ''
          const corrective = item.corrective || ''
          const preventive = item.preventive || ''

          // Item label (truncated if too long)
          doc.setFontSize(7)
          doc.setFont(undefined, 'normal')
          const labelLines = doc.splitTextToSize(`${idx + 1}. ${label}`, 70)
          doc.text(labelLines[0], 17, yPos)

          // Yes checkbox
          doc.rect(90, yPos - 3, 3, 3, isYes ? 'F' : 'S')
          if (isYes) {
            doc.setFontSize(6)
            doc.text('✓', 90.5, yPos - 1.5)
          }

          // No checkbox
          doc.rect(97, yPos - 3, 3, 3, isNo ? 'F' : 'S')
          if (isNo) {
            doc.setFontSize(6)
            doc.text('✓', 97.5, yPos - 1.5)
          }

          // Remarks (truncated)
          doc.setFontSize(6)
          const remarksLines = doc.splitTextToSize(remarks || '-', 20)
          doc.text(remarksLines[0] || '-', 105, yPos)

          // Corrective (truncated)
          const correctiveLines = doc.splitTextToSize(corrective || '-', 25)
          doc.text(correctiveLines[0] || '-', 130, yPos)

          // Preventive (truncated)
          const preventiveLines = doc.splitTextToSize(preventive || '-', 25)
          doc.text(preventiveLines[0] || '-', 160, yPos)

          yPos += 5
        })

        yPos += 2
      })

      yPos += 3
    })

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(128, 128, 128)
      doc.text(
        `Page ${i} of ${pageCount} | Generated: ${new Date().toLocaleString('en-GB')}`,
        105,
        285,
        { align: 'center' }
      )
    }

    doc.save(`Checklist_Report_${Date.now()}.pdf`)
  }

  return (
    <>
      {/* Enhanced Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 10pt !important;
            width: 100% !important;
            height: auto !important;
          }
          
          .no-print {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            page-break-inside: avoid !important;
          }
          
          .print-page {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: auto;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Ensure tables are visible and properly formatted */
          table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            page-break-inside: auto !important;
            display: table !important;
            visibility: visible !important;
            table-layout: fixed !important;
            font-size: 9pt !important;
          }
          
          table thead {
            display: table-header-group !important;
            visibility: visible !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          
          table tbody {
            display: table-row-group !important;
            visibility: visible !important;
          }
          
          table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
            break-inside: avoid !important;
            display: table-row !important;
            visibility: visible !important;
          }
          
          table td,
          table th {
            display: table-cell !important;
            visibility: visible !important;
            border: 1.5px solid #1e293b !important;
            padding: 3px 4px !important;
            vertical-align: top !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            hyphens: auto !important;
            font-size: 9pt !important;
            line-height: 1.3 !important;
          }
          
          /* Text response type - better wrapping */
          table td div[style*="whiteSpace: pre-wrap"] {
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            max-width: 100% !important;
            font-size: 8pt !important;
            line-height: 1.4 !important;
          }
          
          /* Prevent section headers from breaking */
          .section-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          .section-header td {
            background-color: #f1f5f9 !important;
            font-weight: 600 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .dept-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          .dept-header td {
            background-color: #dbeafe !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Ensure table headers repeat on each page */
          thead {
            display: table-header-group !important;
          }
          
          tfoot {
            display: table-footer-group !important;
          }
          
          /* Fix checkbox visibility */
          .checkbox-cell {
            visibility: visible !important;
            border: 2px solid #1e293b !important;
            width: 6% !important;
            text-align: center !important;
          }
          
          /* Ensure all text is visible and black */
          * {
            color: #000 !important;
          }
          
          /* Keep background colors for headers */
          .dept-header td,
          .section-header td {
            background-color: #dbeafe !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          tr:nth-child(even) {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          tr:nth-child(odd) {
            background-color: #ffffff !important;
          }
          
          /* Page breaks */
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          
          /* Ensure no overflow but allow text wrapping */
          * {
            overflow: visible !important;
          }
          
          /* Better spacing for print */
          h1, h2, h3, h4 {
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Footer positioning */
          .mt-6.print\\:mt-4 {
            margin-top: 8mm !important;
            page-break-inside: avoid !important;
          }
        }
        
        @media screen {
          .print-container {
            max-width: 210mm;
            margin: 0 auto;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
          <div className="bg-white border-b border-slate-200 px-6 py-5">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">
              Audit Submissions Report
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              View, filter, and export checklist audit submissions by department and date
            </p>
          </div>

          {/* Intro hint */}
          <div className="px-6 pt-4 pb-0">
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <span className="text-base flex-shrink-0">ℹ️</span>
              <span>Select a department and click <strong>Load</strong> to view audit submissions. You can also filter by date range, location, or shift.</span>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6">
            <form onSubmit={loadSessions} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">From date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">To date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Location</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  >
                    <option value="">All locations</option>
                    {locationsList.map((loc) => {
                      const zoneName = loc.parent?.areaName ?? (loc.parent && typeof loc.parent === 'object' ? loc.parent.areaName : null)
                      const name = loc.areaName || loc.name || ''
                      return (
                        <option key={loc._id} value={loc._id}>
                          {zoneName ? `${name} (${zoneName})` : name}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Shift</label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  >
                    <option value="">All shifts</option>
                    {shiftsList.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  >
                    <option value="all">All</option>
                    <option value="compliant">Compliant</option>
                    <option value="non-compliant">Non-compliant</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white font-semibold px-8 py-3 rounded-lg shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed text-base min-w-[140px]"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                        Loading...
                      </span>
                    ) : (
                      'Load'
                    )}
                  </button>
                </div>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-4 rounded-lg text-sm border-2 bg-red-50 border-red-300 text-red-800">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Report summary: completion %, overdue, rejection reasons, staff performance */}
        {reportSummary && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Report Summary</h3>
                <p className="text-sm text-slate-600 mt-1">Completion, overdue items, rejection reasons, and staff performance for the selected filters</p>
              </div>
              <button
                type="button"
                onClick={handleExportSummaryCSV}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export summary (CSV)
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-maroon-50 border border-maroon-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-maroon-800">Completion %</div>
                  <div className="text-2xl font-bold text-maroon-900 mt-1">{reportSummary.completionPercent ?? 0}%</div>
                  <div className="text-xs text-maroon-600 mt-1">{reportSummary.fullyCompliantSessions ?? 0} of {reportSummary.totalSessions ?? 0} sessions fully compliant</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-amber-800">Overdue (non-compliant) items</div>
                  <div className="text-2xl font-bold text-amber-900 mt-1">{reportSummary.overdueCount ?? 0}</div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Rejection reasons</h4>
                {Array.isArray(reportSummary.rejectionReasons) && reportSummary.rejectionReasons.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="text-left p-3 font-semibold text-slate-700">Checklist item</th>
                          <th className="text-left p-3 font-semibold text-slate-700">Remarks</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportSummary.rejectionReasons.map((r, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="p-3">{r.checklistLabel}</td>
                            <td className="p-3">{r.remarks || '—'}</td>
                            <td className="p-3 text-right">{r.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">No rejection reasons in this period.</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Staff performance</h4>
                {Array.isArray(reportSummary.staffPerformance) && reportSummary.staffPerformance.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="text-left p-3 font-semibold text-slate-700">Staff</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Submissions</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Compliant</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Compliance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportSummary.staffPerformance.map((s, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="p-3">{s.name}</td>
                            <td className="p-3 text-right">{s.totalSubmissions}</td>
                            <td className="p-3 text-right">{s.compliantCount}</td>
                            <td className="p-3 text-right">{s.complianceRate ?? 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">No staff performance data in this period.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sessions list */}
        {sessions.length > 0 && !reportData && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Submissions</h3>
              <p className="text-sm text-slate-600 mt-1">Select one to view report and export PDF</p>
            </div>
            <div className="p-6">
              {loadingSession ? (
                <div className="text-center py-8 text-slate-600">Loading report...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left p-3 font-semibold text-slate-700">Date / Time</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Form</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Submitted by</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Description</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                        <th className="text-left p-3 font-semibold text-slate-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-maroon-50/50">
                          <td className="p-3">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'}</td>
                          <td className="p-3">{s.formName}</td>
                          <td className="p-3">{s.submittedBy}</td>
                          <td className="p-3">{s.description || '—'}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.isCompliant ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {s.isCompliant ? 'Compliant' : 'Non-compliant'}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleViewSession(s.firstId)}
                              className="text-maroon-600 font-medium hover:underline"
                            >
                              View report
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Display */}
        {selectedSessionId && reportData && reportData.totalSubmissions > 0 && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSessionId(null)
                      setReportData(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-maroon-700 hover:bg-maroon-50 rounded-lg transition-colors border border-slate-300 hover:border-maroon-300"
                  >
                    ← Back to list
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExportPDF}
                    className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm transition-all text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-6 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </button>
                </div>
              </div>
            </div>

            {/* A4 Printable Report - Template Format */}
            <div className="bg-white shadow-lg rounded-lg overflow-visible print-container">
              <div
                className="p-6 sm:p-8 md:p-10 print:p-8 print-page"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  margin: '0 auto',
                  backgroundColor: 'white',
                  overflow: 'visible',
                }}
              >
                {/* Header */}
                <div className="text-center mb-4 print:mb-3 border-b-2 border-slate-800 pb-3 print:pb-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 print:text-lg">
                    MAPIMS - GENERAL AUDIT CHECKLIST
                  </h1>
                </div>

                {/* Submitted by, Location, Shift */}
                <div className="mb-4 print:mb-3 text-xs print:text-[10px] grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="font-semibold">SUBMITTED BY:</span>{' '}
                    <span className="border-b border-slate-400 inline-block min-w-[150px]">
                      {reportData?.departments?.[0]?.submittedBy?.name || reportData?.departments?.[0]?.submittedBy?.email || '_______________________'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">LOCATION:</span>{' '}
                    <span className="border-b border-slate-400 inline-block min-w-[120px]">
                      {location || reportData?.context?.location || '___________'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">SHIFT:</span>{' '}
                    <span className="border-b border-slate-400 inline-block min-w-[60px]">
                      {shift || reportData?.context?.shift || '____'}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="mb-4 print:mb-3 p-3 print:p-2 bg-slate-50 border border-slate-300 rounded">
                  <div className="text-sm print:text-xs font-semibold mb-2">DETAILS</div>
                  <div className="text-xs print:text-[10px] grid grid-cols-2 gap-2">
                    <div><span className="font-semibold">Context:</span> {reportData.context?.label || 'General'}</div>
                    <div>
                      <span className="font-semibold">Department:</span>{' '}
                      <span className="font-medium">
                        {reportData.departments && reportData.departments.length > 0
                          ? reportData.departments.map(dept => dept.department.name).join(', ')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Table Header */}
                <div className="mb-2 print:mb-1 overflow-x-auto">
                  <table
                    className="w-full text-xs print:text-[9px] border-collapse"
                    style={{
                      border: '1.5px solid #1e293b',
                      tableLayout: 'fixed',
                      width: '100%',
                    }}
                  >
                    <thead style={{ display: 'table-header-group' }}>
                      <tr className="bg-slate-200" style={{ backgroundColor: '#e2e8f0', display: 'table-row' }}>
                        <th className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-left font-bold align-top" style={{ width: '30%', border: '1.5px solid #1e293b', verticalAlign: 'middle', display: 'table-cell' }}>
                          STANDARD & OBJECTIVE ELEMENTS
                        </th>
                        <th className="border border-slate-800 px-1 py-2.5 print:px-0.5 print:py-2 text-center font-bold" style={{ width: '5%', border: '1.5px solid #1e293b', verticalAlign: 'middle', display: 'table-cell' }}>
                          Yes
                        </th>
                        <th className="border border-slate-800 px-1 py-2.5 print:px-0.5 print:py-2 text-center font-bold" style={{ width: '5%', border: '1.5px solid #1e293b', verticalAlign: 'middle', display: 'table-cell' }}>
                          No
                        </th>
                        <th className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-center font-bold align-top" style={{ width: '15%', border: '1.5px solid #1e293b', verticalAlign: 'middle', display: 'table-cell' }}>
                          COMPLIANCE<br />Remarks (NA)
                        </th>
                        <th className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-center font-bold" style={{ width: '15%', border: '1.5px solid #1e293b', verticalAlign: 'middle', display: 'table-cell' }}>
                          Corrective Action
                        </th>
                        <th className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-center font-bold" style={{ width: '15%', border: '1.5px solid #1e293b', verticalAlign: 'middle', display: 'table-cell' }}>
                          Preventive Action
                        </th>
                      </tr>
                    </thead>
                    <tbody style={{ display: 'table-row-group' }}>
                      {/* Department-wise Sections */}
                      {reportData.departments.map((deptData, deptIndex) => (
                        <React.Fragment key={deptIndex}>
                          {/* Department Header Row */}
                          <tr
                            className="dept-header"
                            style={{
                              backgroundColor: '#dbeafe',
                              pageBreakAfter: 'avoid',
                              breakAfter: 'avoid',
                              display: 'table-row',
                            }}
                          >
                            <td
                              colSpan="6"
                              className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 font-bold text-sm print:text-xs"
                              style={{
                                border: '1.5px solid #1e293b',
                                fontWeight: 'bold',
                                backgroundColor: '#dbeafe',
                                display: 'table-cell',
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                                <div>
                                  <span className="font-bold">
                                    {deptData.department.name} ({deptData.department.code})
                                  </span>
                                  {deptData.form?.name && (
                                    <span className="text-xs print:text-[9px] font-normal text-slate-600 ml-2">
                                      - {deptData.form.name}
                                    </span>
                                  )}
                                </div>
                                {deptData.submittedBy && deptData.submittedAt && (
                                  <div className="text-xs print:text-[9px] font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                    <span className="font-bold">Submitted by:</span> {deptData.submittedBy.name} | <span className="font-bold">Date:</span> {new Date(deptData.submittedAt).toLocaleString('en-GB', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                )}
                                {!deptData.submittedBy && (
                                  <span className="text-xs print:text-[9px] font-normal text-slate-500 italic">
                                    Not submitted yet
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Sections */}
                          {deptData.sections.map((section, sectionIndex) => (
                            <React.Fragment key={sectionIndex}>
                              {/* Section Header Row */}
                              <tr
                                className="section-header"
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  pageBreakAfter: 'avoid',
                                  breakAfter: 'avoid',
                                  display: 'table-row',
                                }}
                              >
                                <td
                                  colSpan="6"
                                  className="border border-slate-800 px-2 py-2 print:px-1.5 print:py-1.5 font-semibold text-xs print:text-[10px]"
                                  style={{
                                    border: '1.5px solid #1e293b',
                                    fontWeight: '600',
                                    backgroundColor: '#f1f5f9',
                                    display: 'table-cell',
                                  }}
                                >
                                  {section.sectionName}
                                </td>
                              </tr>

                              {/* Checklist Items */}
                              {section.items.map((item, itemIndex) => {
                                const label = item.checklistItemId?.label || 'N/A'
                                const responseType = item.checklistItemId?.responseType || 'YES_NO'
                                const isTextType = responseType === 'TEXT'
                                const responseValue = item.responseValue || item.yesNoNa || ''
                                const isYes = !isTextType && (responseValue === 'YES' || responseValue === 'Yes' || responseValue === 'yes')
                                const isNo = !isTextType && (responseValue === 'NO' || responseValue === 'No' || responseValue === 'no')
                                const remarks = item.remarks || '-'

                                // For TEXT type, render a single row spanning all columns
                                if (isTextType) {
                                  return (
                                    <tr
                                      key={itemIndex}
                                      style={{
                                        backgroundColor: itemIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                                        display: 'table-row',
                                        pageBreakInside: 'avoid',
                                        breakInside: 'avoid',
                                      }}
                                    >
                                      <td
                                        colSpan="6"
                                        className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-slate-700"
                                        style={{
                                          border: '1.5px solid #1e293b',
                                          verticalAlign: 'top',
                                          lineHeight: '1.4',
                                          display: 'table-cell',
                                          wordWrap: 'break-word',
                                          overflowWrap: 'break-word',
                                        }}
                                      >
                                        <div style={{ marginBottom: '4px', fontWeight: '500' }}>
                                          <span style={{ fontWeight: '500' }}>{itemIndex + 1}.</span> {label}
                                        </div>
                                        <div
                                          style={{
                                            backgroundColor: '#e0f2fe',
                                            border: '1px solid #0284c7',
                                            borderRadius: '4px',
                                            padding: '8px',
                                            marginTop: '4px',
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                            overflowWrap: 'break-word',
                                            fontStyle: 'italic',
                                            fontSize: '9pt',
                                            lineHeight: '1.4',
                                          }}
                                          className="print:text-[8pt]"
                                        >
                                          {responseValue || 'N/A'}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                }

                                // For YES_NO type, render normal row
                                return (
                                  <tr
                                    key={itemIndex}
                                    style={{
                                      backgroundColor: itemIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                                      display: 'table-row',
                                      pageBreakInside: 'avoid',
                                      breakInside: 'avoid',
                                    }}
                                  >
                                    <td
                                      className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-slate-700"
                                      style={{
                                        border: '1.5px solid #1e293b',
                                        verticalAlign: 'top',
                                        lineHeight: '1.4',
                                        display: 'table-cell',
                                        wordWrap: 'break-word',
                                        overflowWrap: 'break-word',
                                      }}
                                    >
                                      <span style={{ fontWeight: '500' }}>{itemIndex + 1}.</span> {label}
                                    </td>
                                    <td
                                      className="border border-slate-800 px-1 py-2.5 print:px-0.5 print:py-2 text-center checkbox-cell"
                                      style={{
                                        border: '1.5px solid #1e293b',
                                        verticalAlign: 'middle',
                                        display: 'table-cell',
                                      }}
                                    >
                                      <div
                                        className="w-5 h-5 mx-auto border-2 border-slate-800 flex items-center justify-center print:w-4 print:h-4"
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          border: '2px solid #1e293b',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          margin: '0 auto',
                                          backgroundColor: isYes ? '#e5e7eb' : 'white',
                                        }}
                                      >
                                        {isYes && <span className="text-xs print:text-[10px]" style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>✓</span>}
                                      </div>
                                    </td>
                                    <td
                                      className="border border-slate-800 px-1 py-2.5 print:px-0.5 print:py-2 text-center checkbox-cell"
                                      style={{
                                        border: '1.5px solid #1e293b',
                                        verticalAlign: 'middle',
                                        display: 'table-cell',
                                      }}
                                    >
                                      <div
                                        className="w-5 h-5 mx-auto border-2 border-slate-800 flex items-center justify-center print:w-4 print:h-4"
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          border: '2px solid #1e293b',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          margin: '0 auto',
                                          backgroundColor: isNo ? '#e5e7eb' : 'white',
                                        }}
                                      >
                                        {isNo && <span className="text-xs print:text-[10px]" style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>✓</span>}
                                      </div>
                                    </td>
                                    <td
                                      className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-slate-700 text-[10px] print:text-[8px]"
                                      style={{
                                        border: '1.5px solid #1e293b',
                                        verticalAlign: 'top',
                                        lineHeight: '1.3',
                                        wordWrap: 'break-word',
                                        overflowWrap: 'break-word',
                                        display: 'table-cell',
                                        maxWidth: '20%',
                                      }}
                                    >
                                      <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                        {remarks}
                                      </div>
                                    </td>
                                    <td
                                      className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-slate-700 text-[10px] print:text-[8px]"
                                      style={{
                                        border: '1.5px solid #1e293b',
                                        verticalAlign: 'top',
                                        lineHeight: '1.3',
                                        display: 'table-cell',
                                        wordWrap: 'break-word',
                                        overflowWrap: 'break-word',
                                        maxWidth: '15%',
                                      }}
                                    >
                                      <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word', fontStyle: item.corrective ? 'normal' : 'italic', color: item.corrective ? 'inherit' : '#94a3b8' }}>
                                        {item.corrective || '—'}
                                      </div>
                                    </td>
                                    <td
                                      className="border border-slate-800 px-2 py-2.5 print:px-1.5 print:py-2 text-slate-700 text-[10px] print:text-[8px]"
                                      style={{
                                        border: '1.5px solid #1e293b',
                                        verticalAlign: 'top',
                                        lineHeight: '1.3',
                                        display: 'table-cell',
                                        wordWrap: 'break-word',
                                        overflowWrap: 'break-word',
                                        maxWidth: '15%',
                                      }}
                                    >
                                      <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word', fontStyle: item.preventive ? 'normal' : 'italic', color: item.preventive ? 'inherit' : '#94a3b8' }}>
                                        {item.preventive || '—'}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="mt-6 print:mt-4 pt-4 print:pt-3 border-t border-slate-300 text-center">
                  <p className="text-xs print:text-[9px] text-slate-600">
                    Generated on {new Date().toLocaleString('en-GB')} | APDCH - Dental General Checklist
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
