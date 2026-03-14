const Asset = require('../models/Asset');

exports.list = async (req, res) => {
  try {
    const activeOnly = req.query.isActive !== 'false';
    const locationId = req.query.locationId;
    const filter = activeOnly ? { isActive: true } : {};
    if (locationId) filter.locationId = locationId;
    const list = await Asset.find(filter)
      .populate('locationId', 'areaName building floor code')
      .sort({ name: 1 });
    res.json(list);
  } catch (err) {
    console.error('assetController.list error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
