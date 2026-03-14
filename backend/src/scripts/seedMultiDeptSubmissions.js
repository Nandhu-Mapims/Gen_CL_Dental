/**
 * Seed 50 more patients with SINGLE IPID each.
 * Each IPID has multiple submissions against SAME and DIFFERENT departments:
 *   e.g. IPID000034 – ENT (4 submissions, different date/time), Ortho (2), Gynecology/OG (3).
 *
 * Requires: Run seedDetailedData.js first (departments, forms, checklist items, users, chiefs exist).
 */

const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const User = require('../models/User');
const ChiefDoctor = require('../models/ChiefDoctor');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');

dotenv.config();

const WARDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'ICU', 'CCU', 'Maternity'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'];
const GENDERS = ['Male', 'Female'];
const FIRST_NAMES = ['Vijay', 'Preeti', 'Manish', 'Sneha', 'Ganesh', 'Kavitha', 'Ramesh', 'Latha', 'Siva', 'Uma', 'Karthik', 'Shruti', 'Prakash', 'Geeta', 'Venkat', 'Anjana', 'Bala', 'Chitra', 'Dinesh', 'Esha'];
const LAST_NAMES = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Jain', 'Mehta', 'Shah', 'Desai', 'Rao', 'Nair', 'Iyer', 'Menon'];

const randomDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const randomPhone = () => `9${Math.floor(Math.random() * 900000000) + 100000000}`;
const randomAddress = () => {
  const streets = ['MG Road', 'Park Street', 'Main Road'];
  const areas = ['Koramangala', 'Indiranagar', 'Whitefield'];
  const cities = ['Bangalore', 'Mumbai', 'Delhi'];
  return `${Math.floor(Math.random() * 999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}, ${areas[Math.floor(Math.random() * areas.length)]}, ${cities[Math.floor(Math.random() * cities.length)]} - ${Math.floor(Math.random() * 90000) + 10000}`;
};
const randomDiagnosis = () => {
  const d = ['Hypertension', 'Diabetes Mellitus', 'Acute Appendicitis', 'Pneumonia', 'Fracture Right Femur', 'Asthma', 'Gastritis', 'Anemia'];
  return d[Math.floor(Math.random() * d.length)];
};
const randomDoctor = () => {
  const d = ['Dr. Rajesh Kumar', 'Dr. Priya Sharma', 'Dr. Amit Patel', 'Dr. Sunita Singh', 'Dr. Vikram Reddy'];
  return d[Math.floor(Math.random() * d.length)];
};

const CORRECTIVE_ACTIONS = [
  'Documentation to be completed within 24 hours.',
  'Staff instructed to verify consent and document in chart.',
  'Medication reconciliation completed; allergy sticker applied.',
  'Vital signs to be recorded every 4 hours as per protocol.',
];
const PREVENTIVE_ACTIONS = [
  'Reminder in ward round to complete documentation same day.',
  'Checklist for consent to be used for all procedures.',
  'Drug reconciliation at admission made mandatory.',
  'Two-identifier check added to admission checklist.',
];

