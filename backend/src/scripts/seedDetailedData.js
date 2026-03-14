/**
 * Detailed seed script for every screen:
 * - 12 departments
 * - 12 form templates (one per department) with detailed checklist items
 * - 30 auditors (doctors, MRD staff, lab technicians) across departments
 * - 5 chiefs
 * - 60 patients with multiple admissions per UHID (2–4 IPIDs per patient)
 * - Multiple checklist sessions per UHID (up to 3 IPIDs per patient with checklist; distinct date/time; ward/unit per admission)
 * - ~500 audit submissions
 *
 * Auditors include doctors, MRD department staff, and lab technicians.
 */

const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
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

// 12 departments (including MRD and Lab)
const DEPARTMENTS = [
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
  { name: 'MRD', code: 'MRD' },
  { name: 'Laboratory', code: 'LAB' },
];

// 5 chiefs with their department codes
const CHIEF_DOCTORS = [
  { name: 'Dr. Rajesh Kumar', designation: 'Chief of Medicine', deptCode: 'GM' },
  { name: 'Dr. Priya Sharma', designation: 'Chief of Surgery', deptCode: 'GS' },
  { name: 'Dr. Amit Patel', designation: 'Head of Orthopedics', deptCode: 'ORTHO' },
  { name: 'Dr. Sunita Singh', designation: 'Chief Cardiologist', deptCode: 'CS' },
  { name: 'Dr. Vikram Reddy', designation: 'Head of Pediatrics', deptCode: 'PED' },
];

// 30 auditors: role prefix and base name (doctors, MRD staff, lab techs)
const AUDITOR_SPECS = [
  // Doctors (16) - various departments
  { prefix: 'Dr.', name: 'Anjali Gupta' },
  { prefix: 'Dr.', name: 'Rahul Verma' },
  { prefix: 'Dr.', name: 'Kavita Jain' },
  { prefix: 'Dr.', name: 'Suresh Mehta' },
  { prefix: 'Dr.', name: 'Meera Shah' },
  { prefix: 'Dr.', name: 'Arjun Desai' },
  { prefix: 'Dr.', name: 'Deepika Rao' },
  { prefix: 'Dr.', name: 'Mohan Nair' },
  { prefix: 'Dr.', name: 'Shilpa Iyer' },
  { prefix: 'Dr.', name: 'Kiran Menon' },
  { prefix: 'Dr.', name: 'Neha Pillai' },
  { prefix: 'Dr.', name: 'Ravi Krishnan' },
  { prefix: 'Dr.', name: 'Pooja Nambiar' },
  { prefix: 'Dr.', name: 'Anil Thomas' },
  { prefix: 'Dr.', name: 'Radha Unni' },
  { prefix: 'Dr.', name: 'Sandeep Mathew' },
  // MRD department staff (8)
  { prefix: 'MRD Staff', name: 'Swati Deshmukh' },
  { prefix: 'MRD Staff', name: 'Nikhil Kulkarni' },
  { prefix: 'MRD Officer', name: 'Divya Joshi' },
  { prefix: 'MRD Staff', name: 'Aditya Pawar' },
  { prefix: 'MRD Officer', name: 'Kirti Rane' },
  { prefix: 'MRD Staff', name: 'Varun Shinde' },
  { prefix: 'MRD Staff', name: 'Pallavi Gaikwad' },
  { prefix: 'MRD Officer', name: 'Rohit Bhandari' },
  // Lab technicians (6)
  { prefix: 'Lab Tech', name: 'Amit Singh' },
  { prefix: 'Lab Technician', name: 'Priyanka Sharma' },
  { prefix: 'Lab Tech', name: 'Vikram Patel' },
  { prefix: 'Lab Technician', name: 'Anita Reddy' },
  { prefix: 'Lab Tech', name: 'Sanjay Kumar' },
  { prefix: 'Lab Technician', name: 'Lakshmi Nair' },
];

