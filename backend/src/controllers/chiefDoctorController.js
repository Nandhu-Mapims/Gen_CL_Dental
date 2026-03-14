const ChiefDoctor = require('../models/ChiefDoctor');
const Department = require('../models/Department');

// Admin: Create unit supervisor
exports.createChiefDoctor = async (req, res) => {
  try {
    const { name, designation, departmentId, isActive, order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const data = {
      name: name.trim(),
      designation: designation?.trim() || 'Unit Supervisor',
      isActive: isActive !== undefined ? isActive : true,
      order: order !== undefined ? order : 0,
    };

    if (departmentId) {
      const dept = await Department.findById(departmentId);
      if (!dept) {
        return res.status(400).json({ message: 'Invalid department' });
      }
      data.department = departmentId;
    }

    const chiefDoctor = await ChiefDoctor.create(data);
    await chiefDoctor.populate('department', 'name code');

    res.status(201).json(chiefDoctor);
  } catch (err) {
    console.error('createChiefDoctor error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// List all unit supervisors (or by department)
exports.listChiefDoctors = async (req, res) => {
  try {
    const { departmentId, isActive } = req.query;
    const filter = {};

    if (departmentId) {
      filter.$or = [
        { department: departmentId },
        { department: { $exists: false } },
        { department: null },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const chiefDoctors = await ChiefDoctor.find(filter)
      .populate('department', 'name code')
      .sort({ order: 1, name: 1 });

    res.json(chiefDoctors);
  } catch (err) {
    console.error('listChiefDoctors error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Update unit supervisor
exports.updateChiefDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, designation, departmentId, isActive, order } = req.body;

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (designation !== undefined) update.designation = designation.trim() || 'Unit Supervisor';
    if (isActive !== undefined) update.isActive = isActive;
    if (order !== undefined) update.order = order;

    if (departmentId !== undefined) {
      if (departmentId) {
        const dept = await Department.findById(departmentId);
        if (!dept) {
          return res.status(400).json({ message: 'Invalid department' });
        }
        update.department = departmentId;
      } else {
        update.department = null;
      }
    }

    const chiefDoctor = await ChiefDoctor.findByIdAndUpdate(id, update, { new: true })
      .populate('department', 'name code');

    if (!chiefDoctor) {
      return res.status(404).json({ message: 'Unit supervisor not found' });
    }

    res.json(chiefDoctor);
  } catch (err) {
    console.error('updateChiefDoctor error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Delete unit supervisor
exports.deleteChiefDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const chiefDoctor = await ChiefDoctor.findByIdAndDelete(id);

    if (!chiefDoctor) {
      return res.status(404).json({ message: 'Unit supervisor not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('deleteChiefDoctor error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
