const Admission = require('../models/Admission');

/**
 * Generate unique IPID (In-Patient ID) for each admission
 * Format: IP-YYYY-MM-XXXXX
 * Example: IP-2024-01-00001, IP-2024-03-00001
 * 
 * @returns {Promise<string>} Generated IPID
 */
async function generateIPID() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `IP-${year}-${month}-`;

  // Find the highest sequence number for this month
  const lastAdmission = await Admission.findOne({
    ipid: { $regex: `^${prefix}` },
  })
    .sort({ ipid: -1 })
    .select('ipid')
    .lean();

  let sequence = 1;
  if (lastAdmission) {
    // Extract sequence number from last IPID
    const lastSequence = parseInt(lastAdmission.ipid.split('-')[3] || '0');
    sequence = lastSequence + 1;
  }

  // Format sequence with leading zeros (5 digits)
  const sequenceStr = String(sequence).padStart(5, '0');
  const ipid = `${prefix}${sequenceStr}`;

  // Double-check uniqueness (race condition protection)
  const exists = await Admission.findOne({ ipid });
  if (exists) {
    // If exists, increment sequence and try again
    sequence++;
    const sequenceStr = String(sequence).padStart(5, '0');
    const newIpid = `${prefix}${sequenceStr}`;
    return newIpid;
  }

  return ipid;
}

/**
 * Get active admission for a patient (if any)
 * @param {string} uhid - Patient UHID
 * @returns {Promise<Object|null>} Active admission or null
 */
async function getActiveAdmission(uhid) {
  const normalizedUHID = uhid.trim().toUpperCase();
  return await Admission.findOne({
    uhid: normalizedUHID,
    status: 'Admitted',
    dischargeDate: null,
  }).sort({ admissionDate: -1 });
}

/**
 * Get all admissions for a patient
 * @param {string} uhid - Patient UHID
 * @returns {Promise<Array>} List of admissions
 */
async function getPatientAdmissions(uhid) {
  const normalizedUHID = uhid.trim().toUpperCase();
  return await Admission.find({
    uhid: normalizedUHID,
  })
    .sort({ admissionDate: -1 })
    .populate('patient', 'uhid patientName')
    .populate('department', 'name code');
}

module.exports = {
  generateIPID,
  getActiveAdmission,
  getPatientAdmissions,
};

