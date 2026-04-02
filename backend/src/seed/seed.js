const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const ChecklistItem = require('../models/ChecklistItem');
const User = require('../models/User');
const ChiefDoctor = require('../models/ChiefDoctor');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');
const FormTemplate = require('../models/FormTemplate');
const AuditSubmission = require('../models/AuditSubmission');

dotenv.config();

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
  { name: 'Medical Records Department', code: 'MRD' },
  { name: 'Quality Department', code: 'QUALITY' },
];

// Chief Doctors / Unit Chiefs with their respective departments
const CHIEF_DOCTORS = [
  { name: 'Dr. Rajesh Kumar', designation: 'Chief of Medicine', deptCode: 'GM' },
  { name: 'Dr. Priya Sharma', designation: 'Chief of Surgery', deptCode: 'GS' },
  { name: 'Dr. Amit Patel', designation: 'Head of Orthopedics', deptCode: 'ORTHO' },
  { name: 'Dr. Sunita Singh', designation: 'Chief Cardiologist', deptCode: 'CS' },
  { name: 'Dr. Vikram Reddy', designation: 'Head of Pediatrics', deptCode: 'PED' },
  { name: 'Mr. Rajan Nair', designation: 'MRD In-charge', deptCode: 'MRD' },
  { name: 'Dr. Divya Menon', designation: 'Quality Head', deptCode: 'QUALITY' },
];

// HOD (Head of Department) names - one for each department
const HOD_NAMES = [
  { name: 'Dr. Reddy', deptCode: 'OG' },
  { name: 'Dr. Sharma', deptCode: 'GM' },
  { name: 'Dr. Patel', deptCode: 'ORTHO' },
  { name: 'Dr. Singh', deptCode: 'PED' },
  { name: 'Dr. Rao', deptCode: 'OPHTHAL' },
  { name: 'Dr. Gupta', deptCode: 'CS' },
  { name: 'Dr. Verma', deptCode: 'ENT' },
  { name: 'Dr. Mehta', deptCode: 'GS' },
  { name: 'Dr. Nair', deptCode: 'ANAE' },
  { name: 'Dr. Iyer', deptCode: 'NUS' },
  { name: 'Mr. Rajan Nair', deptCode: 'MRD' },
  { name: 'Dr. Divya Menon', deptCode: 'QUALITY' },
];

// Auditors = MRD staff only (Medical Records Department); keep a small set for seed
const MRD_STAFF_NAMES = ['Rajan Nair', 'Meera Joseph', 'Suresh Kumar'];
const MRD_DESIGNATION = 'MRD Staff';

// Sample patient names
const FIRST_NAMES = [
  'Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Anjali', 'Rahul', 'Kavita',
  'Suresh', 'Meera', 'Arjun', 'Deepika', 'Mohan', 'Shilpa', 'Kiran', 'Neha',
  'Ravi', 'Pooja', 'Anil', 'Radha', 'Sandeep', 'Swati', 'Nikhil', 'Divya',
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Jain',
  'Mehta', 'Shah', 'Desai', 'Rao', 'Nair', 'Iyer', 'Menon', 'Pillai',
];

const WARDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'ICU', 'CCU', 'Maternity'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4'];
const GENDERS = ['Male', 'Female'];

// Helper functions
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const randomPhone = () => `9${Math.floor(Math.random() * 900000000) + 100000000}`;

const randomAddress = () => {
  const streets = ['MG Road', 'Park Street', 'Main Road', 'Church Street'];
  const areas = ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout'];
  const cities = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai'];
  return `${Math.floor(Math.random() * 999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}, ${areas[Math.floor(Math.random() * areas.length)]}, ${cities[Math.floor(Math.random() * cities.length)]} - ${Math.floor(Math.random() * 90000) + 10000}`;
};

const generateUHID = (index) => `UHID${String(index).padStart(6, '0')}`;
const generateIPID = (index) => `IP${String(index).padStart(4, '0')}`; // IP0001, IP0002, ... (unique per admission)