// Detailed checklist item definitions (label, description, section) - 16 per form
const CHECKLIST_DEFS = [
  { section: 'Admission', label: 'Patient identification verified', description: 'Verify patient name, UHID, and date of birth on admission slip' },
  { section: 'Admission', label: 'Admission slip completed in full', description: 'All mandatory fields on admission slip filled and signed' },
  { section: 'Admission', label: 'Bed and ward allocation documented', description: 'Ward, unit, and bed number recorded in system' },
  { section: 'Consent', label: 'Consent form signed and documented', description: 'Procedure-specific consent obtained and witnessed' },
  { section: 'Consent', label: 'High-risk consent checklist completed', description: 'Where applicable, high-risk consent checklist signed' },
  { section: 'Medication', label: 'Medication chart updated', description: 'Current medications documented with dose, route, frequency' },
  { section: 'Medication', label: 'Allergies documented', description: 'Patient allergies and reactions recorded in medical record' },
  { section: 'Medication', label: 'Drug reconciliation done at admission', description: 'Pre-admission and current drugs reconciled and documented' },
  { section: 'Vital signs', label: 'Vital signs recorded', description: 'Temperature, BP, pulse, respiratory rate documented' },
  { section: 'Vital signs', label: 'Vital signs within acceptable range', description: 'Abnormal values flagged and action taken if required' },
  { section: 'Infection control', label: 'Hand hygiene and PPE protocols followed', description: 'Hand hygiene before and after patient contact; PPE as per policy' },
  { section: 'Infection control', label: 'Isolation precautions documented if applicable', description: 'Isolation type and precautions clearly documented' },
  { section: 'Documentation', label: 'Progress notes entered within 24 hours', description: 'Clinical progress notes dated and signed' },
  { section: 'Documentation', label: 'Investigation reports filed in record', description: 'Relevant investigation reports attached and reviewed' },
  { section: 'Discharge', label: 'Discharge summary completed', description: 'Discharge summary with diagnosis, treatment, and follow-up' },
  { section: 'Discharge', label: 'Patient education and follow-up given', description: 'Disease process, medications, and follow-up explained to patient/family' },
];

const FIRST_NAMES = [
  'Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Anjali', 'Rahul', 'Kavita',
  'Suresh', 'Meera', 'Arjun', 'Deepika', 'Mohan', 'Shilpa', 'Kiran', 'Neha',
  'Ravi', 'Pooja', 'Anil', 'Radha', 'Sandeep', 'Swati', 'Nikhil', 'Divya',
  'Aditya', 'Kirti', 'Varun', 'Pallavi', 'Rohit', 'Lakshmi', 'Sanjay', 'Anita',
  'Vijay', 'Preeti', 'Manish', 'Sneha', 'Ganesh', 'Kavitha', 'Ramesh', 'Latha',
  'Siva', 'Uma', 'Karthik', 'Shruti', 'Prakash', 'Geeta', 'Venkat', 'Anjana',
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Jain',
  'Mehta', 'Shah', 'Desai', 'Rao', 'Nair', 'Iyer', 'Menon', 'Pillai',
  'Krishnan', 'Nambiar', 'Thomas', 'Unni', 'Mathew', 'Deshmukh', 'Kulkarni',
  'Joshi', 'Pawar', 'Rane', 'Shinde', 'Gaikwad', 'Bhandari',
];

const WARDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'ICU', 'ICU-2', 'CCU', 'Maternity', 'Pediatric', 'Emergency'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Day Care', 'Surgical', 'Medical'];
const GENDERS = ['Male', 'Female'];

const randomDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const randomPhone = () => `9${Math.floor(Math.random() * 900000000) + 100000000}`;

const randomAddress = () => {
  const streets = ['MG Road', 'Park Street', 'Main Road', 'Church Street'];
  const areas = ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout'];
  const cities = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai'];
  return `${Math.floor(Math.random() * 999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}, ${areas[Math.floor(Math.random() * areas.length)]}, ${cities[Math.floor(Math.random() * cities.length)]} - ${Math.floor(Math.random() * 90000) + 10000}`;
};

const generateUHID = (index) => `UHID${String(index).padStart(6, '0')}`;
const generateIPID = (index) => `IPID${String(index).padStart(6, '0')}`;

