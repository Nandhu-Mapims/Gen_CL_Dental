import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '../../api/client'

const LOCATION_TYPES = ['ZONE', 'FLOOR', 'WARD', 'ROOM', 'UNIT', 'OTHER']

const LOCATION_TYPE_LABELS = {
  ZONE: 'Zone (e.g. Zone A, Zone B)',
  FLOOR: 'Floor (e.g. Ground Floor, 1st Floor)',
  WARD: 'Ward (e.g. ICU Ward, General Ward)',
  ROOM: 'Room / Bay',
  UNIT: 'Unit / Station',
  OTHER: 'Other',
}

const LOCATION_TYPE_ICONS = {
  ZONE: '🗂️',
  FLOOR: '🏢',
  WARD: '🏥',
  ROOM: '🚪',
  UNIT: '📍',
  OTHER: '📌',
}

const emptyForm = {
  areaName: '',
  code: '',
  locationType: 'ZONE',
  parentId: '',
  zone: '',
  floor: '',
  building: '',
  description: '',
  isActive: true,
  order: 0,
}

export function LocationManagement() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [filterType, setFilterType] = useState('')
  const [message, setMessage] = useState({ text: '', type: '' })
  const [floorsUnderZone, setFloorsUnderZone] = useState([])
  const [loadingFloors, setLoadingFloors] = useState(false)

  useEffect(() => {
    loadLocations()
  }, [])

  // Fetch floors under the selected zone from DB (no hardcoded list)
  useEffect(() => {
    if (!formData.parentId) {
      setFloorsUnderZone([])
      return
    }
    let cancelled = false
    setLoadingFloors(true)
    apiClient
      .get(`/locations?parentId=${formData.parentId}&isActive=true`)
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setFloorsUnderZone(list.filter((loc) => loc.locationType === 'FLOOR'))
      })
      .catch(() => {
        if (!cancelled) setFloorsUnderZone([])
      })
      .finally(() => {
        if (!cancelled) setLoadingFloors(false)
      })
    return () => { cancelled = true }
  }, [formData.parentId])

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 3000)
  }

  const loadLocations = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/locations?isActive=false')
      setLocations(Array.isArray(data) ? data : [])
    } catch (err) {
      showMsg('Error loading locations: ' + (err.response?.data?.message || err.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const needsZoneFirst = ['FLOOR', 'WARD', 'ROOM', 'UNIT'].includes(formData.locationType)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.areaName.trim()) {
      showMsg('Area name is required', 'error')
      return
    }
    if (needsZoneFirst && !formData.parentId) {
      showMsg('Select a zone first. Floors and areas must belong to a zone.', 'error')
      return
    }
    try {
      const payload = {
        areaName: formData.areaName.trim(),
        code: formData.code.trim() || undefined,
        locationType: formData.locationType,
        parentId: formData.parentId || undefined,
        zone: formData.zone.trim() || undefined,
        floor: formData.floor.trim() || undefined,
        building: formData.building.trim() || undefined,
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
        order: parseInt(formData.order) || 0,
      }
      if (editingId) {
        await apiClient.put(`/locations/${editingId}`, payload)
        showMsg('Location updated successfully')
      } else {
        await apiClient.post('/locations', payload)
        showMsg('Location created successfully')
      }
      setFormData(emptyForm)
      setEditingId(null)
      loadLocations()
    } catch (err) {
      showMsg('Error: ' + (err.response?.data?.message || err.message), 'error')
    }
  }

  const handleEdit = (loc) => {
    const parentId = loc.parent?._id ?? loc.parent ?? ''
    setFormData({
      areaName: loc.areaName || '',
      code: loc.code || '',
      locationType: loc.locationType || 'OTHER',
      parentId: typeof parentId === 'string' ? parentId : (parentId?.toString?.() ?? ''),
      zone: loc.zone || '',
      floor: loc.floor || '',
      building: loc.building || '',
      description: loc.description || '',
      isActive: loc.isActive !== false,
      order: loc.order || 0,
    })
    setEditingId(loc._id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete location "${name}"? This cannot be undone.`)) return
    try {
      await apiClient.delete(`/locations/${id}`)
      showMsg('Location deleted')
      loadLocations()
    } catch (err) {
      showMsg('Error deleting: ' + (err.response?.data?.message || err.message), 'error')
    }
  }

  const handleCancel = () => {
    setFormData(emptyForm)
    setEditingId(null)
  }

  const filteredLocations = filterType
    ? locations.filter((l) => l.locationType === filterType)
    : locations

  // Zones only — for "Parent (Zone)" dropdown so a zone can have multiple floors
  const zoneLocations = useMemo(
    () => locations.filter((l) => l.locationType === 'ZONE'),
    [locations]
  )

  const getDisplayLabel = (loc) => {
    const parts = [
      loc.zone && `Zone: ${loc.zone}`,
      loc.floor && `Floor: ${loc.floor}`,
      loc.building && `Block: ${loc.building}`,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  const getParentName = (loc) => {
    const p = loc.parent
    if (!p) return null
    return typeof p === 'object' && p.areaName ? p.areaName : null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-4 sm:py-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Location Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          <strong>Select zone first, then create.</strong> Create zones (e.g. Zone A, B, C), then add floors and areas under each zone. Locations appear when submitting checklists.
        </p>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium border ${
            message.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Quick-add preset zones */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Quick-add common location types:</p>
        <div className="flex flex-wrap gap-2">
          {['Zone A', 'Zone B', 'Zone C', 'Ground Floor', '1st Floor', '2nd Floor', 'ICU', 'OT', 'Emergency', 'OPD'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const isZone = preset.startsWith('Zone')
                const isFloor = preset.includes('Floor')
                setFormData({
                  ...emptyForm,
                  areaName: preset,
                  locationType: isZone ? 'ZONE' : isFloor ? 'FLOOR' : 'WARD',
                  zone: isZone ? preset : '',
                  floor: isFloor ? preset : '',
                  code: preset.replace(/\s+/g, '-').toUpperCase(),
                })
                setEditingId(null)
              }}
              className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          {editingId ? '✏️ Edit Location' : '➕ Add New Location'}
        </h3>
        {needsZoneFirst && zoneLocations.length === 0 && !editingId && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Create a <strong>Zone</strong> first (e.g. Zone A, Zone B). Then you can add floors and areas under that zone.
          </div>
        )}
        {formData.locationType === 'ZONE' && !editingId && zoneLocations.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>To add an underzone</strong> (floor/area under a zone): change Location Type to <strong>Floor</strong>, <strong>Ward</strong>, <strong>Room</strong> or <strong>Unit</strong> — then you’ll see “Select zone first” and can pick the parent zone.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Location Type — choose first */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Location Type</label>
              <select
                value={formData.locationType}
                onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LOCATION_TYPE_ICONS[t]} {t} — {LOCATION_TYPE_LABELS[t].split('(')[0].trim()}
                  </option>
                ))}
              </select>
            </div>

            {/* Under zone — select parent zone when adding Floor/Ward/Room/Unit */}
            {needsZoneFirst && (
              <div className={zoneLocations.length === 0 ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Under zone (parent) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.parentId || ''}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value, floor: '' })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 ${
                    needsZoneFirst && !formData.parentId ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'
                  }`}
                  required={needsZoneFirst}
                >
                  <option value="">— Choose a zone —</option>
                  {zoneLocations.map((z) => (
                    <option key={z._id} value={z._id}>
                      {z.areaName} {z.zone ? `(${z.zone})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  This location will appear under the selected zone. Pick the zone first, then enter the area name below.
                </p>
              </div>
            )}

            {/* Area Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Area Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.areaName}
                onChange={(e) => setFormData({ ...formData, areaName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder={formData.locationType === 'ZONE' ? 'e.g. Zone A, Zone B' : 'e.g. Floor 1, Ground Floor, ICU Ward'}
                required
              />
            </div>

            {/* Short Code */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Code <span className="text-xs text-slate-500">(optional, unique)</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 uppercase"
                placeholder="e.g. ZONE-A, GF, ICU"
                maxLength={20}
              />
            </div>

            {/* Zone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Zone <span className="text-xs text-slate-500">(e.g. Zone A)</span>
              </label>
              <input
                type="text"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="Zone A, Zone B, Zone C…"
              />
            </div>

            {/* Floor: when WARD/ROOM/UNIT — select floor (from DB). When FLOOR — you are creating the floor, name it in Area Name. */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Floor <span className="text-xs text-slate-500">
                  {formData.locationType === 'FLOOR' ? '(optional label, e.g. 1 or Ground)' : '(select floor under zone)'}
                </span>
              </label>
              {formData.locationType === 'FLOOR' ? (
                <input
                  type="text"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                  placeholder="e.g. 1, Ground, 2nd"
                />
              ) : formData.parentId ? (
                <>
                  <select
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                    disabled={loadingFloors}
                  >
                    <option value="">— Select floor —</option>
                    {formData.floor && !floorsUnderZone.some((l) => (l.areaName ?? l.floor) === formData.floor) && (
                      <option value={formData.floor}>{formData.floor}</option>
                    )}
                    {floorsUnderZone.map((loc) => {
                      const val = loc.areaName ?? loc.floor ?? ''
                      return (
                        <option key={loc._id} value={val}>
                          {loc.areaName || loc.floor || loc.code || loc._id}
                        </option>
                      )
                    })}
                  </select>
                  {floorsUnderZone.length === 0 && !loadingFloors && (
                    <p className="mt-1 text-xs text-slate-500">No floors under this zone yet. Add a floor (Location Type = Floor) under this zone first.</p>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={formData.floor}
                  readOnly
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500"
                  placeholder="Select zone first, then select floor"
                />
              )}
            </div>

            {/* Building / Block */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Building / Block <span className="text-xs text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="Block A, Main Building…"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description <span className="text-xs text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                placeholder="Brief description of this location"
              />
            </div>

            {/* Order */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Display Order</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500"
                min={0}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="locIsActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-maroon-700 border-slate-300 rounded focus:ring-2 focus:ring-maroon-500"
            />
            <label htmlFor="locIsActive" className="text-sm text-slate-700">Active</label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="bg-gradient-to-r from-maroon-600 to-maroon-600 hover:from-maroon-700 hover:to-maroon-700 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
            >
              {editingId ? 'Update Location' : 'Add Location'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filter + List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold text-slate-800">
            Locations ({filteredLocations.length}{filterType ? ` · ${filterType}` : ''})
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 font-medium">Filter by type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-maroon-500"
            >
              <option value="">All Types</option>
              {LOCATION_TYPES.map((t) => (
                <option key={t} value={t}>{LOCATION_TYPE_ICONS[t]} {t}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : filteredLocations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {filterType ? `No ${filterType} locations found.` : 'No locations added yet. Use the form above to add one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-700 w-8">#</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Area Name</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Type</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Under zone</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Zone / Floor / Block</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Code</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Order</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((loc, idx) => (
                  <tr key={loc._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{loc.areaName}</div>
                      {loc.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{loc.description}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                        {LOCATION_TYPE_ICONS[loc.locationType] || '📌'} {loc.locationType || 'OTHER'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {getParentName(loc) ? (
                        <span className="text-maroon-700 font-medium">└ {getParentName(loc)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {getDisplayLabel(loc) || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-3 text-xs font-mono text-slate-600">
                      {loc.code || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-3 text-center text-slate-600">{loc.order ?? 0}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          loc.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(loc)}
                          className="text-maroon-700 hover:text-maroon-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(loc._id, loc.areaName)}
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
