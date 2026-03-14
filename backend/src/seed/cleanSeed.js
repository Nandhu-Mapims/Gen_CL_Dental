/**
 * Full Clean Seed — fresh data only
 * ──────────────────────────────────────────────────────
 *  Wipes all data and seeds:
 *   • Departments: Housekeeping (8 sub) + Infection Control (6 sub) + Engineering & Maintenance (7 sub)
 *   • 1 Super Admin, 1 QA, 3 Supervisors, 3 Staff (HK, ICD, EMD)
 *   • 10 Locations, 3 Shifts
 *   • 3 Form templates + checklist items (assigned to users)
 *   • 7 days of realistic audit submissions
 *   • Corrective/Preventive actions on some NO responses
 *   • Notifications
 *   • MasterData (designations)
 *
 * Run: cd backend && node src/seed/cleanSeed.js
 */

const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt    = require('bcrypt');
const mongoose  = require('mongoose');

const connectDB      = require('../config/db');
const Department     = require('../models/Department');
const User           = require('../models/User');
const ChiefDoctor    = require('../models/ChiefDoctor');
const FormTemplate   = require('../models/FormTemplate');
const ChecklistItem  = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');
const Location       = require('../models/Location');
const Shift          = require('../models/Shift');
const Patient        = require('../models/Patient');
const Admission      = require('../models/Admission');
const Notification   = require('../models/Notification');
const MasterData     = require('../models/MasterData');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hash    = (pw) => bcrypt.hash(pw, 10);
const emailOf = (name) => name.toLowerCase().replace(/\s+/g, '.') + '@hospital.com';
const daysAgo = (n, h = 9, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
};
const dateStr  = (d) => d.toISOString().slice(0, 10);
const timeStr  = (d) => d.toTimeString().slice(0, 5);
const rand     = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pick     = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

// ─── Config ────────────────────────────────────────────────────────────────────

const PASSWORD = 'TataTiago@2026';

// Fresh data: only these 3 departments + sub-domains (no Quality / general departments)
const DEPARTMENTS = [
  // 2. Housekeeping Department + sub-domains
  { name: 'Housekeeping Department',     code: 'HK'       },
  { name: 'Ward Cleaning Unit',          code: 'HK-WCU',  parentCode: 'HK' },
  { name: 'ICU Cleaning Unit',           code: 'HK-ICU',  parentCode: 'HK' },
  { name: 'OT Cleaning Unit',            code: 'HK-OTC',  parentCode: 'HK' },
  { name: 'Lift & Public Area Cleaning', code: 'HK-LPA',  parentCode: 'HK' },
  { name: 'Toilet & Washroom Cleaning',  code: 'HK-TWC',  parentCode: 'HK' },
  { name: 'Linen Management',            code: 'HK-LM',   parentCode: 'HK' },
  { name: 'Biomedical Waste Handling',   code: 'HK-BWH',  parentCode: 'HK' },
  { name: 'Pest Control Unit',           code: 'HK-PCU',  parentCode: 'HK' },

  // 3. Infection Control Department + sub-domains
  { name: 'Infection Control Department', code: 'ICD'      },
  { name: 'HAI Surveillance',             code: 'ICD-HAI', parentCode: 'ICD' },
  { name: 'Hand Hygiene Monitoring',      code: 'ICD-HHM', parentCode: 'ICD' },
  { name: 'CSSD Monitoring',              code: 'ICD-CSSD', parentCode: 'ICD' },
  { name: 'Isolation Room Monitoring',    code: 'ICD-IRM', parentCode: 'ICD' },
  { name: 'Antibiotic Stewardship',       code: 'ICD-AS',  parentCode: 'ICD' },
  { name: 'Outbreak Management',          code: 'ICD-OM',  parentCode: 'ICD' },

  // 4. Engineering & Maintenance Department + sub-domains
  { name: 'Engineering & Maintenance Department', code: 'EMD'       },
  { name: 'Electrical Maintenance',       code: 'EMD-EM',   parentCode: 'EMD' },
  { name: 'Lift Maintenance',             code: 'EMD-LM',   parentCode: 'EMD' },
  { name: 'HVAC / Air Conditioning',      code: 'EMD-HVAC', parentCode: 'EMD' },
  { name: 'Plumbing',                     code: 'EMD-PL',   parentCode: 'EMD' },
  { name: 'Fire Safety Systems',          code: 'EMD-FSS',  parentCode: 'EMD' },
  { name: 'Generator & Power Backup',     code: 'EMD-GPB',  parentCode: 'EMD' },
  { name: 'Civil Maintenance',            code: 'EMD-CM',   parentCode: 'EMD' },
];

