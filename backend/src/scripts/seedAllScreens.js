/**
 * Seed dummy data for all app screens (operational model: no patient/doctor).
 * Populates: Departments, Users, Locations, Assets, Shifts, MasterData,
 * FormTemplates, ChecklistItems, AuditSubmissions.
 * Run: node src/scripts/seedAllScreens.js [--reset]
 * --reset: clear submissions, checklist items, form templates, locations, assets, shifts before seeding.
 */

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const User = require('../models/User');
const Location = require('../models/Location');
const Asset = require('../models/Asset');
const Shift = require('../models/Shift');
const MasterData = require('../models/MasterData');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');

const RESET = process.argv.includes('--reset');

const DEPARTMENTS = [
  { name: 'Medical Records Department', code: 'MRD' },
  { name: 'Obstetrics & Gynecology', code: 'OG' },
  { name: 'General Medicine', code: 'GM' },
  { name: 'Orthopedics', code: 'ORTHO' },
  { name: 'Pediatrics', code: 'PED' },
  { name: 'Ophthalmology', code: 'OPHTHAL' },
  { name: 'Cardiac Surgery', code: 'CS' },
  { name: 'ENT', code: 'ENT' },
  { name: 'General Surgery', code: 'GS' },
  { name: 'Anesthesiology', code: 'ANAE' },
  { name: 'Nursing Services', code: 'NUS' },
];

const LOCATION_NAMES = [
  { areaName: 'Building A - Floor 1', building: 'A', floor: '1', code: 'A-F1' },
  { areaName: 'Building A - Floor 2', building: 'A', floor: '2', code: 'A-F2' },
  { areaName: 'Building B - Floor 1', building: 'B', floor: '1', code: 'B-F1' },
  { areaName: 'ICU Block', building: 'ICU', floor: 'G', code: 'ICU-G' },
  { areaName: 'Outpatient Block', building: 'OPD', floor: 'G', code: 'OPD-G' },
];

const ASSET_NAMES = ['Station 1', 'Station 2', 'Station 3', 'Station 4', 'Station 5', 'Station 6'];

const SHIFT_NAMES = [
  { name: 'Morning', startTime: '06:00', endTime: '14:00' },
  { name: 'Evening', startTime: '14:00', endTime: '22:00' },
  { name: 'Night', startTime: '22:00', endTime: '06:00' },
];