const randomDiagnosis = () => {
  const diagnoses = [
    'Hypertension', 'Diabetes Mellitus', 'Acute Appendicitis', 'Pneumonia',
    'Fracture Right Femur', 'Acute Myocardial Infarction', 'Asthma',
    'Gastritis', 'Urinary Tract Infection', 'Osteoarthritis', 'Anemia',
    'Chronic Kidney Disease', 'COPD', 'Dengue Fever',
  ];
  return diagnoses[Math.floor(Math.random() * diagnoses.length)];
};

const randomDoctor = () => {
  const doctors = ['Dr. Rajesh Kumar', 'Dr. Priya Sharma', 'Dr. Amit Patel', 'Dr. Sunita Singh', 'Dr. Vikram Reddy', 'Dr. Anjali Gupta'];
  return doctors[Math.floor(Math.random() * doctors.length)];
};

// Sample corrective/preventive actions for NO-response submissions (chief data)
const CORRECTIVE_ACTIONS = [
  'Documentation to be completed within 24 hours and filed in record.',
  'Staff instructed to verify consent and document in chart before procedure.',
  'Medication reconciliation completed and chart updated; allergy sticker applied.',
  'Vital signs to be recorded every 4 hours as per protocol; abnormal values to be escalated.',
  'Hand hygiene and PPE protocol reinforced with team; training session scheduled.',
  'Progress notes entered; investigation reports filed and reviewed by consultant.',
  'Discharge summary completed; patient and family educated on follow-up and medications.',
  'Identification verified with two identifiers; wristband checked and documented.',
];

const PREVENTIVE_ACTIONS = [
  'Reminder in ward round to complete documentation same day.',
  'Checklist for consent and high-risk consent to be used for all procedures.',
  'Drug reconciliation at admission made mandatory in nursing protocol.',
  'Vital signs monitoring sheet displayed; escalation pathway communicated.',
  'Infection control audit scheduled; PPE availability checked weekly.',
  'Daily review of pending investigations; consultant sign-off before discharge.',
  'Discharge checklist to include patient education and follow-up date.',
  'Two-identifier check added to admission and handover checklist.',
];