const SUPERVISORS = [
  { name: 'Rajesh Kumar',  deptCode: 'HK',   designation: 'Unit Supervisor' },
  { name: 'Priya Sharma',  deptCode: 'ICD',  designation: 'Unit Supervisor' },
  { name: 'Amit Patel',    deptCode: 'EMD',  designation: 'Department Head' },
];

const STAFF = [
  { name: 'Meera Joseph', deptCode: 'HK',   designation: 'Staff Auditor' },
  { name: 'Suresh Kumar', deptCode: 'ICD',  designation: 'Staff Auditor' },
  { name: 'Divya Menon',  deptCode: 'EMD',  designation: 'Quality Auditor' },
];

// ─── Locations (Zone → multiple Floors hierarchy) ───────────────────────────────
// Top-level zones first; floors belong to a zone via parent.

const LOCATIONS_TOP = [
  { areaName: 'Zone A', locationType: 'ZONE', zone: 'A', order: 1 },
  { areaName: 'Zone B', locationType: 'ZONE', zone: 'B', order: 2 },
  { areaName: 'Zone C', locationType: 'ZONE', zone: 'C', order: 3 },
];

const LOCATIONS_WITH_PARENT = [
  { areaName: 'Floor 1', locationType: 'FLOOR', floor: '1', order: 4, parentZoneCode: 'A' },
  { areaName: 'Floor 2', locationType: 'FLOOR', floor: '2', order: 5, parentZoneCode: 'A' },
  { areaName: 'Floor 3', locationType: 'FLOOR', floor: '3', order: 6, parentZoneCode: 'A' },
  { areaName: 'Ward A', locationType: 'WARD', order: 7 },
  { areaName: 'Ward B', locationType: 'WARD', order: 8 },
  { areaName: 'ICU', locationType: 'UNIT', order: 9 },
  { areaName: 'OT Block', locationType: 'UNIT', order: 10 },
];

// ─── Shifts ─────────────────────────────────────────────────────────────────────

const SHIFTS = [
  { name: 'Morning',   startTime: '06:00', endTime: '14:00', hours: [7, 8, 9] },
  { name: 'Afternoon', startTime: '14:00', endTime: '22:00', hours: [14, 15, 16] },
  { name: 'Night',     startTime: '22:00', endTime: '06:00', hours: [22, 23, 0] },
];

// ─── Form definitions ──────────────────────────────────────────────────────────
// Each form is scoped to exactly ONE department (Housekeeping, Infection Control, Engineering & Maintenance).

