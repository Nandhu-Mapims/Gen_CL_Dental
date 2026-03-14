const Admission = require('../models/Admission');
const Patient = require('../models/Patient');
const { getActiveAdmission, getPatientAdmissions } = require('../utils/ipidGenerator');

// Create new admission
exports.createAdmission = async (req, res) => {
  try {
    const { ipid, uhid, patientName, ward, unitNo, admissionDate, admissionType, departmentId, diagnosis, admittingDoctor } = req.body;

    if (!ipid || !uhid || !ward || !unitNo) {
      return res.status(400).json({ message: 'IPID, UHID, Ward, and Unit No are required' });
    }

    const normalizedIPID = ipid.trim().toUpperCase();
    const normalizedUHID = uhid.trim().toUpperCase();

    // Check if IPID already exists
    const existingAdmission = await Admission.findOne({ ipid: normalizedIPID });
    if (existingAdmission) {
      return res.status(400).json({ 
        message: 'IPID already exists',
        existingAdmission: {
          ipid: existingAdmission.ipid,
          uhid: existingAdmission.uhid,
          admissionDate: existingAdmission.admissionDate,
          status: existingAdmission.status,
        }
      });
    }

    // Find or create patient
    let patient = await Patient.findOne({ uhid: normalizedUHID });
    if (!patient) {
      if (!patientName) {
        return res.status(400).json({ message: 'Patient name is required for new patients' });
      }
      patient = await Patient.create({
        uhid: normalizedUHID,
        patientName: patientName.trim(),
      });
    }

    // Create admission with user-provided IPID
    const admission = await Admission.create({
      ipid: normalizedIPID,
      patient: patient._id,
      uhid: normalizedUHID,
      admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
      ward: ward.trim(),
      unitNo: unitNo.trim(),
      admissionType: admissionType || 'Elective',
      status: 'Admitted',
      department: departmentId || undefined,
      diagnosis: diagnosis || undefined,
      admittingDoctor: admittingDoctor || undefined,
    });

    await admission.populate('patient', 'uhid patientName');
    await admission.populate('department', 'name code');

    res.status(201).json(admission);
  } catch (err) {
    console.error('createAdmission error', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'IPID already exists. Please use a different IPID.' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Discharge patient
exports.dischargeAdmission = async (req, res) => {
  try {
    const { ipid } = req.params;
    const { dischargeDate } = req.body;

    if (!ipid) {
      return res.status(400).json({ message: 'IPID is required' });
    }

    const admission = await Admission.findOne({ 
      ipid: ipid.trim().toUpperCase(),
      status: 'Admitted'
    });

    if (!admission) {
      return res.status(404).json({ message: 'Active admission not found' });
    }

    admission.dischargeDate = dischargeDate ? new Date(dischargeDate) : new Date();
    admission.status = 'Discharged';
    await admission.save();

    await admission.populate('patient', 'uhid patientName');
    await admission.populate('department', 'name code');

    res.json(admission);
  } catch (err) {
    console.error('dischargeAdmission error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get admission by IPID
exports.getAdmissionByIPID = async (req, res) => {
  try {
    const { ipid } = req.params;

    if (!ipid) {
      return res.status(400).json({ message: 'IPID is required' });
    }

    const admission = await Admission.findOne({ 
      ipid: ipid.trim().toUpperCase() 
    })
      .populate('patient', 'uhid patientName dateOfBirth gender contactNumber address')
      .populate('department', 'name code');

    if (!admission) {
      return res.status(404).json({ message: 'Admission not found' });
    }

    res.json(admission);
  } catch (err) {
    console.error('getAdmissionByIPID error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get all admissions for a patient (by UHID)
exports.getPatientAdmissions = async (req, res) => {
  try {
    const { uhid } = req.params;
    console.log('[getPatientAdmissions] Request received for UHID:', uhid);

    if (!uhid) {
      console.log('[getPatientAdmissions] UHID missing');
      return res.status(400).json({ message: 'UHID is required' });
    }

    const normalizedUHID = uhid.trim().toUpperCase();
    console.log('[getPatientAdmissions] Normalized UHID:', normalizedUHID);

    const admissions = await getPatientAdmissions(normalizedUHID);
    console.log('[getPatientAdmissions] Found', admissions.length, 'admissions');

    const response = {
      uhid: normalizedUHID,
      totalAdmissions: admissions.length,
      admissions,
    };
    
    console.log('[getPatientAdmissions] Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (err) {
    console.error('[getPatientAdmissions] Error:', err);
    console.error('[getPatientAdmissions] Error stack:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get active admission for a patient
exports.getActiveAdmission = async (req, res) => {
  try {
    const { uhid } = req.params;

    if (!uhid) {
      return res.status(400).json({ message: 'UHID is required' });
    }

    const admission = await getActiveAdmission(uhid);

    if (!admission) {
      return res.status(404).json({ message: 'No active admission found' });
    }

    await admission.populate('patient', 'uhid patientName dateOfBirth gender');
    await admission.populate('department', 'name code');

    res.json(admission);
  } catch (err) {
    console.error('getActiveAdmission error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get all admissions (with filters)
exports.getAllAdmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { ipid: { $regex: search, $options: 'i' } },
        { uhid: { $regex: search, $options: 'i' } },
      ];
    }

    const [admissions, total] = await Promise.all([
      Admission.find(filter)
        .populate('patient', 'uhid patientName')
        .populate('department', 'name code')
        .sort({ admissionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Admission.countDocuments(filter),
    ]);

    res.json({
      admissions,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('getAllAdmissions error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const DEFAULT_WARDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'ICU', 'CCU', 'Maternity'];
const DEFAULT_UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'];

exports.getWardsAndUnits = async (req, res) => {
  try {
    const MasterData = require('../models/MasterData');
    const doc = await MasterData.findOne({ key: 'default' }).lean();
    if (doc?.wards?.length > 0 && doc?.units?.length > 0) {
      return res.json({ wards: doc.wards, units: doc.units });
    }
    const [wardDocs, unitDocs] = await Promise.all([
      Admission.distinct('ward').then((arr) => arr.filter(Boolean).sort()),
      Admission.distinct('unitNo').then((arr) => arr.filter(Boolean).sort()),
    ]);
    const wards = wardDocs.length > 0 ? wardDocs : DEFAULT_WARDS;
    const units = unitDocs.length > 0 ? unitDocs : DEFAULT_UNITS;
    res.json({ wards, units });
  } catch (err) {
    console.error('getWardsAndUnits error', err);
    res.json({ wards: DEFAULT_WARDS, units: DEFAULT_UNITS });
  }
};

