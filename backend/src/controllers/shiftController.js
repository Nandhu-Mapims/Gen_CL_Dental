const Shift = require('../models/Shift');

exports.list = async (req, res) => {
  try {
    const activeOnly = req.query.isActive !== 'false';
    const filter = activeOnly ? { isActive: true } : {};
    const list = await Shift.find(filter).sort({ startTime: 1, name: 1 });
    res.json(list);
  } catch (err) {
    console.error('shiftController.list error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
