import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'

export function WardListManagement() {
  const [wards, setWards] = useState([])
  const [fullData, setFullData] = useState(null)
  const [newWard, setNewWard] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/master-data')
      setFullData(data)
      setWards(data.wards || [])
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to load ward list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = () => {
    const val = newWard.trim()
    if (val && !wards.includes(val)) {
      setWards((prev) => [...prev, val])
      setNewWard('')
    }
  }

  const handleRemove = (index) => {
    setWards((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await apiClient.put('/master-data', {
        designations: fullData?.designations || [],
        wards,
        units: fullData?.units || [],
      })
      setMessage('Ward list saved successfully.')
      setTimeout(() => setMessage(''), 3000)
      setFullData((prev) => (prev ? { ...prev, wards } : { designations: [], wards, units: [] }))
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
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Ward List</h2>
        <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1">
          Add or remove wards. These appear in the Ward dropdown on audit forms.
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
          <h3 className="font-semibold text-slate-800">Wards</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newWard}
              onChange={(e) => setNewWard(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
              placeholder="e.g. A1, ICU"
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
            {wards.length === 0 ? (
              <li className="text-sm text-slate-500 italic">No wards added yet</li>
            ) : (
              wards.map((ward, index) => (
                <li
                  key={`${ward}-${index}`}
                  className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-slate-800">{ward}</span>
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
            {saving ? 'Saving...' : 'Save ward list'}
          </button>
        </div>
      </div>
    </div>
  )
}