const FORMS = [
  {
    key: 'HOUSEKEEPING',
    name: 'Housekeeping Department Checklist',
    description: 'Daily audit for Housekeeping: ward cleaning, ICU/OT cleaning, linen, biomedical waste, pest control.',
    deptCodes: ['HK'],
    isCommon: false,
    sections: [
      { name: 'Ward & Unit Cleaning',     order: 1 },
      { name: 'Linen & Waste',            order: 2 },
      { name: 'Public Areas & Pest Control', order: 3 },
    ],
    items: [
      { label: 'Ward cleaning completed as per schedule',                          section: 'Ward & Unit Cleaning',     order: 1, isMandatory: true  },
      { label: 'ICU cleaning protocol followed and documented',                    section: 'Ward & Unit Cleaning',     order: 2, isMandatory: true  },
      { label: 'OT cleaning and fumigation as per protocol',                       section: 'Ward & Unit Cleaning',     order: 3, isMandatory: true  },
      { label: 'Lift and public area cleaning completed',                          section: 'Ward & Unit Cleaning',     order: 4, isMandatory: true  },
      { label: 'Toilet and washroom cleaning done and disinfectant used',          section: 'Ward & Unit Cleaning',     order: 5, isMandatory: true  },
      { label: 'Linen management: collection, laundering, distribution as per SOP', section: 'Linen & Waste',            order: 1, isMandatory: true  },
      { label: 'Biomedical waste segregated, colour-coded bins in place',           section: 'Linen & Waste',            order: 2, isMandatory: true  },
      { label: 'BMW handed over to authorised agency and record maintained',       section: 'Linen & Waste',            order: 3, isMandatory: true  },
      { label: 'Pest control schedule followed and log maintained',                 section: 'Public Areas & Pest Control', order: 1, isMandatory: true  },
      { label: 'No pest infestation observed in audited area',                     section: 'Public Areas & Pest Control', order: 2                     },
    ],
  },
  {
    key: 'INFECTION',
    name: 'Infection Control Department Checklist',
    description: 'Audit for HAI surveillance, hand hygiene, CSSD, isolation, antibiotic stewardship, outbreak management.',
    deptCodes: ['ICD'],
    isCommon: false,
    sections: [
      { name: 'Surveillance & Hand Hygiene', order: 1 },
      { name: 'CSSD & Isolation',            order: 2 },
      { name: 'Stewardship & Outbreak',       order: 3 },
    ],
    items: [
      { label: 'HAI surveillance data collected and reported as per protocol',    section: 'Surveillance & Hand Hygiene', order: 1, isMandatory: true  },
      { label: 'Hand hygiene monitoring completed and compliance recorded',        section: 'Surveillance & Hand Hygiene', order: 2, isMandatory: true  },
      { label: 'Alcohol-based hand rub available at point of care',                section: 'Surveillance & Hand Hygiene', order: 3, isMandatory: true  },
      { label: 'CSSD monitoring: sterilisation cycle and biological indicators',   section: 'CSSD & Isolation',            order: 1, isMandatory: true  },
      { label: 'Isolation room monitoring: negative pressure and PPE compliance',  section: 'CSSD & Isolation',            order: 2, isMandatory: true  },
      { label: 'Isolation precautions signage and supplies in place',              section: 'CSSD & Isolation',            order: 3                     },
      { label: 'Antibiotic stewardship: restricted antibiotics as per policy',      section: 'Stewardship & Outbreak',       order: 1, isMandatory: true  },
      { label: 'Outbreak management protocol documented and accessible',          section: 'Stewardship & Outbreak',       order: 2, isMandatory: true  },
      { label: 'Outbreak log updated when applicable',                             section: 'Stewardship & Outbreak',       order: 3                     },
    ],
  },
  {
    key: 'ENGINEERING',
    name: 'Engineering & Maintenance Department Checklist',
    description: 'Audit for electrical, lift, HVAC, plumbing, fire safety, generator, civil maintenance.',
    deptCodes: ['EMD'],
    isCommon: false,
    sections: [
      { name: 'Electrical & Lift',     order: 1 },
      { name: 'HVAC, Plumbing & Civil', order: 2 },
      { name: 'Fire Safety & Power Backup', order: 3 },
    ],
    items: [
      { label: 'Electrical maintenance schedule followed and log maintained',      section: 'Electrical & Lift',     order: 1, isMandatory: true  },
      { label: 'Lift maintenance and safety check as per schedule',                 section: 'Electrical & Lift',     order: 2, isMandatory: true  },
      { label: 'HVAC / air conditioning functioning and filters checked',          section: 'HVAC, Plumbing & Civil', order: 1, isMandatory: true  },
      { label: 'Plumbing: no leaks, water supply adequate in audited area',        section: 'HVAC, Plumbing & Civil', order: 2, isMandatory: true  },
      { label: 'Civil maintenance: no structural hazards or water seepage',        section: 'HVAC, Plumbing & Civil', order: 3                     },
      { label: 'Fire safety systems: extinguishers, hydrants, alarms in working order', section: 'Fire Safety & Power Backup', order: 1, isMandatory: true  },
      { label: 'Fire drill and evacuation plan updated and displayed',             section: 'Fire Safety & Power Backup', order: 2, isMandatory: true  },
      { label: 'Generator and power backup tested and log maintained',             section: 'Fire Safety & Power Backup', order: 3, isMandatory: true  },
      { label: 'UPS and critical equipment on backup power as per plan',            section: 'Fire Safety & Power Backup', order: 4                     },
    ],
  },
];

