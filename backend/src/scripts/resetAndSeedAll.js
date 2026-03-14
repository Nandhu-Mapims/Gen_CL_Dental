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

// Department data (auditors are MRD staff - Medical Records Department)
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

// Chief Doctors with their respective departments
const CHIEF_DOCTORS = [
  { name: 'Dr. Rajesh Kumar', designation: 'Chief of Medicine', deptCode: 'GM' },
  { name: 'Dr. Priya Sharma', designation: 'Chief of Surgery', deptCode: 'GS' },
  { name: 'Dr. Amit Patel', designation: 'Head of Orthopedics', deptCode: 'ORTHO' },
  { name: 'Dr. Sunita Singh', designation: 'Chief Cardiologist', deptCode: 'CS' },
  { name: 'Dr. Vikram Reddy', designation: 'Head of Pediatrics', deptCode: 'PED' },
];

// Auditors = MRD staff only (Medical Records Department); small set for seed
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
    console.log('🚀 Starting complete database reset and seed...\n');
    await connectDB();

    // ============= STEP 1: DELETE ALL DATA =============
    console.log('🧹 STEP 1: Deleting all existing data...');
    await AuditSubmission.deleteMany({});
    console.log('   ✅ Deleted all audit submissions');
    await ChecklistItem.deleteMany({});
    console.log('   ✅ Deleted all checklist items');
    await FormTemplate.deleteMany({});
    console.log('   ✅ Deleted all form templates');
    await Admission.deleteMany({});
    console.log('   ✅ Deleted all admissions');
    await Patient.deleteMany({});
    console.log('   ✅ Deleted all patients');
    await ChiefDoctor.deleteMany({});
    console.log('   ✅ Deleted all chief doctors');
    await User.deleteMany({});
    console.log('   ✅ Deleted all users');
    await Department.deleteMany({});
    console.log('   ✅ Deleted all departments\n');

    // ============= STEP 2: SEED DEPARTMENTS =============
    console.log('📋 STEP 2: Creating departments...');
    const createdDepts = await Department.insertMany(DEPARTMENTS);
    console.log(`   ✅ Created ${createdDepts.length} departments\n`);

    // Create department maps
    const deptCodeMap = new Map();
    const deptIdMap = new Map();
    createdDepts.forEach(dept => {
      deptCodeMap.set(dept.code, dept);
      deptIdMap.set(dept._id.toString(), dept);
    });

    // ============= STEP 3: SEED USERS =============
    console.log('👥 STEP 3: Creating users...');
    
    // Admin user
    const adminPassword = 'TataTiago@2026';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin@hospital.com',
      passwordHash: adminHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`   ✅ Created admin: admin@hospital.com`);

    // Auditors = MRD staff only; all in Medical Records Department (MRD)
    const mrdDept = deptCodeMap.get('MRD');
    const departmentUsers = [];
    const userMap = new Map(); // departmentId -> [users]; MRD holds all auditors

    if (mrdDept) {
      const mrdAuditorUsers = [];
      for (let i = 0; i < MRD_STAFF_NAMES.length; i++) {
        const name = MRD_STAFF_NAMES[i];
        const firstName = name.split(' ')[0].toLowerCase();
        const email = `${firstName}.mrd@hospital.com`;
        const password = `${firstName.charAt(0).toUpperCase()}${firstName.substring(1)}@123`;
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
          name,
          email,
          passwordHash,
          role: 'auditor',
          designation: MRD_DESIGNATION,
          department: mrdDept._id,
          isActive: true,
        });

        departmentUsers.push({ name, dept: mrdDept.name, email, password });
        mrdAuditorUsers.push(user);
        console.log(`   ✅ Created MRD auditor: ${name} (${email}) - ${mrdDept.name}`);
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
        department: chiefDept._id, // Link to department
        isActive: true,
        order: i,
      });
      createdChiefs.push(chiefDoc);
      
      // Create user account for chief with 'user' role
      const chiefEmail = `chief${i + 1}@hospital.com`;
      const chiefPassword = `Chief@${i + 1}23`;
      const chiefPasswordHash = await bcrypt.hash(chiefPassword, 10);
      
      const chiefUser = await User.create({
        name: chief.name,
        email: chiefEmail,
        passwordHash: chiefPasswordHash,
        role: 'chief',
        designation: 'Doctor',
        department: chiefDept._id,
        isActive: true,
      });
      
      chiefUsers.push({
        name: chief.name,
        designation: chief.designation,
        department: chiefDept.name,
        email: chiefEmail,
        password: chiefPassword,
      });
      
      console.log(`   ✅ Created chief: ${chief.name} (${chief.designation}) - ${chiefDept.name}`);
      console.log(`      Login: ${chiefEmail} / ${chiefPassword}`);
    }
    console.log('');

    // ============= STEP 5: CREATE FORM TEMPLATES =============
    console.log('📝 STEP 5: Creating form templates...');
    
    const formTemplates = [];
    const clinicalDepts = createdDepts.filter(d => d.code !== 'ANAE' && d.code !== 'NUS');
    
    for (const dept of clinicalDepts) {
      const form = await FormTemplate.create({
        name: `${dept.name} Audit Form`,
        description: `Quality audit checklist for ${dept.name} department`,
        departments: [dept._id],
        isMultiDepartment: false,
        isActive: true,
        version: 1,
      });
      formTemplates.push(form);
      console.log(`   ✅ Created form: ${form.name}`);
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

    // ============= STEP 7: CREATE PATIENTS & ADMISSIONS =============
    console.log('👨‍⚕️ STEP 7: Creating patients and admissions...');
    
    const patients = [];
    const admissions = [];
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const today = new Date();
    
    const numPatients = 50; // 50 patients (UHID000001–UHID000050); each gets 2–5 admissions (IPIDs) per UHID
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
        const admissionDate = randomDate(twoMonthsAgo, today);
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
    const mrdDeptIdForSubmissions = mrdDept ? mrdDept._id.toString() : null;
    const mrdAuditors = mrdDeptIdForSubmissions ? userMap.get(mrdDeptIdForSubmissions) : [];

    for (const admission of admissions) {
      const deptId = admission.department.toString();
      const dept = deptIdMap.get(deptId);
      
      if (!mrdAuditors || mrdAuditors.length === 0) continue;
      
      // Find form for this department
      const form = formTemplates.find(f => 
        f.departments.some(d => d.toString() === deptId)
      );
      
      if (!form) continue;
      
      const items = checklistItemsByForm.get(form._id.toString());
      if (!items) continue;
      
      // MRD staff (auditors) submit for all departments
      const submittingUser = mrdAuditors[Math.floor(Math.random() * mrdAuditors.length)];
      
      // Select random chief
      const assignedChief = createdChiefs[Math.floor(Math.random() * createdChiefs.length)];
      
      // Submit 60-100% of checklist items
      const numToSubmit = Math.floor(items.length * (0.6 + Math.random() * 0.4));
      const selectedItems = items.slice(0, numToSubmit);
      
      const auditDate = new Date(admission.admissionDate);
      auditDate.setUTCHours(0, 0, 0, 0);
      const hour = 8 + Math.floor(Math.random() * 10);
      const minute = Math.floor(Math.random() * 60);
      const auditTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      for (const item of selectedItems) {
        // 85% compliance rate (85% YES, 15% NO). YES - no remarks; NO - remarks required
        const responseValue = Math.random() < 0.85 ? 'YES' : 'NO';
        const submissionDate = new Date(
          admission.admissionDate.getTime() +
          Math.random() * (today.getTime() - admission.admissionDate.getTime())
        );
        const remarks =
          responseValue === 'NO'
            ? ['Documentation pending', 'To be completed', 'Follow-up required', 'Noted for correction'][Math.floor(Math.random() * 4)]
            : '';

        const submission = await AuditSubmission.create({
          department: dept._id,
          formTemplate: form._id,
          patient: admission.patient,
          uhid: admission.uhid,
          ipid: admission.ipid,
          admission: admission._id,
          patientName: patients.find(p => p._id.toString() === admission.patient.toString()).patientName,
          checklistItemId: item._id,
          responseValue,
          yesNoNa: responseValue,
          remarks,
          responsibility: ['Nurse', 'Doctor', 'Staff'][Math.floor(Math.random() * 3)],
          submittedBy: submittingUser._id,
          submittedAt: submissionDate,
          auditDate,
          auditTime,
          unitChief: assignedChief.name,
          isLocked: true,
        });
        submissions.push(submission);
      }
    }
    console.log(`   ✅ Created ${submissions.length} audit submissions\n`);

    // ============= SUMMARY =============
    console.log('='.repeat(70));
    console.log('🎉 DATABASE RESET AND SEED COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('\n📊 DATA SUMMARY:');
    console.log(`   ✅ Departments: ${createdDepts.length}`);
    console.log(`   ✅ Users: ${departmentUsers.length + chiefUsers.length + 1} (1 admin + ${chiefUsers.length} chiefs + ${departmentUsers.length} MRD auditors)`);
    console.log(`   ✅ Chief Doctors: ${createdChiefs.length} (with login accounts)`);
    console.log(`   ✅ Form Templates: ${formTemplates.length}`);
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
    console.log(`   Email:    admin@hospital.com`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     Admin (Full Access)`);
    
    console.log('\n👨‍⚕️ CHIEF DOCTOR ACCOUNTS (for validation & performance tracking):');
    chiefUsers.forEach((chief, i) => {
      console.log(`\n   ${i + 1}. ${chief.name} (${chief.designation}) - ${chief.department}:`);
      console.log(`   Email:    ${chief.email}`);
      console.log(`   Password: ${chief.password}`);
      console.log(`   Access:   Chief Dashboard, Doctor Performance`);
    });
    
    console.log('\n👥 AUDITORS (MRD Staff):');
    departmentUsers.forEach(u => {
      console.log(`\n   ${u.name} (MRD Staff) - ${u.dept}:`);
      console.log(`   Email:    ${u.email}`);
      console.log(`   Password: ${u.password}`);
    });
    
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