const GENERAL_CHECKLIST_ITEMS = [
  { label: 'Identification and context verified', section: 'OPERATIONS', order: 1, isMandatory: true },
  { label: 'Checklist and consent documented', section: 'OPERATIONS', order: 2, isMandatory: true },
  { label: 'Records and chart updated', section: 'DOCUMENTATION', order: 3, isMandatory: true },
  { label: 'Safety and protocols followed', section: 'DOCUMENTATION', order: 4, isMandatory: true },
  { label: 'Vital parameters recorded', section: 'ASSESSMENT', order: 5, isMandatory: true },
  { label: 'Infection control measures followed', section: 'ASSESSMENT', order: 6, isMandatory: true },
  { label: 'Education and handover provided', section: 'ASSESSMENT', order: 7, isMandatory: false },
  { label: 'Closure and follow-up initiated', section: 'DOCUMENTATION', order: 8, isMandatory: false },
];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
  try {
    console.log('🚀 Seed dummy data for all screens (operational model)\n');
    await connectDB();

    if (RESET) {
      console.log('🧹 --reset: clearing operational data...');
      await AuditSubmission.deleteMany({});
      await ChecklistItem.deleteMany({});
      await FormTemplate.deleteMany({});
      await Asset.deleteMany({});
      await Shift.deleteMany({});
      await Location.deleteMany({});
      console.log('   ✅ Cleared submissions, checklist items, form templates, locations, assets, shifts\n');
    }

    const deptCodeToId = new Map();

    // 1) Departments
    let departments = await Department.find({}).lean();
    if (departments.length === 0) {
      const created = await Department.insertMany(DEPARTMENTS);
      departments = created.map((d) => d.toObject ? d.toObject() : d);
      created.forEach((d) => deptCodeToId.set(d.code, d._id.toString()));
      console.log(`✅ Created ${departments.length} departments`);
    } else {
      departments.forEach((d) => deptCodeToId.set(d.code, d._id.toString()));
      console.log(`✅ Using ${departments.length} existing departments`);
    }

    // 2) Users (keep admin; ensure QA, DEPT_ADMIN, SUPERVISOR, STAFF)
    const existingAdmin = await User.findOne({ email: 'admin@hospital.com' });
    if (!existingAdmin) {
      const hash = await bcrypt.hash('TataTiago@2026', 10);
      await User.create({
        name: 'System Administrator',
        email: 'admin@hospital.com',
        passwordHash: hash,
        role: 'SUPER_ADMIN',
        isActive: true,
      });
      console.log('✅ Created SUPER_ADMIN: admin@hospital.com');
    }

    const rolesToSeed = [
      { email: 'qa@hospital.com', name: 'QA Officer', role: 'QA' },
      { email: 'deptadmin@hospital.com', name: 'Department Admin', role: 'DEPT_ADMIN', deptCode: 'MRD' },
      { email: 'supervisor@hospital.com', name: 'Supervisor', role: 'SUPERVISOR', deptCode: 'GM' },
      { email: 'staff1@hospital.com', name: 'Staff One', role: 'STAFF', deptCode: 'MRD' },
      { email: 'staff2@hospital.com', name: 'Staff Two', role: 'STAFF', deptCode: 'OG' },
      { email: 'staff3@hospital.com', name: 'Staff Three', role: 'STAFF', deptCode: 'GM' },
    ];
    const defaultPassword = 'Staff@123';
    const hashDefault = await bcrypt.hash(defaultPassword, 10);
    for (const r of rolesToSeed) {
      const exists = await User.findOne({ email: r.email });
      if (!exists) {
        const deptId = r.deptCode ? deptCodeToId.get(r.deptCode) : null;
        await User.create({
          name: r.name,
          email: r.email,
          passwordHash: hashDefault,
          role: r.role,
          department: deptId || undefined,
          isActive: true,
        });
        console.log(`✅ Created ${r.role}: ${r.email}`);
      }
    }
    const staffUsers = await User.find({ role: 'STAFF', isActive: true }).lean();
    if (staffUsers.length === 0) console.log('⚠️  No STAFF users; create some for form submissions.');

    // 3) Locations
    let locations = await Location.find({ isActive: true }).lean();
    if (locations.length === 0) {
      locations = await Location.insertMany(LOCATION_NAMES.map((l) => ({ ...l, isActive: true })));
      locations = locations.map((d) => d.toObject ? d.toObject() : d);
      console.log(`✅ Created ${locations.length} locations`);
    } else {
      console.log(`✅ Using ${locations.length} existing locations`);
    }

    // 4) Shifts
    let shifts = await Shift.find({ isActive: true }).lean();
    if (shifts.length === 0) {
      shifts = await Shift.insertMany(SHIFT_NAMES.map((s) => ({ ...s, isActive: true })));
      shifts = shifts.map((d) => d.toObject ? d.toObject() : d);
      console.log(`✅ Created ${shifts.length} shifts`);
    } else {
      console.log(`✅ Using ${shifts.length} existing shifts`);
    }

    // 5) Assets (optional link to first location)
    let assets = await Asset.find({ isActive: true }).lean();
    if (assets.length === 0) {
      const firstLocId = locations[0]?._id || null;
      assets = await Asset.insertMany(
        ASSET_NAMES.map((name, i) => ({
          name,
          assetCode: `AST-${String(i + 1).padStart(3, '0')}`,
          locationId: firstLocId,
          isActive: true,
        }))
      );
      assets = assets.map((d) => d.toObject ? d.toObject() : d);
      console.log(`✅ Created ${assets.length} assets`);
    } else {
      console.log(`✅ Using ${assets.length} existing assets`);
    }

    // 6) MasterData (wards, units, designations for Ward List / Unit List / Master Data screens)
    let masterData = await MasterData.findOne({ key: 'default' });
    if (!masterData) {
      masterData = await MasterData.create({
        key: 'default',
        designations: ['Staff', 'Supervisor', 'Unit Chief', 'Nurse', 'Technician', 'Other'],
        wards: ['A1', 'A2', 'B1', 'B2', 'C1', 'ICU', 'CCU', 'Maternity'],
        units: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'],
      });
      console.log('✅ Created MasterData (wards, units, designations)');
    } else {
      console.log('✅ Using existing MasterData');
    }

    // 7) Form templates and checklist items (general audit checklist per department)
    const clinicalDepts = departments.filter((d) => !['ANAE', 'NUS'].includes(d.code));
    let formTemplates = await FormTemplate.find({ isActive: true }).populate('departments').lean();
    if (formTemplates.length === 0) {
      const formMap = new Map(); // deptId -> form
      for (const dept of clinicalDepts) {
        const form = await FormTemplate.create({
          name: `${dept.name} - General Audit Checklist`,
          description: `Operational audit checklist for ${dept.name}`,
          departments: [dept._id],
          isCommon: false,
          isActive: true,
          sections: [
            { name: 'OPERATIONS', order: 0 },
            { name: 'ASSESSMENT', order: 1 },
            { name: 'DOCUMENTATION', order: 2 },
          ],
        });
        formMap.set(dept._id.toString(), form);
        for (const item of GENERAL_CHECKLIST_ITEMS) {
          await ChecklistItem.create({
            label: item.label,
            section: item.section,
            order: item.order,
            isMandatory: item.isMandatory,
            formTemplate: form._id,
            department: dept._id,
            departmentScope: 'SINGLE',
            responseType: 'YES_NO',
            isActive: true,
          });
        }
      }
      formTemplates = await FormTemplate.find({ isActive: true }).populate('departments').lean();
      const itemCount = await ChecklistItem.countDocuments({ isActive: true });
      console.log(`✅ Created ${formTemplates.length} form templates and ${itemCount} checklist items`);
    } else {
      console.log(`✅ Using ${formTemplates.length} existing form templates`);
    }

    // 8) Audit submissions (operational: location, asset, shift; no patient)
    const submissionCount = await AuditSubmission.countDocuments({});
    if (submissionCount === 0 && formTemplates.length > 0 && staffUsers.length > 0) {
      const checklistByForm = new Map();
      for (const form of formTemplates) {
        const items = await ChecklistItem.find({ formTemplate: form._id, isActive: true }).lean();
        if (items.length) checklistByForm.set(form._id.toString(), { form, items });
      }

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const now = new Date();
      let created = 0;
      const targetSubmissions = 400;

      for (let i = 0; i < targetSubmissions; i++) {
        const formEntry = pick(Array.from(checklistByForm.values()));
        if (!formEntry) continue;
        const { form, items } = formEntry;
        const deptId = form.departments?.[0]?._id || form.departments?.[0];
        if (!deptId) continue;
        const submitter = pick(staffUsers);
        const loc = pick(locations);
        const shift = pick(shifts);
        const asset = pick(assets);
        const submittedAt = randomDate(sixtyDaysAgo, now);
        const auditDate = new Date(submittedAt);
        auditDate.setUTCHours(0, 0, 0, 0);
        const hour = submittedAt.getUTCHours();
        const auditTime = `${String(hour).padStart(2, '0')}:${String(submittedAt.getUTCMinutes()).padStart(2, '0')}`;
        const item = pick(items);
        const responseValue = Math.random() < 0.82 ? 'YES' : 'NO';
        const remarks = responseValue === 'NO' ? pick(['Pending documentation', 'To be completed', 'Follow-up required', 'Noted for correction']) : '';

        await AuditSubmission.create({
          department: deptId,
          formTemplate: form._id,
          checklistItemId: item._id,
          locationId: loc._id,
          assetId: asset._id,
          shiftId: shift._id,
          location: loc.areaName || loc.name,
          asset: asset.name,
          shift: shift.name,
          responseValue,
          yesNoNa: responseValue,
          remarks,
          submittedBy: submitter._id,
          submittedAt,
          auditDate,
          auditTime,
          isLocked: true,
        });
        created++;
      }
      console.log(`✅ Created ${created} audit submissions (operational model)`);
    } else if (submissionCount > 0) {
      console.log(`✅ Using ${submissionCount} existing audit submissions`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Seed complete. All screens should have data.');
    console.log('='.repeat(60));
    console.log('\n🔑 Login: admin@hospital.com / TataTiago@2026');
    console.log('   Or: qa@hospital.com, staff1@hospital.com / Staff@123');
    console.log('\n📌 Note: Chief Dashboard / Staff Performance use legacy APIs;');
    console.log('   they may show empty until adapted to operational model.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