const RUN = async () => {
  try {
    console.log('🚀 Seed: 50 patients (single IPID each), multi-dept submissions with different date/time...\n');
    await connectDB();

    const departments = await Department.find({}).lean();
    const formTemplates = await FormTemplate.find({ isActive: true }).populate('departments', 'name code').lean();
    const chiefs = await ChiefDoctor.find({ isActive: true }).lean();
    const chiefUsers = await User.find({ role: 'chief' }).select('_id').lean();
    const allAuditors = await User.find({ role: 'auditor', isActive: true }).populate('department').lean();

    if (departments.length === 0 || formTemplates.length === 0) {
      console.error('Run seedDetailedData.js first (departments and form templates required).');
      process.exit(1);
    }

    const checklistItemsByForm = new Map();
    for (const form of formTemplates) {
      const deptId = form.departments && form.departments[0] ? form.departments[0]._id : null;
      if (!deptId) continue;
      const items = await ChecklistItem.find({ formTemplate: form._id, isActive: true }).sort({ order: 1 }).lean();
      checklistItemsByForm.set(form._id.toString(), { form, deptId, items });
    }

    const userMap = new Map();
    for (const u of allAuditors) {
      const key = u.department ? u.department._id.toString() : 'none';
      if (!userMap.has(key)) userMap.set(key, []);
      userMap.get(key).push(u);
    }
    const anyUsers = allAuditors.length > 0 ? allAuditors : [];

    const patientCount = await Patient.countDocuments();
    const admissionCount = await Admission.countDocuments();
    const basePatientIndex = patientCount + 1;
    const baseAdmissionIndex = admissionCount + 1;

    const generateUHID = (i) => `UHID${String(basePatientIndex + i - 1).padStart(6, '0')}`;
    const generateIPID = (i) => `IPID${String(baseAdmissionIndex + i - 1).padStart(6, '0')}`;

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const today = new Date();

    const patients = [];
    const admissions = [];

    console.log('👨‍⚕️ Creating 50 patients with single admission (IPID) each...');
    for (let i = 0; i < 50; i++) {
      const patientName = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
      const gender = GENDERS[i % 2];
      const age = Math.floor(Math.random() * 50) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      const patient = await Patient.create({
        uhid: generateUHID(i + 1),
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);

      const admissionDate = randomDate(twoMonthsAgo, today);
      const isDischarged = Math.random() > 0.3;
      const dischargeDate = isDischarged
        ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
        : null;
      const admittingDept = departments[Math.floor(Math.random() * departments.length)];
      const ipid = generateIPID(i + 1);
      const admission = await Admission.create({
        ipid,
        patient: patient._id,
        uhid: patient.uhid,
        admissionDate,
        dischargeDate,
        ward: WARDS[Math.floor(Math.random() * WARDS.length)],
        unitNo: UNITS[Math.floor(Math.random() * UNITS.length)],
        admissionType: Math.random() > 0.5 ? 'Emergency' : 'Elective',
        status: isDischarged ? 'Discharged' : 'Admitted',
        department: admittingDept._id,
        diagnosis: randomDiagnosis(),
        admittingDoctor: randomDoctor(),
      });
      admissions.push(admission);
    }
    console.log(`   ✅ ${patients.length} patients, ${admissions.length} admissions (single IPID each)\n`);

    console.log('📊 Creating multi-dept submissions per IPID (same + different depts, different date/time)...');
    let totalSubmissions = 0;
    const clinicalForms = formTemplates.filter((f) => f.departments && f.departments[0] && f.departments[0].code && !['MRD', 'LAB'].includes(f.departments[0].code));
    const formsToPick = clinicalForms.length > 0 ? clinicalForms : formTemplates;

    for (let a = 0; a < admissions.length; a++) {
      const admission = admissions[a];
      const patient = patients[a];
      const numDepts = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...formsToPick].sort(() => Math.random() - 0.5);
      const selectedForms = shuffled.slice(0, numDepts);

      for (const form of selectedForms) {
        const entry = checklistItemsByForm.get(form._id.toString());
        if (!entry || !entry.items || entry.items.length === 0) continue;
        const { deptId, items } = entry;
        const formDept = departments.find((d) => d._id.toString() === deptId.toString());
        if (!formDept) continue;

        const numSessions = 2 + Math.floor(Math.random() * 3);
        const usersForSubmit = userMap.get(formDept._id.toString()) || anyUsers;
        const submittingUser = usersForSubmit[Math.floor(Math.random() * usersForSubmit.length)];
        if (!submittingUser) continue;

        const chief = chiefs.length > 0 ? chiefs[Math.floor(Math.random() * chiefs.length)] : null;
        const chiefUser = chiefUsers.length > 0 ? chiefUsers[Math.floor(Math.random() * chiefUsers.length)] : null;

        for (let s = 0; s < numSessions; s++) {
          const auditDate = new Date(admission.admissionDate);
          auditDate.setDate(auditDate.getDate() + Math.floor(s * 0.5));
          auditDate.setUTCHours(0, 0, 0, 0);
          const hour = 8 + Math.floor(Math.random() * 10);
          const minute = 15 * Math.floor(Math.random() * 4);
          const auditTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const submissionDate = new Date(
            admission.admissionDate.getTime() +
              Math.random() * (today.getTime() - admission.admissionDate.getTime())
          );
          const correctivePreventiveAt = new Date(submissionDate.getTime() + Math.random() * 86400000 * 2);

          const itemsPerSession = Math.min(2 + Math.floor(Math.random() * 3), items.length);
          const sessionItems = items.slice(0, itemsPerSession);

          for (const item of sessionItems) {
            const responseValue = Math.random() < 0.85 ? 'YES' : 'NO';
            const remarks = responseValue === 'NO' ? ['Documentation pending', 'To be completed', 'Follow-up required'][Math.floor(Math.random() * 3)] : '';
            const isNo = responseValue === 'NO';
            const corrective = isNo ? CORRECTIVE_ACTIONS[Math.floor(Math.random() * CORRECTIVE_ACTIONS.length)] : '';
            const preventive = isNo ? PREVENTIVE_ACTIONS[Math.floor(Math.random() * PREVENTIVE_ACTIONS.length)] : '';

            await AuditSubmission.create({
              department: formDept._id,
              formTemplate: form._id,
              patient: admission.patient,
              uhid: admission.uhid,
              ipid: admission.ipid,
              admission: admission._id,
              patientName: patient.patientName,
              checklistItemId: item._id,
              responseValue,
              yesNoNa: responseValue,
              remarks,
              responsibility: ['Nurse', 'Doctor', 'Staff'][Math.floor(Math.random() * 3)],
              submittedBy: submittingUser._id,
              submittedAt: submissionDate,
              auditDate,
              auditTime,
              unitChief: chief ? chief.name : undefined,
              corrective,
              preventive,
              correctivePreventiveBy: isNo && chiefUser ? chiefUser._id : undefined,
              correctivePreventiveAt: isNo && chiefUser ? correctivePreventiveAt : undefined,
              isLocked: true,
            });
            totalSubmissions++;
          }
        }
      }
    }

    console.log(`   ✅ ${totalSubmissions} audit submissions (multi-dept per IPID, different date/time)\n`);
    console.log('='.repeat(60));
    console.log('🎉 MULTI-DEPT SUBMISSIONS SEED COMPLETED');
    console.log('='.repeat(60));
    console.log(`   Patients: 50 (single IPID each)`);
    console.log(`   Admissions: 50`);
    console.log(`   Submissions: ${totalSubmissions} (ENT/Ortho/OG etc., multiple date/time per dept)`);
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
};

RUN();
