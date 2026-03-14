/**
 * Remove old submissions data and seed proper data.
 * - Deletes all AuditSubmission, Admission, Patient (keeps departments, users, forms, checklist items).
 * - Seeds patients, admissions, and audit submissions with auditDate & auditTime.
 * - YES → no remarks; NO → remarks required (filled in seed).
 *
 * Run: node src/scripts/clearSubmissionsAndSeed.js
 * Requires: Departments, Users, FormTemplates, ChecklistItems must already exist (e.g. run resetAndSeedAll once, or have forms set up).
 */

const dotenv = require('dotenv');
const connectDB = require('../config/db');
const AuditSubmission = require('../models/AuditSubmission');
const Admission = require('../models/Admission');
const Patient = require('../models/Patient');
const Department = require('../models/Department');
const User = require('../models/User');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const ChiefDoctor = require('../models/ChiefDoctor');

dotenv.config();

const WARDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'ICU', 'CCU', 'Maternity'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'];
const FIRST_NAMES = ['Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Anjali', 'Rahul', 'Kavita', 'Suresh', 'Meera'];
const LAST_NAMES = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Jain', 'Mehta', 'Shah'];
const REMARKS_FOR_NO = ['Documentation pending', 'To be completed', 'Follow-up required', 'Noted for correction', 'Escalated to supervisor'];

const randomDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const generateUHID = (i) => `UHID${String(i).padStart(6, '0')}`;
const generateIPID = (i) => `IPID${String(i).padStart(6, '0')}`;

async function run() {
  try {
    console.log('\n🧹 Clear old submissions and seed proper data\n');
    await connectDB();

    // ========== STEP 1: DELETE OLD DATA ==========
    console.log('STEP 1: Removing old submissions data...');
    const delSub = await AuditSubmission.deleteMany({});
    console.log(`   ✅ Deleted ${delSub.deletedCount} audit submission(s)`);
    const delAdm = await Admission.deleteMany({});
    console.log(`   ✅ Deleted ${delAdm.deletedCount} admission(s)`);
    const delPat = await Patient.deleteMany({});
    console.log(`   ✅ Deleted ${delPat.deletedCount} patient(s)\n`);

    // ========== STEP 2: LOAD EXISTING STRUCTURE ==========
    console.log('STEP 2: Loading departments, users, forms, checklist items...');
    const departments = await Department.find({}).lean();
    if (departments.length === 0) {
      console.log('   ❌ No departments found. Run resetAndSeedAll.js first to create departments, users, and forms.');
      process.exit(1);
    }
    const users = await User.find({ department: { $exists: true, $ne: null }, isActive: true }).lean();
    if (users.length === 0) {
      console.log('   ⚠️  No department users found. Submissions will use first available user.');
    }
    const formTemplates = await FormTemplate.find({ isActive: true }).populate('departments').lean();
    if (formTemplates.length === 0) {
      console.log('   ❌ No form templates found. Create forms and checklist items first.');
      process.exit(1);
    }
    const checklistItemsByForm = new Map();
    for (const form of formTemplates) {
      const items = await ChecklistItem.find({ formTemplate: form._id, isActive: true }).sort({ order: 1 }).lean();
      if (items.length > 0) {
        checklistItemsByForm.set(form._id.toString(), items);
      }
    }
    const formsWithItems = formTemplates.filter((f) => checklistItemsByForm.has(f._id.toString()));
    if (formsWithItems.length === 0) {
      console.log('   ❌ No checklist items found for any form. Create checklist items first.');
      process.exit(1);
    }
    let chiefs = [];
    try {
      chiefs = await ChiefDoctor.find({ isActive: true }).lean();
    } catch (_) {}
    console.log(`   ✅ Departments: ${departments.length}, Users: ${users.length}, Forms with items: ${formsWithItems.length}\n`);

    // ========== STEP 3: CREATE PATIENTS & ADMISSIONS ==========
    console.log('STEP 3: Creating patients and admissions...');
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const today = new Date();
    const patients = [];
    const admissions = [];
    const numPatients = 20;

    for (let i = 1; i <= numPatients; i++) {
      const patientName = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
      const uhid = generateUHID(i);
      const patient = await Patient.create({ uhid, patientName });
      patients.push(patient);

      const dept = departments[i % departments.length];
      const ipid = generateIPID(admissions.length + 1);
      const admissionDate = randomDate(twoMonthsAgo, today);
      const admission = await Admission.create({
        ipid,
        patient: patient._id,
        uhid: patient.uhid,
        admissionDate,
        ward: WARDS[i % WARDS.length],
        unitNo: UNITS[i % UNITS.length],
        status: 'Admitted',
        department: dept._id,
      });
      admissions.push(admission);
    }
    console.log(`   ✅ Created ${patients.length} patients, ${admissions.length} admissions\n`);

    // ========== STEP 4: CREATE AUDIT SUBMISSIONS (with auditDate, auditTime; YES no remarks, NO with remarks) ==========
    console.log('STEP 4: Creating audit submissions (auditDate, auditTime; YES=no remarks, NO=remarks)...');
    const deptIdToDept = new Map(departments.map((d) => [d._id.toString(), d]));
    const deptIdToUsers = new Map();
    for (const u of users) {
      const id = u.department && u.department.toString();
      if (id) {
        if (!deptIdToUsers.has(id)) deptIdToUsers.set(id, []);
        deptIdToUsers.get(id).push(u);
      }
    }
    let submissionCount = 0;

    for (const admission of admissions) {
      const deptId = admission.department.toString();
      const dept = deptIdToDept.get(deptId);
      const deptUsers = deptIdToUsers.get(deptId) || users;
      const submittingUser = deptUsers[Math.floor(Math.random() * deptUsers.length)];
      const form = formsWithItems.find((f) =>
        f.departments && f.departments.some((d) => (d._id || d).toString() === deptId)
      ) || formsWithItems[0];
      const items = checklistItemsByForm.get(form._id.toString());
      if (!items || items.length === 0) continue;

      const patient = patients.find((p) => p._id.toString() === admission.patient.toString());
      const auditDate = new Date(admission.admissionDate);
      auditDate.setUTCHours(0, 0, 0, 0);
      const hour = 8 + Math.floor(Math.random() * 10);
      const minute = Math.floor(Math.random() * 60);
      const auditTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const unitChief = chiefs.length > 0 ? chiefs[Math.floor(Math.random() * chiefs.length)].name : undefined;

      for (const item of items) {
        const responseType = item.responseType || 'YES_NO';
        const isYesNo = responseType === 'YES_NO';
        const responseValue = isYesNo ? (Math.random() < 0.85 ? 'YES' : 'NO') : '';
        const remarks =
          isYesNo && responseValue === 'NO'
            ? REMARKS_FOR_NO[Math.floor(Math.random() * REMARKS_FOR_NO.length)]
            : '';

        await AuditSubmission.create({
          department: dept._id,
          formTemplate: form._id,
          patient: admission.patient,
          admission: admission._id,
          uhid: admission.uhid,
          ipid: admission.ipid,
          patientName: (patient && patient.patientName) || 'Patient',
          unitChief,
          checklistItemId: item._id,
          responseValue,
          yesNoNa: responseValue,
          remarks,
          submittedBy: submittingUser._id,
          submittedAt: new Date(),
          auditDate,
          auditTime,
          isLocked: true,
        });
        submissionCount++;
      }
    }
    console.log(`   ✅ Created ${submissionCount} audit submissions with auditDate & auditTime\n`);

    console.log('✅ Done. Old submissions removed; proper data seeded (YES=no remarks, NO=with remarks).\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