// ─── Remarks pool for NO responses ─────────────────────────────────────────────
const REMARKS_NO = [
  'Stock not replenished — requisition raised',
  'Staff reminded verbally; re-training scheduled',
  'Maintenance request logged',
  'Equipment sent for calibration',
  'Pending supply delivery — expected within 2 days',
  'Checklist missed due to shift overlap; corrected on next round',
  'Bin label damaged — replaced immediately',
  'Documentation incomplete — staff counselled',
  'Expired stock identified and removed',
];

const CORRECTIVE = [
  'Immediate replenishment of supplies done',
  'Staff instructed and re-trained on protocol',
  'Maintenance team alerted; temporary measure in place',
  'Expired items segregated and disposed properly',
  'Documentation corrected and counter-signed by supervisor',
  'Equipment replaced with functional unit from store',
];

const PREVENTIVE = [
  'Weekly stock audit checklist introduced',
  'Refresher training scheduled for all staff',
  'Monthly maintenance schedule updated',
  'Expiry date monitoring added to daily rounds',
  'Double-check step added to documentation SOP',
  'Backup equipment kept ready on every shift',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await connectDB();

  // ── 1. Wipe all collections ─────────────────────────────────────────────────
  console.log('\n🗑️  Clearing all data...');
  await Promise.all([
    AuditSubmission.deleteMany({}),
    ChecklistItem.deleteMany({}),
    FormTemplate.deleteMany({}),
    ChiefDoctor.deleteMany({}),
    Notification.deleteMany({}),
    Patient.deleteMany({}),
    Admission.deleteMany({}),
    Location.deleteMany({}),
    Shift.deleteMany({}),
    User.deleteMany({}),
    Department.deleteMany({}),
    MasterData.deleteMany({}),
  ]);
  console.log('✅  Cleared.\n');

  // ── 2. Departments ──────────────────────────────────────────────────────────
  console.log('🏥  Departments...');

  // First pass: insert top-level departments (no parent)
  const topLevel = DEPARTMENTS.filter(d => !d.parentCode);
  const topDocs  = await Department.insertMany(topLevel.map(d => ({ name: d.name, code: d.code, isActive: true })));
  const deptByCode = {};
  topDocs.forEach(d => { deptByCode[d.code] = d; });

  // Second pass: insert sub-departments with resolved parent ObjectId
  const subLevel = DEPARTMENTS.filter(d => d.parentCode);
  const subDocs  = await Department.insertMany(
    subLevel.map(d => ({
      name: d.name,
      code: d.code,
      parent: deptByCode[d.parentCode]?._id || null,
      isActive: true,
    }))
  );
  subDocs.forEach(d => { deptByCode[d.code] = d; });

  const deptDocs = [...topDocs, ...subDocs];
  console.log(`   ${deptDocs.length} departments created (${topDocs.length} top-level, ${subDocs.length} sub-units).`);

  // ── 3. MasterData ───────────────────────────────────────────────────────────
  await MasterData.create({
    key: 'default',
    designations: ['Quality Auditor', 'Staff Auditor', 'Unit Supervisor', 'Department Head', 'Quality Officer', 'Infection Control Officer', 'Nursing In-charge', 'Other'],
    wards: ['Ward A', 'Ward B', 'Ward C', 'ICU', 'CCU'],
    units: ['Unit 1', 'Unit 2', 'Unit 3'],
  });

  // ── 4. Locations (zones top-level; floors/wards/units under zone where applicable) ─
  console.log('📍  Locations...');
  const zoneDocs = await Location.insertMany(LOCATIONS_TOP.map(l => ({ ...l, isActive: true })));
  const zoneByCode = {};
  zoneDocs.forEach(l => { zoneByCode[l.zone] = l; });
  const locByName = {};
  zoneDocs.forEach(l => { locByName[l.areaName] = l; });
  const withParent = LOCATIONS_WITH_PARENT.map(l => {
    const { parentZoneCode, ...rest } = l;
    const doc = { ...rest, isActive: true };
    if (parentZoneCode && zoneByCode[parentZoneCode]) doc.parent = zoneByCode[parentZoneCode]._id;
    return doc;
  });
  const childDocs = await Location.insertMany(withParent);
  childDocs.forEach(l => { locByName[l.areaName] = l; });
  const locDocs = [...zoneDocs, ...childDocs];
  console.log(`   ${locDocs.length} locations created (${zoneDocs.length} zones, ${childDocs.length} under zones).`);

  // ── 5. Shifts ───────────────────────────────────────────────────────────────
  console.log('🕐  Shifts...');
  const shiftModel = require('../models/Shift');
  const shiftDocs = await shiftModel.insertMany(SHIFTS.map(s => ({ name: s.name, startTime: s.startTime, endTime: s.endTime })));
  const shiftByName = {};
  shiftDocs.forEach(s => { shiftByName[s.name] = s; });
  console.log(`   ${shiftDocs.length} shifts created.`);

  // ── 6. Super Admin ──────────────────────────────────────────────────────────
  console.log('\n👑  Super Admin...');
  const adminUser = await User.create({
    name: 'Super Admin', email: 'admin@hospital.com',
    passwordHash: await hash(PASSWORD), role: 'SUPER_ADMIN',
    designation: 'Administrator', isActive: true,
  });
  console.log('   admin@hospital.com');

  // ── 7. QA (no department — global role) ───────────────────────────────────────
  console.log('🔍  QA...');
  await User.create({
    name: 'QA Officer', email: 'qa@hospital.com',
    passwordHash: await hash(PASSWORD), role: 'QA',
    designation: 'Quality Officer',
    department: null, isActive: true,
  });
  console.log('   qa@hospital.com');

  // ── 8. Supervisors ───────────────────────────────────────────────────────────
  console.log('\n👔  Supervisors...');
  const supervisorDocs = {};
  for (const sup of SUPERVISORS) {
    const dept = deptByCode[sup.deptCode];
    const email = emailOf(sup.name);
    const u = await User.create({
      name: sup.name, email,
      passwordHash: await hash(PASSWORD),
      role: 'SUPERVISOR', designation: sup.designation,
      department: dept._id, isActive: true,
    });
    await ChiefDoctor.create({ name: sup.name, designation: sup.designation, department: dept._id });
    supervisorDocs[sup.deptCode] = u;
    console.log(`   ${email}  →  ${dept.name}`);
  }

  // ── 9. Staff ─────────────────────────────────────────────────────────────────
  console.log('\n👤  Staff...');
  const staffDocs = {};
  for (const s of STAFF) {
    const dept = deptByCode[s.deptCode];
    const email = emailOf(s.name);
    const u = await User.create({
      name: s.name, email,
      passwordHash: await hash(PASSWORD),
      role: 'STAFF', designation: s.designation,
      department: dept._id, isActive: true,
    });
    staffDocs[s.deptCode] = u;
    console.log(`   ${email}  →  ${dept.name}`);
  }

  // ── 10. Form templates + checklist items ──────────────────────────────────────
  //
  // Cross-audit: staff from one dept audit another dept's form
  //   HK form  → audited by ICD + EMD staff
  //   ICD form → audited by HK + EMD staff
  //   EMD form → audited by HK + ICD staff
  //
  console.log('\n📝  Forms & Checklist Items...');
  const formMap = {};     // key → FormTemplate doc
  const itemsMap = {};    // key → { deptCode → [ChecklistItem] }

  // Cross-department assignments: staff from one dept can audit another dept's form
  const FORM_ASSIGNED_STAFF = {
    HOUSEKEEPING: ['ICD', 'EMD'],
    INFECTION:     ['HK', 'EMD'],
    ENGINEERING:   ['HK', 'ICD'],
  };

  for (const formDef of FORMS) {
    const deptIds = formDef.deptCodes.map(c => deptByCode[c]._id);

    // Cross-department assigned auditors only
    const assignedStaffCodes = FORM_ASSIGNED_STAFF[formDef.key] || [];
    const assignedUserIds = assignedStaffCodes
      .map(code => staffDocs[code]?._id)
      .filter(Boolean);

    const form = await FormTemplate.create({
      name: formDef.name,
      description: formDef.description,
      departments: deptIds,
      isCommon: formDef.isCommon,
      sections: formDef.sections,
      assignedUsers: assignedUserIds,
      isActive: true,
    });
    formMap[formDef.key] = form;
    itemsMap[formDef.key] = {};

    for (const code of formDef.deptCodes) {
      const dept = deptByCode[code];
      const docs = await ChecklistItem.insertMany(
        formDef.items.map(it => ({
          label: it.label,
          departmentScope: 'SINGLE',
          department: dept._id,
          formTemplate: form._id,
          section: it.section,
          responseType: 'YES_NO',
          order: it.order,
          isMandatory: !!it.isMandatory,
          isActive: true,
        }))
      );
      itemsMap[formDef.key][code] = docs;
    }

    console.log(`   ✓ "${form.name}" — ${formDef.items.length} items, assigned to: ${assignedStaffCodes.join(', ') || 'none'}`);
  }

  // ── 11. Audit submissions (7 days of realistic data) ─────────────────────────
  console.log('\n📊  Generating audit submissions (7 days)...');

  // Each submission plan: staffCode = who submits, formKey = form template, itemDeptCode = form's dept
  const submissionPlans = [
    // Meera (HK) audits Infection Control form
    { staffCode: 'HK', formKey: 'INFECTION', itemDeptCode: 'ICD', day: 1, shiftName: 'Morning',   loc: 'Ward A',  noAt: [1]    },
    { staffCode: 'HK', formKey: 'INFECTION', itemDeptCode: 'ICD', day: 2, shiftName: 'Morning',   loc: 'Ward B',  noAt: [4]    },
    { staffCode: 'HK', formKey: 'INFECTION', itemDeptCode: 'ICD', day: 3, shiftName: 'Afternoon', loc: 'Floor 2',  noAt: []     },
    { staffCode: 'HK', formKey: 'INFECTION', itemDeptCode: 'ICD', day: 4, shiftName: 'Morning',   loc: 'ICU',     noAt: [2, 7] },
    { staffCode: 'HK', formKey: 'INFECTION', itemDeptCode: 'ICD', day: 5, shiftName: 'Morning',   loc: 'Zone C',   noAt: []     },
    { staffCode: 'HK', formKey: 'INFECTION', itemDeptCode: 'ICD', day: 6, shiftName: 'Night',     loc: 'Ward A',  noAt: []     },

    // Suresh (ICD) audits Housekeeping form
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 1, shiftName: 'Morning',   loc: 'Zone A',  noAt: [4]    },
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 2, shiftName: 'Morning',   loc: 'Ward A',  noAt: [2]    },
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 3, shiftName: 'Afternoon', loc: 'Zone B',  noAt: []     },
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 4, shiftName: 'Afternoon', loc: 'Floor 1', noAt: [9]    },
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 5, shiftName: 'Morning',   loc: 'Zone A',  noAt: [3]    },
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 6, shiftName: 'Morning',   loc: 'Ward B',  noAt: []     },
    { staffCode: 'ICD', formKey: 'HOUSEKEEPING', itemDeptCode: 'HK', day: 7, shiftName: 'Morning',   loc: 'Floor 1', noAt: []     },

    // Divya (EMD) audits Engineering form
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 1, shiftName: 'Morning',   loc: 'OT Block', noAt: []     },
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 2, shiftName: 'Morning',   loc: 'Floor 3',  noAt: [3, 6] },
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 3, shiftName: 'Afternoon', loc: 'Zone C',   noAt: [7]    },
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 4, shiftName: 'Morning',   loc: 'Ward A',  noAt: []     },
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 5, shiftName: 'Morning',   loc: 'Zone A',  noAt: [1]    },
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 6, shiftName: 'Night',     loc: 'Ward B',  noAt: []     },
    { staffCode: 'EMD', formKey: 'ENGINEERING', itemDeptCode: 'EMD', day: 7, shiftName: 'Afternoon', loc: 'Zone C',  noAt: []     },
  ];

  let totalSubDocs = 0;
  const noSubmissions = []; // track for adding corrective/preventive later

  for (const plan of submissionPlans) {
    const staffUser = staffDocs[plan.staffCode];
    const form      = formMap[plan.formKey];
    // Items come from the FORM's department (itemDeptCode), not the staff's dept
    const items     = itemsMap[plan.formKey][plan.itemDeptCode || plan.staffCode];
    const shift     = shiftByName[plan.shiftName];
    const loc       = locByName[plan.loc];
    // submission.department = staff's own department (who performed the audit)
    const dept      = deptByCode[plan.staffCode];

    if (!items || items.length === 0) continue;

    const shiftDef = SHIFTS.find(s => s.name === plan.shiftName);
    const hour     = shiftDef ? shiftDef.hours[0] : 9;
    const ts       = daysAgo(plan.day, hour, Math.floor(Math.random() * 30));

    const docs = items.map((item, idx) => {
      const isNo   = plan.noAt.includes(idx);
      const val    = isNo ? 'NO' : 'YES';
      const doc = {
        department:    dept._id,
        formTemplate:  form._id,
        locationId:    loc?._id,
        shiftId:       shift?._id,
        location:      loc?.areaName || '',
        shift:         shift?.name || '',
        checklistItemId: item._id,
        yesNoNa:       val,
        responseValue: val,
        remarks:       isNo ? rand(REMARKS_NO) : '',
        submittedBy:   staffUser._id,
        submittedAt:   ts,
        auditDate:     new Date(Date.UTC(ts.getFullYear(), ts.getMonth(), ts.getDate())),
        auditTime:     `${String(hour).padStart(2,'0')}:${String(Math.floor(Math.random()*30)).padStart(2,'0')}`,
        isLocked:      true,
      };
      return { doc, isNo };
    });

    const inserted = await AuditSubmission.insertMany(docs.map(d => d.doc));
    totalSubDocs += inserted.length;

    // Collect NO submissions for corrective/preventive actions
    docs.forEach((d, idx) => {
      if (d.isNo) {
        noSubmissions.push({
          submissionId: inserted[idx]._id,
          staffUserId:  staffUser._id,
          supUser:      supervisorDocs[plan.staffCode],
          day:          plan.day,
        });
      }
    });
  }

  console.log(`   ${submissionPlans.length} sessions × avg items = ${totalSubDocs} total submission rows`);

  // ── 12. Corrective / Preventive actions (supervisors review some NO items) ────
  console.log('\n✍️   Adding corrective/preventive actions on NO responses...');

  // Supervisors review ~70% of NO items (simulate realistic review)
  const toReview = pick(noSubmissions, Math.ceil(noSubmissions.length * 0.7));
  let actionCount = 0;
  const notifDocs = [];

  for (const item of toReview) {
    if (!item.supUser) continue;
    const cor  = rand(CORRECTIVE);
    const prev = rand(PREVENTIVE);
    const ts   = daysAgo(item.day - 1, 11, 0);   // Supervisor reviews next day

    await AuditSubmission.findByIdAndUpdate(item.submissionId, {
      corrective: cor,
      preventive: prev,
      correctivePreventiveBy: item.supUser._id,
      correctivePreventiveAt: ts,
    });
    actionCount++;

    // Notification to the staff member
    notifDocs.push({
      user:    item.staffUserId,
      title:   'Corrective & Preventive Actions Added',
      message: `Your supervisor has reviewed your checklist submission and added corrective/preventive actions.`,
      type:    'action',
      isRead:  false,
      createdAt: ts,
    });
  }

  if (notifDocs.length > 0) await Notification.insertMany(notifDocs);
  console.log(`   ${actionCount} actions added → ${notifDocs.length} notifications sent`);

  // ── 13. Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('✅  Seed complete!\n');
  console.log(`  Password (all):  ${PASSWORD}\n`);
  console.log('  SUPER_ADMIN   →  admin@hospital.com');
  console.log('  QA            →  qa@hospital.com');
  for (const sup of SUPERVISORS) {
    console.log(`  SUPERVISOR    →  ${emailOf(sup.name).padEnd(32)}  ${deptByCode[sup.deptCode].name}`);
  }
  for (const s of STAFF) {
    console.log(`  STAFF         →  ${emailOf(s.name).padEnd(32)}  ${deptByCode[s.deptCode].name}`);
  }
  console.log('\n  Forms (each scoped to 1 department):');
  for (const f of FORMS) {
    console.log(`    📝  ${f.name}  →  ${f.deptCodes[0]}`);
  }
  console.log(`\n  Locations : ${[...LOCATIONS_TOP, ...LOCATIONS_WITH_PARENT].map(l => l.areaName).join(', ')}`);
  console.log(`  Shifts    : Morning · Afternoon · Night`);
  console.log(`  Submissions: ${totalSubDocs} rows (${submissionPlans.length} sessions, 7 days)`);
  console.log(`  Actions   : ${actionCount} corrective/preventive`);
  console.log('══════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
