import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

export function UnitListManagement() {
  const [units, setUnits] = useState([])
  const [fullData, setFullData] = useState(null)
  const [newUnit, setNewUnit] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/master-data')
      setFullData(data)
      setUnits(data.units || [])
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load unit list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = () => {
    const val = newUnit.trim()
    if (val && !units.includes(val)) {
      setUnits((prev) => [...prev, val])
      setNewUnit('')
    }
  }

  const handleRemove = (index) => {
    setUnits((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await apiClient.put('/master-data', {
        designations: fullData?.designations || [],
        wards: fullData?.wards || [],
        units,
      })
      setMessage('Unit list saved successfully.')
      setTimeout(() => setMessage(''), 3000)
      setFullData((prev) => (prev ? { ...prev, units } : { designations: [], wards: [], units }))
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Unit No List</h2>
        <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1">
          Add or remove units. These appear in the Unit No dropdown on audit forms.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.includes('success') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Units</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
              placeholder="e.g. Unit 1, Unit 2"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg text-sm font-medium"
            >
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {units.length === 0 ? (
              <li className="text-sm text-slate-500 italic">No units added yet</li>
            ) : (
              units.map((unit, index) => (
                <li
                  key={`${unit}-${index}`}
                  className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-slate-800">{unit}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 disabled:opacity-60 text-white rounded-lg font-medium shadow-sm"
          >
            {saving ? 'Saving...' : 'Save unit list'}
          </button>
        </div>
      </div>
    </div>
  )
}
