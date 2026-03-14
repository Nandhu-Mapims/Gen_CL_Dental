const Patient = require('../models/Patient');

// Get patient by UHID
exports.getPatientByUHID = async (req, res) => {
  try {
    const { uhid } = req.params;
    
    if (!uhid || !uhid.trim()) {
      return res.status(400).json({ message: 'UHID is required' });
    }

    const normalizedUHID = uhid.trim().toUpperCase();
    const patient = await Patient.findOne({ uhid: normalizedUHID });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json(patient);
  } catch (err) {
    console.error('getPatientByUHID error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all patients (admin only, with pagination)
exports.getAllPatients = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { uhid: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
      ];
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Patient.countDocuments(filter),
    ]);

    res.json({
      patients,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('getAllPatients error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