const randomDiagnosis = () => {
  const diagnoses = [
    'Hypertension', 'Diabetes Mellitus', 'Acute Appendicitis', 'Pneumonia',
    'Fracture Right Femur', 'Acute Myocardial Infarction', 'Asthma',
    'Gastritis', 'Urinary Tract Infection', 'Osteoarthritis', 'Anemia',
  ];
  return diagnoses[Math.floor(Math.random() * diagnoses.length)];
};

const randomDoctor = () => {
  const doctors = [
    'Dr. Rajesh Kumar', 'Dr. Priya Sharma', 'Dr. Amit Patel',
    'Dr. Sunita Singh', 'Dr. Vikram Reddy', 'Dr. Anjali Gupta',
  ];
  return doctors[Math.floor(Math.random() * doctors.length)];
};

const RUN = async () => {
  try {
    console.log('🚀 Starting database seed with correct flow...\n');
    await connectDB();

    // ============= STEP 1: DELETE ALL DATA =============
    console.log('🧹 STEP 1: Clearing existing data...');
    await AuditSubmission.deleteMany({});
    console.log('   ✅ Cleared audit submissions');
    await ChecklistItem.deleteMany({});
    console.log('   ✅ Cleared checklist items');
    await FormTemplate.deleteMany({});
    console.log('   ✅ Cleared form templates');
    await Admission.deleteMany({});
    console.log('   ✅ Cleared admissions');
    await Patient.deleteMany({});
    console.log('   ✅ Cleared patients');
    await ChiefDoctor.deleteMany({});
    console.log('   ✅ Cleared chief doctors');
    await User.deleteMany({});
    console.log('   ✅ Cleared users');
    await Department.deleteMany({});
    console.log('   ✅ Cleared departments\n');

    // ============= STEP 2: SEED DEPARTMENTS =============
    console.log('📋 STEP 2: Creating departments...');
    const createdDepts = await Department.insertMany(DEPARTMENTS);
    console.log(`   ✅ Created ${createdDepts.length} departments\n`);

    // Create department maps for easy lookup
    const deptCodeMap = new Map();
    const deptIdMap = new Map();
    createdDepts.forEach(dept => {
      deptCodeMap.set(dept.code, dept);
      deptIdMap.set(dept._id.toString(), dept);
    });

    // ============= STEP 3: SEED USERS =============
    console.log('👥 STEP 3: Creating users...');
    
    // Admin user
    const adminEmail = 'admin@hospital.com';
    const adminPassword = 'TataTiago@2026';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const adminUser = await User.create({
      name: 'System Administrator',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
      userContext: 'NON_CLINICAL',
      isActive: true,
    });
    console.log(`   ✅ Created admin: ${adminEmail}`);

    // Auditors = MRD staff only; all in Medical Records Department (MRD)
    const mrdDept = deptCodeMap.get('MRD');
    const doctorUsers = [];
    const userMap = new Map(); // departmentId -> [users] (used for submission submitter; MRD holds all auditors)

    if (mrdDept) {
      const mrdAuditorUsers = [];
      for (let i = 0; i < MRD_STAFF_NAMES.length; i++) {
        const name = MRD_STAFF_NAMES[i];
        const firstName = name.split(' ')[0].toLowerCase();
        const auditorEmail = `${firstName}.mrd@hospital.com`;
        const auditorPassword = `${firstName.charAt(0).toUpperCase()}${firstName.substring(1)}@123`;
        const passwordHash = await bcrypt.hash(auditorPassword, 10);

        const contexts = ['NON_CLINICAL', 'CLINICAL', 'BOTH'];
        const userContext = contexts[i % contexts.length];

        const user = await User.create({
          name,
          email: auditorEmail,
          passwordHash,
          role: 'STAFF',
          designation: MRD_DESIGNATION,
          department: mrdDept._id,
          userContext,
          isActive: true,
        });

        doctorUsers.push({ name, dept: mrdDept.name, email: auditorEmail, password: auditorPassword });
        mrdAuditorUsers.push(user);
        console.log(`   ✅ Created MRD auditor: ${name} (${auditorEmail}) — ${userContext} — ${mrdDept.name}`);
      }
      userMap.set(mrdDept._id.toString(), mrdAuditorUsers);
    } else {
      console.log('   ⚠️  MRD department not found; no auditor users created.');
    }
    console.log('');

    // ============= STEP 4: SEED CHIEF DOCTORS =============
    console.log('👨‍⚕️ STEP 4: Creating chief doctors...');
    const createdChiefs = [];
    const chiefUsers = [];
    const chiefUserMap = new Map(); // Map chief name -> User document
    
    for (let i = 0; i < CHIEF_DOCTORS.length; i++) {
      const chief = CHIEF_DOCTORS[i];
      
      // Find the department for this chief
      const chiefDept = deptCodeMap.get(chief.deptCode);
      if (!chiefDept) {
        console.log(`   ⚠️  Warning: Department ${chief.deptCode} not found for ${chief.name}`);
        continue;
      }
      
      // Create ChiefDoctor record
      const chiefDoc = await ChiefDoctor.create({
        name: chief.name,
        designation: chief.designation,
        department: chiefDept._id,
        isActive: true,
        order: i,
      });
      createdChiefs.push(chiefDoc);
      
      // Create user account for chief with 'chief' role
      const chiefEmail = `chief.${chiefDept.code.toLowerCase()}@hospital.com`;
      const chiefPassword = `Chief${chiefDept.code}@123`;
      const chiefPasswordHash = await bcrypt.hash(chiefPassword, 10);
      
      const chiefUser = await User.create({
        name: chief.name,
        email: chiefEmail,
        passwordHash: chiefPasswordHash,
        role: 'SUPERVISOR',
        designation: 'Doctor',
        department: chiefDept._id,
        isActive: true,
      });
      
      chiefUserMap.set(chief.name, chiefUser);
      
      chiefUsers.push({
        name: chief.name,
        designation: chief.designation,
        department: chiefDept.name,
        email: chiefEmail,
        password: chiefPassword,
        user: chiefUser, // Store user document reference
      });
      
      console.log(`   ✅ Created chief: ${chief.name} (${chief.designation}) - ${chiefDept.name}`);
      console.log(`      Login: ${chiefEmail} / ${chiefPassword}`);
    }
    console.log('');

    // ============= STEP 4.5: SEED HOD ACCOUNTS =============
    console.log('👔 STEP 4.5: Creating HOD (Head of Department) accounts...');
    const hodUsers = [];
    
    for (const dept of createdDepts) {
      // Find HOD name for this department
      const hodInfo = HOD_NAMES.find(h => h.deptCode === dept.code);
      const hodName = hodInfo ? hodInfo.name : `Dr. HOD ${dept.code}`;
      
      // Generate email from HOD name (strip Dr./Mr./Ms.)
      const nameWithoutPrefix = hodName.replace(/^(Dr\.|Mr\.|Ms\.)\s*/i, '').trim();
      const firstName = nameWithoutPrefix.split(' ')[0].toLowerCase();
      const hodEmail = `hod.${firstName}@hospital.com`;
      const hodPassword = `HOD${dept.code}@123`;
      const hodPasswordHash = await bcrypt.hash(hodPassword, 10);
      
      const hodUser = await User.create({
        name: hodName,
        email: hodEmail,
        passwordHash: hodPasswordHash,
        role: 'SUPERVISOR',
        designation: 'Doctor',
        department: dept._id,
        isActive: true,
      });
      
      hodUsers.push({
        name: hodName,
        department: dept.name,
        deptId: dept._id,
        email: hodEmail,
        password: hodPassword,
        user: hodUser,
      });
      
      console.log(`   ✅ Created HOD: ${hodName} (${hodEmail}) for ${dept.name}`);
    }
    console.log('');

    // ============= STEP 5: CREATE FORM TEMPLATES =============
    console.log('📝 STEP 5: Creating form templates...');
    
    const formTemplates = [];
    const clinicalDepts = createdDepts.filter(d => d.code !== 'ANAE' && d.code !== 'NUS');
    const clinicalFormSplitIdx = Math.ceil(clinicalDepts.length / 2);

    for (let idx = 0; idx < clinicalDepts.length; idx++) {
      const dept = clinicalDepts[idx];
      const isClinicalForm = idx >= clinicalFormSplitIdx;
      const form = await FormTemplate.create({
        name: isClinicalForm
          ? `${dept.name} — Clinical patient audit`
          : `${dept.name} Audit Form`,
        description: isClinicalForm
          ? `Bedside / ward clinical audit for ${dept.name} (patient UHID required on submit)`
          : `Quality audit checklist for ${dept.name} department`,
        departments: [dept._id],
        isActive: true,
        formContext: isClinicalForm ? 'CLINICAL' : 'NON_CLINICAL',
      });
      formTemplates.push(form);
      console.log(`   ✅ Created form: ${form.name} (${form.formContext})`);
    }
    console.log('');

    // ============= STEP 6: CREATE CHECKLIST ITEMS =============
    console.log('✅ STEP 6: Creating checklist items for each form...');
    
    const checklistItemsByForm = new Map();
    
    for (const form of formTemplates) {
      const deptId = form.departments[0].toString();
      const dept = deptIdMap.get(deptId);
      
      const items = [
        {
          label: 'Patient identification verified',
          description: 'Verify patient name, UHID, and date of birth',
          responseType: 'YES_NO',
          isMandatory: true,
          order: 1,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Consent form signed and documented',
          description: 'Ensure proper consent is obtained and documented',
          responseType: 'YES_NO',
          isMandatory: true,
          order: 2,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Medication chart updated',
          description: 'Current medications documented in chart',
          responseType: 'YES_NO',
          isMandatory: true,
          order: 3,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Allergies documented',
          description: 'Patient allergies recorded in medical record',
          responseType: 'YES_NO',
          isMandatory: true,
          order: 4,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Vital signs recorded',
          description: 'Temperature, BP, pulse, respiratory rate documented',
          responseType: 'YES_NO',
          isMandatory: true,
          order: 5,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Infection control measures followed',
          description: 'Hand hygiene and PPE protocols followed',
          responseType: 'YES_NO',
          isMandatory: true,
          order: 6,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Patient education provided',
          description: 'Disease process and treatment explained to patient/family',
          responseType: 'YES_NO',
          isMandatory: false,
          order: 7,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
        {
          label: 'Discharge planning initiated',
          description: 'Discharge needs assessed and documented',
          responseType: 'YES_NO',
          isMandatory: false,
          order: 8,
          formTemplate: form._id,
          department: dept._id,
          departmentScope: 'SINGLE',
        },
      ];
      
      const createdItems = await ChecklistItem.insertMany(items);
      checklistItemsByForm.set(form._id.toString(), createdItems);
      console.log(`   ✅ Created ${createdItems.length} items for ${form.name}`);
    }
    console.log('');

    // MRD staff: assign by form type — clinical-only users only on clinical forms, non-clinical-only only on non-clinical (BOTH on both)
    const mrdList = mrdDept ? userMap.get(mrdDept._id.toString()) || [] : [];
    const mrdIdsNonClinical = mrdList
      .filter((u) => u.userContext === 'NON_CLINICAL' || u.userContext === 'BOTH')
      .map((u) => u._id);
    const mrdIdsClinical = mrdList
      .filter((u) => u.userContext === 'CLINICAL' || u.userContext === 'BOTH')
      .map((u) => u._id);
    if (formTemplates.length > 0 && (mrdIdsNonClinical.length > 0 || mrdIdsClinical.length > 0)) {
      for (const form of formTemplates) {
        const assigneeIds = form.formContext === 'CLINICAL' ? mrdIdsClinical : mrdIdsNonClinical;
        await FormTemplate.updateOne({ _id: form._id }, { $set: { assignedUsers: assigneeIds } });
      }
      console.log(
        `   ✅ Assigned MRD users by form context: non-clinical forms → ${mrdIdsNonClinical.length} user(s), clinical forms → ${mrdIdsClinical.length} user(s) (${formTemplates.length} forms)`
      );
    }
    console.log('');

    // ============= STEP 7: CREATE PATIENTS & ADMISSIONS =============
    console.log('👨‍⚕️ STEP 7: Creating patients and admissions...');
    
    const patients = [];
    const admissions = [];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const today = new Date();
    
    const numPatients = 50; // 50 patients; each gets 2–5 admissions (IPIDs) per UHID
    let ipidCounter = 1; // Global unique IPID index (IP0001, IP0002, ...)
    
    for (let i = 1; i <= numPatients; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const patientName = `${firstName} ${lastName}`;
      const uhid = generateUHID(i);
      const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
      
      const age = Math.floor(Math.random() * 62) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);

      const patient = await Patient.create({
        uhid,
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);

      // Min 2, max 5 IPIDs (admissions) per UHID
      const numAdmissions = 2 + Math.floor(Math.random() * 4);
      
      for (let j = 0; j < numAdmissions; j++) {
        const admissionDate = randomDate(sixMonthsAgo, today);
        const isDischarged = Math.random() > 0.3;
        const dischargeDate = isDischarged 
          ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
          : null;
        
        const dept = clinicalDepts[Math.floor(Math.random() * clinicalDepts.length)];
        const ipid = generateIPID(ipidCounter++);

        const ward = WARDS[Math.floor(Math.random() * WARDS.length)];
        const unitNo = UNITS[Math.floor(Math.random() * UNITS.length)];

        const admission = await Admission.create({
          ipid,
          patient: patient._id,
          uhid: patient.uhid,
          admissionDate,
          dischargeDate,
          ward,
          unitNo,
          admissionType: Math.random() > 0.5 ? 'Emergency' : 'Elective',
          status: isDischarged ? 'Discharged' : 'Admitted',
          department: dept._id,
          diagnosis: randomDiagnosis(),
          admittingDoctor: randomDoctor(),
        });
        admissions.push(admission);
      }
      
      if (i % 10 === 0) {
        console.log(`   ✅ Created ${i} patients with admissions...`);
      }
    }
    console.log(`   ✅ Total: ${patients.length} patients, ${admissions.length} admissions\n`);

    // ============= STEP 8: CREATE AUDIT SUBMISSIONS =============
    console.log('📊 STEP 8: Creating audit submissions...');
    
    const submissions = [];
    const correctiveActions = [
      'Immediate review of patient identification process',
      'Staff training on consent documentation',
      'Medication reconciliation process updated',
      'Allergy documentation protocol reinforced',
      'Vital signs monitoring schedule standardized',
      'Infection control audit conducted',
      'Patient education materials updated',
      'Discharge planning checklist implemented',
    ];
    
    const preventiveActions = [
      'Regular audits scheduled monthly',
      'Staff competency assessment planned',
      'Process improvement team formed',
      'Quality indicators monitoring established',
      'Training program developed',
      'Standard operating procedures updated',
      'Patient feedback system implemented',
      'Continuous monitoring protocol initiated',
    ];
    
    let submissionCount = 0;

    const mrdDeptIdForSubmissions = mrdDept ? mrdDept._id.toString() : null;
    const mrdAuditors = mrdDeptIdForSubmissions ? userMap.get(mrdDeptIdForSubmissions) : [];

    const supervisorIdsForDept = (deptIdStr) => {
      const ids = [];
      for (const c of chiefUsers) {
        if (c.user && c.user.department && c.user.department.toString() === deptIdStr) {
          ids.push(c.user._id);
        }
      }
      for (const h of hodUsers) {
        if (h.deptId && h.deptId.toString() === deptIdStr && h.user) {
          ids.push(h.user._id);
        }
      }
      return ids;
    };

    for (const admission of admissions) {
      const deptId = admission.department.toString();
      const dept = deptIdMap.get(deptId);

      if (!mrdAuditors || mrdAuditors.length === 0) continue;

      const form = formTemplates.find((f) => f.departments.some((d) => d.toString() === deptId));
      if (!form) continue;

      const items = checklistItemsByForm.get(form._id.toString());
      if (!items) continue;

      const submittingUser = mrdAuditors[Math.floor(Math.random() * mrdAuditors.length)];

      const deptChiefs = createdChiefs.filter((c) => {
        const chiefDept = deptCodeMap.get(CHIEF_DOCTORS.find((cd) => cd.name === c.name)?.deptCode);
        return chiefDept && chiefDept._id.toString() === deptId;
      });
      const assignedChief = deptChiefs.length > 0
        ? deptChiefs[Math.floor(Math.random() * deptChiefs.length)]
        : createdChiefs[Math.floor(Math.random() * createdChiefs.length)];

      const supIds = supervisorIdsForDept(deptId);
      const assignedSupervisorId =
        supIds.length > 0 ? supIds[Math.floor(Math.random() * supIds.length)] : null;

      const numToSubmit = Math.floor(items.length * (0.8 + Math.random() * 0.2));
      const selectedItems = items.slice(0, numToSubmit);

      const patient = patients.find((p) => p._id.toString() === admission.patient.toString());

      for (const item of selectedItems) {
        const responseValue = Math.random() < 0.8 ? 'YES' : 'NO';

        const daysSinceAdmission = Math.floor(
          (today.getTime() - admission.admissionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysAgo = Math.floor(Math.random() * Math.min(daysSinceAdmission, 180));
        const submissionDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        const remarks =
          Math.random() > 0.5
            ? [
                'Completed as per protocol',
                'Verified and documented',
                'All requirements met',
                'Reviewed and confirmed',
                'Documented in chart',
              ][Math.floor(Math.random() * 5)]
            : responseValue === 'NO'
              ? 'See unit protocol'
              : '';

        const hasActions = Math.random() < 0.3 && responseValue === 'NO';
        const corrective = hasActions
          ? correctiveActions[Math.floor(Math.random() * correctiveActions.length)]
          : '';
        const preventive = hasActions
          ? preventiveActions[Math.floor(Math.random() * preventiveActions.length)]
          : '';

        const chiefUserDoc = chiefUserMap.get(assignedChief.name);
        const correctivePreventiveBy = hasActions && chiefUserDoc ? chiefUserDoc._id : null;
        const correctivePreventiveAt =
          hasActions && correctivePreventiveBy
            ? new Date(submissionDate.getTime() + Math.random() * (today.getTime() - submissionDate.getTime()))
            : null;

        const auditDate = new Date(
          Date.UTC(submissionDate.getFullYear(), submissionDate.getMonth(), submissionDate.getDate())
        );
        const auditTime = `${String(submissionDate.getHours()).padStart(2, '0')}:${String(submissionDate.getMinutes()).padStart(2, '0')}`;

        const isClinicalForm = form.formContext === 'CLINICAL';

        const submission = await AuditSubmission.create({
          department: dept._id,
          formTemplate: form._id,
          location: [admission.ward && `Ward ${admission.ward}`, admission.unitNo].filter(Boolean).join(' · ') || 'General',
          assignedToUserId: assignedSupervisorId || undefined,
          checklistItemId: item._id,
          responseValue,
          yesNoNa: responseValue === 'YES' || responseValue === 'NO' ? responseValue : undefined,
          remarks,
          responsibility: ['Nurse', 'Doctor', 'Staff', 'Pharmacist', 'Lab Technician'][
            Math.floor(Math.random() * 5)
          ],
          submittedBy: submittingUser._id,
          submittedAt: submissionDate,
          auditDate,
          auditTime,
          corrective,
          preventive,
          correctivePreventiveBy: correctivePreventiveBy || undefined,
          correctivePreventiveAt: correctivePreventiveAt || undefined,
          isLocked: true,
          patientUhid: isClinicalForm && patient ? patient.uhid : '',
          patientName: isClinicalForm && patient ? patient.patientName : '',
        });
        submissions.push(submission);
        submissionCount++;

        if (submissionCount % 50 === 0) {
          console.log(`   ✅ Created ${submissionCount} submissions...`);
        }
      }
    }
    console.log(`   ✅ Created ${submissions.length} audit submissions\n`);

    // ============= SUMMARY =============
    console.log('='.repeat(70));
    console.log('🎉 DATABASE SEED COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📊 DATA SUMMARY:');
    console.log(`   ✅ Departments: ${createdDepts.length}`);
    console.log(`   ✅ Users: ${doctorUsers.length + chiefUsers.length + hodUsers.length + 1} (1 admin + ${chiefUsers.length} chiefs + ${hodUsers.length} HODs + ${doctorUsers.length} auditors)`);
    console.log(`   ✅ Chief Doctors: ${createdChiefs.length}`);
    console.log(`   ✅ HOD Accounts: ${hodUsers.length}`);
    const clinicalFormCount = formTemplates.filter((f) => f.formContext === 'CLINICAL').length;
    console.log(`   ✅ Form Templates: ${formTemplates.length} (${clinicalFormCount} clinical, ${formTemplates.length - clinicalFormCount} non-clinical)`);
    console.log(`   ✅ Checklist Items: ${Array.from(checklistItemsByForm.values()).reduce((sum, items) => sum + items.length, 0)}`);
    console.log(`   ✅ Patients: ${patients.length}`);
    console.log(`   ✅ Admissions: ${admissions.length}`);
    console.log(`   ✅ Audit Submissions: ${submissions.length}`);
    
    // Calculate compliance rate
    const yesCount = submissions.filter(s => s.responseValue === 'YES').length;
    const noCount = submissions.filter(s => s.responseValue === 'NO').length;
    const complianceRate = ((yesCount / (yesCount + noCount)) * 100).toFixed(1);
    
    console.log(`\n📈 COMPLIANCE METRICS:`);
    console.log(`   ✅ Compliant (YES): ${yesCount}`);
    console.log(`   ❌ Non-Compliant (NO): ${noCount}`);
    console.log(`   📊 Overall Compliance Rate: ${complianceRate}%`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n👤 ADMIN ACCOUNT:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     SUPER_ADMIN (Full Access)`);
    
    console.log('\n👨‍⚕️ CHIEF DOCTOR ACCOUNTS (for validation & performance tracking):');
    chiefUsers.forEach((chief) => {
      console.log(`\n   ${chief.name} (${chief.designation}) - ${chief.department}:`);
      console.log(`   Email:    ${chief.email}`);
      console.log(`   Password: ${chief.password}`);
    });
    
    console.log('\n👔 HOD ACCOUNTS (Head of Department - View logs & doctor performance):');
    hodUsers.forEach((hod) => {
      console.log(`\n   ${hod.name} - ${hod.department}:`);
      console.log(`   Email:    ${hod.email}`);
      console.log(`   Password: ${hod.password}`);
      console.log(`   Access:   Department Logs, Auditor Performance`);
    });
    
    console.log('\n👥 AUDITOR ACCOUNTS (Can submit audit forms):');
    doctorUsers.forEach(u => {
      console.log(`\n   ${u.name} - ${u.dept}:`);
      console.log(`   Email:    ${u.email}`);
      console.log(`   Password: ${u.password}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  SECURITY NOTE:');
    console.log('   Please change all default passwords after first login!');
    console.log('\n📝 PASSWORD PATTERN:');
    console.log('   Admin:    TataTiago@2026');
    console.log('   Auditors: {FirstName}@123 (e.g., Rajan@123, Meera@123)');
    console.log('   Chiefs:   Chief{DEPT_CODE}@123 (e.g., ChiefOG@123)');
    console.log('   HODs:     HOD{DEPT_CODE}@123 (e.g., HODOG@123, HODGM@123)');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Database is ready to use!');
    console.log('🚀 Start your backend: npm start');
    console.log('🌐 Start your frontend: npm run dev');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

RUN();