const RUN = async () => {
  try {
    console.log('🚀 Starting detailed database seed (12 depts, 12 forms, 30 auditors, 5 chiefs, 60 patients, 2–4 IPIDs per UHID, 250 submissions)...\n');
    await connectDB();

    // ============= STEP 1: DELETE ALL DATA =============
    console.log('🧹 STEP 1: Deleting existing data...');
    await AuditSubmission.deleteMany({});
    await ChecklistItem.deleteMany({});
    await FormTemplate.deleteMany({});
    await Admission.deleteMany({});
    await Patient.deleteMany({});
    await ChiefDoctor.deleteMany({});
    await User.deleteMany({});
    await Department.deleteMany({});
    console.log('   ✅ All collections cleared\n');

    // ============= STEP 2: SEED 12 DEPARTMENTS =============
    console.log('📋 STEP 2: Creating 12 departments...');
    const createdDepts = await Department.insertMany(DEPARTMENTS);
    const deptCodeMap = new Map();
    const deptIdMap = new Map();
    createdDepts.forEach((d) => {
      deptCodeMap.set(d.code, d);
      deptIdMap.set(d._id.toString(), d);
    });
    console.log(`   ✅ Created ${createdDepts.length} departments\n`);

    // ============= STEP 3: SEED USERS (admin + 30 auditors + 5 chiefs) =============
    console.log('👥 STEP 3: Creating users (admin, 30 auditors, 5 chiefs)...');

    const adminPassword = 'TataTiago@2026';
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin@hospital.com',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'admin',
      isActive: true,
    });
    console.log('   ✅ Admin: admin@hospital.com');

    // 30 auditors: MRD dept gets MRD staff, LAB dept gets Lab techs, other 10 depts get doctors
    const mrdDept = createdDepts.find((d) => d.code === 'MRD');
    const labDept = createdDepts.find((d) => d.code === 'LAB');
    const otherDepts = createdDepts.filter((d) => d.code !== 'MRD' && d.code !== 'LAB');
    const auditorUsers = [];
    const userMap = new Map(); // deptId -> [users]

    let doctorIndex = 0;
    let mrdIndex = 0;
    let labIndex = 0;
    for (let i = 0; i < AUDITOR_SPECS.length; i++) {
      const spec = AUDITOR_SPECS[i];
      const displayName = spec.prefix.trim() ? `${spec.prefix} ${spec.name}` : spec.name;
      let dept;
      if (spec.prefix.startsWith('MRD')) {
        dept = mrdDept;
        mrdIndex++;
      } else if (spec.prefix.startsWith('Lab')) {
        dept = labDept;
        labIndex++;
      } else {
        dept = otherDepts[doctorIndex % otherDepts.length];
        doctorIndex++;
      }
      const email = `auditor${i + 1}@hospital.com`;
      const password = `Auditor@${i + 1}23`;
      const designation =
        spec.prefix.startsWith('MRD') ? 'MRD Staff' : spec.prefix.startsWith('Lab') ? 'Lab Technician' : 'Doctor';
      const user = await User.create({
        name: displayName,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'auditor',
        designation,
        department: dept._id,
        isActive: true,
      });
      auditorUsers.push({ user, displayName, dept: dept.name, email, password });
      const key = dept._id.toString();
      if (!userMap.has(key)) userMap.set(key, []);
      userMap.get(key).push(user);
    }
    console.log(`   ✅ Created 30 auditors (doctors, MRD staff, lab technicians)\n`);

    // 5 chiefs (ChiefDoctor records + User accounts for correctivePreventiveBy)
    const createdChiefs = [];
    const chiefUsers = [];
    const chiefUserIds = []; // User _ids for correctivePreventiveBy on submissions
    for (let i = 0; i < CHIEF_DOCTORS.length; i++) {
      const chief = CHIEF_DOCTORS[i];
      const chiefDept = deptCodeMap.get(chief.deptCode);
      if (!chiefDept) continue;
      const chiefDoc = await ChiefDoctor.create({
        name: chief.name,
        designation: chief.designation,
        department: chiefDept._id,
        isActive: true,
        order: i,
      });
      createdChiefs.push(chiefDoc);
      const chiefEmail = `chief${i + 1}@hospital.com`;
      const chiefPassword = `Chief@${i + 1}23`;
      const chiefUser = await User.create({
        name: chief.name,
        email: chiefEmail,
        passwordHash: await bcrypt.hash(chiefPassword, 10),
        role: 'chief',
        designation: 'Chief',
        department: chiefDept._id,
        isActive: true,
      });
      chiefUserIds.push(chiefUser._id);
      chiefUsers.push({ name: chief.name, department: chiefDept.name, email: chiefEmail, password: chiefPassword });
    }
    console.log('   ✅ Created 5 chiefs\n');

    // ============= STEP 4: 12 FORM TEMPLATES + CHECKLIST ITEMS =============
    console.log('📝 STEP 4: Creating 12 form templates with checklist items...');
    const formTemplates = [];
    const checklistItemsByForm = new Map();

    const formSections = [
      { name: 'Admission', order: 1, description: 'Admission slip and identification' },
      { name: 'Consent', order: 2, description: 'Consent and high-risk consent' },
      { name: 'Medication', order: 3, description: 'Medication chart and reconciliation' },
      { name: 'Vital signs', order: 4, description: 'Vital signs and monitoring' },
      { name: 'Infection control', order: 5, description: 'Hand hygiene and isolation' },
      { name: 'Documentation', order: 6, description: 'Progress notes and investigations' },
      { name: 'Discharge', order: 7, description: 'Discharge summary and follow-up' },
    ];
    for (const dept of createdDepts) {
      const form = await FormTemplate.create({
        name: `${dept.name} Audit Form`,
        description: `Quality audit checklist for ${dept.name}`,
        departments: [dept._id],
        isCommon: false,
        assignedUsers: [],
        sections: formSections,
        isActive: true,
      });
      formTemplates.push(form);

      const items = CHECKLIST_DEFS.map((def, idx) => ({
        label: def.label,
        description: def.description,
        section: def.section,
        responseType: 'YES_NO',
        isMandatory: idx < 10,
        order: idx + 1,
        formTemplate: form._id,
        department: dept._id,
        departmentScope: 'SINGLE',
      }));
      const createdItems = await ChecklistItem.insertMany(items);
      checklistItemsByForm.set(form._id.toString(), createdItems);
    }
    console.log(`   ✅ Created 12 forms with ${CHECKLIST_DEFS.length} items each\n`);

    // Cross-audit only: assign users from OTHER departments to each form (not same department)
    for (let f = 0; f < formTemplates.length; f++) {
      const form = formTemplates[f];
      const formDeptId = form.departments[0].toString();
      const otherDeptIds = createdDepts.filter((d) => d._id.toString() !== formDeptId).map((d) => d._id.toString());
      const usersFromOtherDepts = [];
      for (const oid of otherDeptIds) {
        const list = userMap.get(oid) || [];
        usersFromOtherDepts.push(...list);
      }
      const userIds = usersFromOtherDepts.slice(0, 3).map((u) => u._id);
      form.assignedUsers = userIds;
      await form.save();
    }
    console.log('   ✅ Assigned auditors to forms (cross-department only)\n');

    // ============= STEP 5: 60 PATIENTS + MULTIPLE ADMISSIONS (IPIDs) PER UHID =============
    console.log('👨‍⚕️ STEP 5: Creating 60 patients with 2–4 admissions (IPIDs) per UHID...');
    const patients = [];
    const admissions = [];
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const today = new Date();

    for (let i = 1; i <= 60; i++) {
      const patientName = `${FIRST_NAMES[(i - 1) % FIRST_NAMES.length]} ${LAST_NAMES[(i - 1) % LAST_NAMES.length]}`;
      const gender = GENDERS[i % 2];
      const age = Math.floor(Math.random() * 50) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      const patient = await Patient.create({
        uhid: generateUHID(i),
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);

      // 2–4 admissions (IPIDs) per patient so same UHID has multiple IPIDs
      const numAdmissions = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numAdmissions; j++) {
        const admissionDate = randomDate(twoMonthsAgo, today);
        const isDischarged = Math.random() > 0.25;
        const dischargeDate = isDischarged
          ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
          : null;
        const dept = createdDepts[Math.floor(Math.random() * createdDepts.length)];
        const ipid = generateIPID(admissions.length + 1);
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
          department: dept._id,
          diagnosis: randomDiagnosis(),
          admittingDoctor: randomDoctor(),
        });
        admissions.push(admission);
      }
    }
    console.log(`   ✅ Created ${patients.length} patients, ${admissions.length} admissions\n`);

    // ============= STEP 6: MORE CHECKLIST PER PATIENT – ONE UHID, MULTIPLE IPIDs, DIFFERENT DATE/TIME, WARD/UNIT =============
    console.log('📊 STEP 6: Creating checklist submissions (multiple IPIDs per UHID, distinct date/time, ward/unit per admission)...');
    const validPairs = [];
    for (const admission of admissions) {
      const deptId = admission.department.toString();
      const form = formTemplates.find((f) => f.departments[0].toString() === deptId);
      const usersInDept = userMap.get(deptId) || [];
      if (form && usersInDept.length > 0) {
        const items = checklistItemsByForm.get(form._id.toString());
        if (items && items.length > 0) {
          validPairs.push({ admission, form, items, deptId, usersInDept });
        }
      }
    }
    // Group by UHID so each patient gets multiple IPIDs with checklist (each with different date/time, ward/unit)
    const pairsByUHID = new Map();
    for (const pair of validPairs) {
      const uhid = pair.admission.uhid;
      if (!pairsByUHID.has(uhid)) pairsByUHID.set(uhid, []);
      pairsByUHID.get(uhid).push(pair);
    }
    const TARGET_SUBMISSIONS = 500;
    let totalSubmissions = 0;
    const uhidKeys = Array.from(pairsByUHID.keys());
    for (let i = uhidKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uhidKeys[i], uhidKeys[j]] = [uhidKeys[j], uhidKeys[i]];
    }
    for (const uhid of uhidKeys) {
      if (totalSubmissions >= TARGET_SUBMISSIONS) break;
      const pairs = pairsByUHID.get(uhid);
      // Up to 3 IPIDs (admissions) per UHID with full checklist each – different date/time per IPID
      const maxBatches = Math.min(3, pairs.length);
      for (let b = 0; b < maxBatches && totalSubmissions < TARGET_SUBMISSIONS; b++) {
        const { admission, form, items, deptId, usersInDept } = pairs[b];
        const itemsToUse = Math.min(TARGET_SUBMISSIONS - totalSubmissions, items.length);
        if (itemsToUse <= 0) break;
        const selectedItems = items.slice(0, itemsToUse);
        const submittingUser = usersInDept[Math.floor(Math.random() * usersInDept.length)];
        const chief = createdChiefs[Math.floor(Math.random() * createdChiefs.length)];
        const patient = patients.find((p) => p._id.toString() === admission.patient.toString());
        // Distinct audit date/time per IPID (ward/unit from admission)
        const auditDate = new Date(admission.admissionDate);
        auditDate.setUTCHours(0, 0, 0, 0);
        const hour = 8 + Math.floor(Math.random() * 10);
        const minute = 15 * Math.floor(Math.random() * 4); // 00, 15, 30, 45
        const auditTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const submissionDate = new Date(
          admission.admissionDate.getTime() +
            Math.random() * (today.getTime() - admission.admissionDate.getTime())
        );
        const chiefUser = chiefUserIds.length > 0 ? chiefUserIds[Math.floor(Math.random() * chiefUserIds.length)] : null;
        const correctivePreventiveAt = new Date(submissionDate.getTime() + Math.random() * 86400000 * 2);

        for (const item of selectedItems) {
          const responseValue = Math.random() < 0.85 ? 'YES' : 'NO';
          const remarks =
            responseValue === 'NO'
              ? ['Documentation pending', 'To be completed', 'Follow-up required', 'Noted for correction'][
                  Math.floor(Math.random() * 4)
                ]
              : '';
          const isNo = responseValue === 'NO';
          const corrective = isNo ? CORRECTIVE_ACTIONS[Math.floor(Math.random() * CORRECTIVE_ACTIONS.length)] : '';
          const preventive = isNo ? PREVENTIVE_ACTIONS[Math.floor(Math.random() * PREVENTIVE_ACTIONS.length)] : '';
          await AuditSubmission.create({
            department: admission.department,
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
            responsibility: ['Nurse', 'Doctor', 'Staff', 'MRD', 'Lab'][Math.floor(Math.random() * 5)],
            submittedBy: submittingUser._id,
            submittedAt: submissionDate,
            auditDate,
            auditTime,
            unitChief: chief.name,
            corrective,
            preventive,
            correctivePreventiveBy: isNo && chiefUser ? chiefUser : undefined,
            correctivePreventiveAt: isNo && chiefUser ? correctivePreventiveAt : undefined,
            isLocked: true,
          });
          totalSubmissions++;
        }
      }
    }
    console.log(`   ✅ Created ${totalSubmissions} audit submissions (multiple IPIDs per UHID, distinct date/time; ward/unit on each admission)\n`);

    // ============= SUMMARY =============
    console.log('='.repeat(70));
    console.log('🎉 DETAILED SEED COMPLETED');
    console.log('='.repeat(70));
    console.log('\n📊 DATA SUMMARY:');
    console.log(`   Departments: ${createdDepts.length}`);
    console.log(`   Form templates: ${formTemplates.length}`);
    console.log(`   Auditors: ${auditorUsers.length} (doctors, MRD staff, lab technicians)`);
    console.log(`   Chiefs: ${createdChiefs.length}`);
    console.log(`   Patients: ${patients.length}`);
    console.log(`   Admissions: ${admissions.length}`);
    console.log(`   Audit submissions: ${totalSubmissions} (multiple IPIDs per UHID, ward/unit per admission)`);

    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('   Admin: admin@hospital.com / ' + adminPassword);
    console.log('   Chiefs: chief1@hospital.com … chief5@hospital.com / Chief@123 … Chief@523');
    console.log('   Auditors: auditor1@hospital.com … auditor30@hospital.com / Auditor@123 … Auditor@3023');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err);
    process.exit(1);
  }
};

RUN();
