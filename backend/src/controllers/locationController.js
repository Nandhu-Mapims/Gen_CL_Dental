const Location = require('../models/Location');

exports.list = async (req, res) => {
  try {
    const activeOnly = req.query.isActive !== 'false';
    const filter = activeOnly ? { isActive: true } : {};
    if (req.query.locationType) filter.locationType = req.query.locationType;
    if (req.query.parentId !== undefined) {
      filter.parent = req.query.parentId === '' || req.query.parentId === 'null' ? null : req.query.parentId;
    }
    // Location dropdown: admin-created locations; user selects type first (ZONE/FLOOR/WARD/UNIT/ROOM).
    if (req.query.selectable === 'true') {
      filter.$or = [
        { parent: { $exists: true, $ne: null } },
        { locationType: { $in: ['ZONE', 'FLOOR', 'WARD', 'ROOM', 'UNIT'] } },
      ];
    }
    const list = await Location.find(filter)
      .populate('parent', 'areaName code locationType zone floor')
      .sort({ order: 1, areaName: 1 });
    res.json(list);
  } catch (err) {
    console.error('locationController.list error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { areaName, code, locationType, parentId, zone, floor, building, description, isActive, order } = req.body;
    if (!areaName || !areaName.trim()) {
      return res.status(400).json({ message: 'Area name is required' });
    }
    const data = {
      areaName: areaName.trim(),
      locationType: locationType || 'OTHER',
      isActive: isActive !== undefined ? isActive : true,
      order: order !== undefined ? parseInt(order) : 0,
    };
    if (code) data.code = code.trim().toUpperCase();
    if (parentId !== undefined && parentId !== null && parentId !== '') data.parent = parentId;
    else data.parent = null;
    if (zone) data.zone = zone.trim();
    if (floor) data.floor = floor.trim();
    if (building) data.building = building.trim();
    if (description) data.description = description.trim();

    const location = await Location.create(data);
    await location.populate('parent', 'areaName code locationType zone floor');
    res.status(201).json(location);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A location with this code already exists' });
    }
    console.error('locationController.create error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { areaName, code, locationType, parentId, zone, floor, building, description, isActive, order } = req.body;
    const update = {};
    if (areaName !== undefined) update.areaName = areaName.trim();
    if (code !== undefined) update.code = code ? code.trim().toUpperCase() : null;
    if (locationType !== undefined) update.locationType = locationType;
    if (parentId !== undefined) update.parent = parentId === '' || parentId === null ? null : parentId;
    if (zone !== undefined) update.zone = zone ? zone.trim() : '';
    if (floor !== undefined) update.floor = floor ? floor.trim() : '';
    if (building !== undefined) update.building = building ? building.trim() : '';
    if (description !== undefined) update.description = description ? description.trim() : '';
    if (isActive !== undefined) update.isActive = isActive;
    if (order !== undefined) update.order = parseInt(order);

    const location = await Location.findByIdAndUpdate(id, update, { new: true })
      .populate('parent', 'areaName code locationType zone floor');
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.json(location);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A location with this code already exists' });
    }
    console.error('locationController.update error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const location = await Location.findByIdAndDelete(id);
    if (!location) return res.status(404).json({ message: 'Location not found' });
    res.status(204).send();
  } catch (err) {
    console.error('locationController.remove error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
