import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

export function ExportSubmissions() {
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportData, setExportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      const data = await apiClient.get('/departments')
      setDepartments(data)
    } catch (err) {
      console.error('Error loading departments', err)
    }
  }

  const handleExport = async (format = 'json') => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedDepartment) params.append('departmentId', selectedDepartment)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('format', format)

      if (format === 'csv') {
        // CSV download
        const response = await fetch(`/api/audits/export?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to export CSV' }))
          throw new Error(errorData.message || `Export failed: ${response.statusText}`)
        }
        
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_submissions_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // JSON data for preview
        const data = await apiClient.get(`/audits/export?${params.toString()}`)
        setExportData(data)
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to export data'
      alert(`Error exporting data: ${errorMessage}`)
      console.error('Export error:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Export Submissions</h2>
        <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1">
          Export audit submissions with filters (Department, Date Range)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-5 md:p-6 border border-maroon-100">
        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
          Filter Options
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
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
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
          </div>
        </div>

        {/* Export Buttons */}
        <div className="mt-4 sm:mt-5 md:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={() => handleExport('csv')}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            {loading ? 'Exporting...' : '📊 Export as CSV'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            {loading ? 'Loading...' : '👁️ Preview Data'}
          </button>
        </div>
      </div>

      {/* Preview Data */}
      {exportData && (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-5 md:p-6 border border-maroon-100">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800">
              Preview Data ({exportData.totalRecords} records)
            </h3>
            <button
              onClick={() => setExportData(null)}
              className="text-maroon-600 hover:text-maroon-700 text-xs sm:text-sm"
            >
              Close
            </button>
          </div>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full min-w-[1200px] text-xs sm:text-sm">
              <thead className="bg-maroon-50">
                <tr>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700 w-12">#</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Department</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Session ID</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Reference</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Response</th>
                  <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700">Submitted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {exportData.data.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-maroon-50">
                    <td className="px-2 sm:px-3 py-2 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="px-2 sm:px-3 py-2">{row['Submission Date']}</td>
                    <td className="px-2 sm:px-3 py-2">{row['Department']}</td>
                    <td className="px-2 sm:px-3 py-2">{row['UHID'] || row['Session ID'] || '—'}</td>
                    <td className="px-2 sm:px-3 py-2">{row['Patient Name'] || row['Reference'] || '—'}</td>
                    <td className="px-2 sm:px-3 py-2">{row['Checklist Item']}</td>
                    <td className="px-2 sm:px-3 py-2">{row['Response Value']}</td>
                    <td className="px-2 sm:px-3 py-2">{row['Submitted By']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {exportData.data.length > 50 && (
              <p className="text-xs sm:text-sm text-slate-500 mt-2 text-center">
                Showing first 50 of {exportData.totalRecords} records. Export to see all data.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

