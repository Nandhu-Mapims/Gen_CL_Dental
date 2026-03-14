const MasterData = require('../models/MasterData');

const DEFAULT_DESIGNATIONS = [
  'Quality Auditor',
  'Staff Auditor',
  'Unit Supervisor',
  'Department Head',
  'Quality Officer',
  'Infection Control Officer',
  'Nursing In-charge',
  'Other',
];
const DEFAULT_WARDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'ICU', 'CCU', 'Maternity'];
const DEFAULT_UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'];

async function getOrCreateMasterData() {
  let doc = await MasterData.findOne({ key: 'default' });
  if (!doc) {
    doc = await MasterData.create({
      key: 'default',
      designations: DEFAULT_DESIGNATIONS,
      wards: DEFAULT_WARDS,
      units: DEFAULT_UNITS,
    });
  }
  return doc;
}

exports.getMasterData = async (req, res) => {
  try {
    const doc = await getOrCreateMasterData();
    res.json({
      designations: doc.designations || DEFAULT_DESIGNATIONS,
      wards: doc.wards || DEFAULT_WARDS,
      units: doc.units || DEFAULT_UNITS,
    });
  } catch (err) {
    console.error('getMasterData error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMasterData = async (req, res) => {
  try {
    const { designations, wards, units } = req.body;
    let doc = await MasterData.findOne({ key: 'default' });
    if (!doc) {
      doc = await MasterData.create({
        key: 'default',
        designations: designations || DEFAULT_DESIGNATIONS,
        wards: wards || DEFAULT_WARDS,
        units: units || DEFAULT_UNITS,
      });
    } else {
      if (Array.isArray(designations)) doc.designations = designations.filter(Boolean).map((s) => String(s).trim());
      if (Array.isArray(wards)) doc.wards = wards.filter(Boolean).map((s) => String(s).trim());
      if (Array.isArray(units)) doc.units = units.filter(Boolean).map((s) => String(s).trim());
      await doc.save();
    }
    res.json({
      designations: doc.designations || [],
      wards: doc.wards || [],
      units: doc.units || [],
    });
  } catch (err) {
    console.error('updateMasterData error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addDesignation = async (req, res) => {
  try {
    const { designation } = req.body;
    if (!designation || !String(designation).trim()) {
      return res.status(400).json({ message: 'Designation is required' });
    }
    const value = String(designation).trim();
    const doc = await getOrCreateMasterData();
    if (doc.designations.includes(value)) {
      return res.json({ designations: doc.designations });
    }
    doc.designations.push(value);
    doc.designations.sort((a, b) => a.localeCompare(b));
    await doc.save();
    res.json({ designations: doc.designations });
  } catch (err) {
    console.error('addDesignation error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDesignation = async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Designation name required' });
    const doc = await getOrCreateMasterData();
    doc.designations = doc.designations.filter((d) => d !== name);
    await doc.save();
    res.json({ designations: doc.designations });
  } catch (err) {
    console.error('deleteDesignation error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getWardsAndUnitsForForms = async (req, res) => {
  try {
    const doc = await MasterData.findOne({ key: 'default' }).lean();
    const wards = (doc?.wards && doc.wards.length > 0) ? doc.wards : DEFAULT_WARDS;
    const units = (doc?.units && doc.units.length > 0) ? doc.units : DEFAULT_UNITS;
    res.json({ wards, units });
  } catch (err) {
    console.error('getWardsAndUnitsForForms error', err);
    res.json({ wards: DEFAULT_WARDS, units: DEFAULT_UNITS });
  }
};
