const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');
const User = require('../models/User');

dotenv.config();

// Realistic Indian names
const FIRST_NAMES = [
  'Rajesh', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Anjali', 'Rahul', 'Kavita',
  'Suresh', 'Meera', 'Arjun', 'Deepika', 'Mohan', 'Shilpa', 'Kiran', 'Neha',
  'Ravi', 'Pooja', 'Anil', 'Radha', 'Sandeep', 'Swati', 'Nikhil', 'Divya',
  'Manish', 'Ritu', 'Gaurav', 'Sneha', 'Vishal', 'Anita', 'Ramesh', 'Lakshmi',
  'Kumar', 'Sarita', 'Prakash', 'Geeta', 'Vinod', 'Madhuri', 'Sanjay', 'Asha'
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Jain',
  'Mehta', 'Shah', 'Desai', 'Rao', 'Nair', 'Iyer', 'Menon', 'Pillai',
  'Narayan', 'Krishnan', 'Sundaram', 'Venkatesh', 'Prasad', 'Chopra', 'Malhotra'
];

const WARDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'ICU', 'CCU', 'Maternity', 'Pediatric'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'];
const ADMISSION_TYPES = ['Emergency', 'Elective', 'Day Care'];
const STATUSES = ['Admitted', 'Discharged'];
const GENDERS = ['Male', 'Female', 'Other'];

// Generate random date within last 2 years
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate random phone number
const randomPhone = () => {
  return `9${Math.floor(Math.random() * 9000000000) + 1000000000}`;
};

// Generate random address
const randomAddress = () => {
  const streets = ['MG Road', 'Park Street', 'Main Road', 'Church Street', 'Market Street'];
  const areas = ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'BTM Layout'];
  const cities = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad'];
  return `${Math.floor(Math.random() * 999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}, ${areas[Math.floor(Math.random() * areas.length)]}, ${cities[Math.floor(Math.random() * cities.length)]} - ${Math.floor(Math.random() * 90000) + 10000}`;
};

// Generate UHID (format: UHID followed by 6 digits)
const generateUHID = (index) => {
  return `UHID${String(index).padStart(6, '0')}`;
};

// Generate IPID (format: IPID followed by 6 digits)
const generateIPID = (index) => {
  return `IPID${String(index).padStart(6, '0')}`;
};

// Generate random diagnosis
const randomDiagnosis = () => {
  const diagnoses = [
    'Hypertension', 'Diabetes Mellitus Type 2', 'Acute Appendicitis', 'Pneumonia',
    'Fracture Right Femur', 'Acute Myocardial Infarction', 'Chronic Kidney Disease',
    'Asthma', 'Gastritis', 'Urinary Tract Infection', 'Osteoarthritis', 'Anemia',
    'Bronchitis', 'Migraine', 'Gastroenteritis', 'Hypothyroidism', 'Hyperthyroidism',
    'Cholecystitis', 'Hernia', 'Tonsillitis', 'Cataract', 'Glaucoma', 'Sinusitis',
    'Otitis Media', 'Cardiac Arrhythmia', 'Coronary Artery Disease'
  ];
  return diagnoses[Math.floor(Math.random() * diagnoses.length)];
};

// Generate random doctor name
const randomDoctor = () => {
  const titles = ['Dr.', 'Prof. Dr.'];
  const names = [
    'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sunita Singh', 'Vikram Reddy',
    'Anjali Gupta', 'Rahul Verma', 'Kavita Jain', 'Suresh Mehta', 'Meera Shah'
  ];
  return `${titles[Math.floor(Math.random() * titles.length)]} ${names[Math.floor(Math.random() * names.length)]}`;
};

// Common multi-department combinations (realistic scenarios)
const MULTI_DEPT_COMBINATIONS = [
  ['ENT', 'OPHTHAL'],           // ENT + Ophthalmology
  ['CS', 'GM'],                 // Cardiac Surgery + General Medicine
  ['ORTHO', 'GS'],              // Orthopedics + General Surgery
  ['OG', 'PED'],                // Obstetrics & Gynecology + Pediatrics
  ['ENT', 'CS'],                // ENT + Cardiac Surgery
  ['OPHTHAL', 'GM'],            // Ophthalmology + General Medicine
  ['GS', 'ORTHO', 'GM'],        // General Surgery + Orthopedics + General Medicine
];

const RUN = async () => {
  try {
    console.log('🚀 Starting comprehensive data seeding with multi-department scenarios...\n');
    await connectDB();

    // Get departments
    const departments = await Department.find({ isActive: true });
    if (departments.length === 0) {
      console.log('❌ No departments found. Please run seed script first.');
      process.exit(1);
    }

    // Get clinical departments (excluding ANAE and NUS)
    const clinicalDepts = departments.filter(d => d.code !== 'ANAE' && d.code !== 'NUS');
    if (clinicalDepts.length === 0) {
      console.log('❌ No clinical departments found.');
      process.exit(1);
    }

    // Create department code to object map
    const deptCodeMap = new Map();
    clinicalDepts.forEach(dept => {
      deptCodeMap.set(dept.code, dept);
    });

    // Get users and map them to departments
    const users = await User.find({ role: 'user', isActive: true });
    const deptUsersMap = new Map();
    const deptCodeToIdMap = new Map();
    
    departments.forEach(dept => {
      deptCodeToIdMap.set(dept.code, dept._id.toString());
    });
    
    // Map users to departments
    for (const user of users) {
      const emailMatch = user.email.match(/^([a-z]+)@hospital\.com$/);
      if (emailMatch) {
        const deptCode = emailMatch[1].toUpperCase();
        const deptId = deptCodeToIdMap.get(deptCode);
        
        if (deptId) {
          if (user.department && user.department.toString() !== deptId) {
            user.department = deptId;
            await user.save();
          }
          
          if (!deptUsersMap.has(deptId)) {
            deptUsersMap.set(deptId, []);
          }
          deptUsersMap.get(deptId).push(user);
        }
      } else if (user.department) {
        const deptId = user.department.toString();
        if (!deptUsersMap.has(deptId)) {
          deptUsersMap.set(deptId, []);
        }
        deptUsersMap.get(deptId).push(user);
      }
    }
    
    console.log(`✅ Found ${users.length} users mapped to ${deptUsersMap.size} departments`);

    // Get form templates and checklist items
    const formTemplates = await FormTemplate.find({ isActive: true }).populate('departments');
    const checklistItems = await ChecklistItem.find({ isActive: true });

    console.log(`✅ Found ${formTemplates.length} form templates and ${checklistItems.length} checklist items\n`);

    if (formTemplates.length === 0 || checklistItems.length === 0) {
      console.log('⚠️  Warning: No form templates or checklist items found.');
      console.log('   Please run seedDummyFormsChecklists.js first to create forms and checklists.');
      console.log('   Continuing with patient and admission data only...\n');
    }

    // Clear existing patient data
    console.log('🧹 Clearing existing patient, admission, and submission data...');
    await AuditSubmission.deleteMany({});
    await Admission.deleteMany({});
    await Patient.deleteMany({});
    console.log('✅ Cleared existing data\n');

    // Create comprehensive patient scenarios
    const patients = [];
    const admissions = [];
    const submissions = [];

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const today = new Date();

    let patientIndex = 1;
    let ipidIndex = 1;

    // SCENARIO 1: Single IPID with Multiple Departments (30% of patients)
    console.log('📋 SCENARIO 1: Creating patients with single IPID and multiple departments...\n');
    const multiDeptCount = 20; // 20 patients with multi-department IPIDs
    
    for (let i = 0; i < multiDeptCount; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const patientName = `${firstName} ${lastName}`;
      const uhid = generateUHID(patientIndex++);
      const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
      
      const age = Math.floor(Math.random() * 62) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      dob.setMonth(Math.floor(Math.random() * 12));
      dob.setDate(Math.floor(Math.random() * 28) + 1);

      const patient = await Patient.create({
        uhid,
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);
      console.log(`✅ Created patient: ${patientName} (${uhid})`);

      // Create ONE admission (single IPID)
      const admissionDate = randomDate(twoYearsAgo, today);
      const isDischarged = Math.random() > 0.3;
      const dischargeDate = isDischarged 
        ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
        : null;
      
      const status = isDischarged ? 'Discharged' : 'Admitted';
      const ipid = generateIPID(ipidIndex++);
      const primaryDept = clinicalDepts[Math.floor(Math.random() * clinicalDepts.length)];

      const admission = await Admission.create({
        ipid,
        patient: patient._id,
        uhid: patient.uhid,
        admissionDate,
        dischargeDate,
        ward: WARDS[Math.floor(Math.random() * WARDS.length)],
        unitNo: UNITS[Math.floor(Math.random() * UNITS.length)],
        admissionType: ADMISSION_TYPES[Math.floor(Math.random() * ADMISSION_TYPES.length)],
        status,
        department: primaryDept._id,
        diagnosis: randomDiagnosis(),
        admittingDoctor: randomDoctor(),
      });
      admissions.push(admission);
      console.log(`   📋 Created admission: ${ipid} (${status}) - Primary Dept: ${primaryDept.name}`);

      // Select 2-3 departments for this IPID
      const combination = MULTI_DEPT_COMBINATIONS[Math.floor(Math.random() * MULTI_DEPT_COMBINATIONS.length)];
      const selectedDepts = [];
      
      // Ensure we have valid departments
      for (const deptCode of combination) {
        const dept = deptCodeMap.get(deptCode);
        if (dept && dept._id.toString() !== primaryDept._id.toString()) {
          selectedDepts.push(dept);
          if (selectedDepts.length >= 2) break; // Max 2 additional departments
        }
      }
      
      // If no valid combination, randomly select 1-2 other departments
      if (selectedDepts.length === 0) {
        const otherDepts = clinicalDepts.filter(d => d._id.toString() !== primaryDept._id.toString());
        const numAdditional = Math.min(2, Math.floor(Math.random() * 2) + 1);
        for (let j = 0; j < numAdditional && j < otherDepts.length; j++) {
          const randomDept = otherDepts[Math.floor(Math.random() * otherDepts.length)];
          if (!selectedDepts.find(d => d._id.toString() === randomDept._id.toString())) {
            selectedDepts.push(randomDept);
          }
        }
      }

      // Create submissions for primary department
      await createSubmissionsForDepartment(
        primaryDept,
        patient,
        admission,
        ipid,
        admissionDate,
        today,
        formTemplates,
        checklistItems,
        deptUsersMap,
        submissions
      );

      // Create submissions for additional departments (same IPID)
      for (const dept of selectedDepts) {
        await createSubmissionsForDepartment(
          dept,
          patient,
          admission,
          ipid,
          admissionDate,
          today,
          formTemplates,
          checklistItems,
          deptUsersMap,
          submissions
        );
      }

      console.log(`   ✅ Multi-department IPID: ${ipid} has submissions from ${1 + selectedDepts.length} departments\n`);
    }

    // SCENARIO 2: Single IPID with Single Department (40% of patients)
    console.log('📋 SCENARIO 2: Creating patients with single IPID and single department...\n');
    const singleDeptCount = 30;
    
    for (let i = 0; i < singleDeptCount; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const patientName = `${firstName} ${lastName}`;
      const uhid = generateUHID(patientIndex++);
      const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
      
      const age = Math.floor(Math.random() * 62) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      dob.setMonth(Math.floor(Math.random() * 12));
      dob.setDate(Math.floor(Math.random() * 28) + 1);

      const patient = await Patient.create({
        uhid,
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);

      const admissionDate = randomDate(twoYearsAgo, today);
      const isDischarged = Math.random() > 0.3;
      const dischargeDate = isDischarged 
        ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
        : null;
      
      const status = isDischarged ? 'Discharged' : 'Admitted';
      const dept = clinicalDepts[Math.floor(Math.random() * clinicalDepts.length)];
      const ipid = generateIPID(ipidIndex++);

      const admission = await Admission.create({
        ipid,
        patient: patient._id,
        uhid: patient.uhid,
        admissionDate,
        dischargeDate,
        ward: WARDS[Math.floor(Math.random() * WARDS.length)],
        unitNo: UNITS[Math.floor(Math.random() * UNITS.length)],
        admissionType: ADMISSION_TYPES[Math.floor(Math.random() * ADMISSION_TYPES.length)],
        status,
        department: dept._id,
        diagnosis: randomDiagnosis(),
        admittingDoctor: randomDoctor(),
      });
      admissions.push(admission);

      // Create submissions for this department
      await createSubmissionsForDepartment(
        dept,
        patient,
        admission,
        ipid,
        admissionDate,
        today,
        formTemplates,
        checklistItems,
        deptUsersMap,
        submissions
      );
    }

    // SCENARIO 3: Multiple IPIDs for Same Patient (30% of patients)
    console.log('📋 SCENARIO 3: Creating patients with multiple IPIDs (readmissions)...\n');
    const multiIPIDCount = 20;
    
    for (let i = 0; i < multiIPIDCount; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const patientName = `${firstName} ${lastName}`;
      const uhid = generateUHID(patientIndex++);
      const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
      
      const age = Math.floor(Math.random() * 62) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      dob.setMonth(Math.floor(Math.random() * 12));
      dob.setDate(Math.floor(Math.random() * 28) + 1);

      const patient = await Patient.create({
        uhid,
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);
      console.log(`✅ Created patient: ${patientName} (${uhid})`);

      // Create 2-4 admissions for this patient
      const numAdmissions = Math.floor(Math.random() * 3) + 2;
      for (let j = 1; j <= numAdmissions; j++) {
        const admissionDate = randomDate(twoYearsAgo, today);
        const isDischarged = Math.random() > 0.2; // 80% discharged
        const dischargeDate = isDischarged 
          ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
          : null;
        
        const status = isDischarged ? 'Discharged' : 'Admitted';
        const dept = clinicalDepts[Math.floor(Math.random() * clinicalDepts.length)];
        const ipid = generateIPID(ipidIndex++);

        const admission = await Admission.create({
          ipid,
          patient: patient._id,
          uhid: patient.uhid,
          admissionDate,
          dischargeDate,
          ward: WARDS[Math.floor(Math.random() * WARDS.length)],
          unitNo: UNITS[Math.floor(Math.random() * UNITS.length)],
          admissionType: ADMISSION_TYPES[Math.floor(Math.random() * ADMISSION_TYPES.length)],
          status,
          department: dept._id,
          diagnosis: randomDiagnosis(),
          admittingDoctor: randomDoctor(),
        });
        admissions.push(admission);
        console.log(`   📋 Created admission ${j}/${numAdmissions}: ${ipid} (${status}) - ${dept.name}`);

        // Create submissions for this admission
        await createSubmissionsForDepartment(
          dept,
          patient,
          admission,
          ipid,
          admissionDate,
          today,
          formTemplates,
          checklistItems,
          deptUsersMap,
          submissions
        );
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 COMPREHENSIVE DATA SEEDING SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Patients created: ${patients.length}`);
    console.log(`✅ Admissions created: ${admissions.length}`);
    console.log(`✅ Audit submissions created: ${submissions.length}`);
    console.log('\n📋 Data Distribution:');
    
    // Count by department
    const deptCounts = {};
    admissions.forEach(adm => {
      const deptId = adm.department.toString();
      if (!deptCounts[deptId]) {
        const dept = departments.find(d => d._id.toString() === deptId);
        deptCounts[deptId] = { name: dept ? dept.name : 'Unknown', count: 0 };
      }
      deptCounts[deptId].count++;
    });
    
    console.log('\n   Admissions by Department:');
    Object.values(deptCounts).forEach(dept => {
      console.log(`   - ${dept.name}: ${dept.count}`);
    });

    // Count multi-department IPIDs
    const ipidDeptMap = new Map();
    submissions.forEach(sub => {
      const ipid = sub.ipid;
      if (!ipidDeptMap.has(ipid)) {
        ipidDeptMap.set(ipid, new Set());
      }
      const deptId = sub.department.toString();
      ipidDeptMap.get(ipid).add(deptId);
    });

    const multiDeptIPIDs = Array.from(ipidDeptMap.values()).filter(deptSet => deptSet.size > 1).length;
    console.log(`\n   IPIDs with Multiple Departments: ${multiDeptIPIDs}`);

    // Count by status
    const statusCounts = {};
    admissions.forEach(adm => {
      statusCounts[adm.status] = (statusCounts[adm.status] || 0) + 1;
    });
    
    console.log('\n   Admissions by Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });

    console.log('\n🎉 Comprehensive data seeding completed successfully!\n');
    console.log('💡 Key Features:');
    console.log('   ✅ Single IPID with multiple departments (ENT + Ophthalmology, etc.)');
    console.log('   ✅ Single IPID with single department');
    console.log('   ✅ Multiple IPIDs for same patient (readmissions)');
    console.log('   ✅ All patient types covered');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

// Helper function to create submissions for a department
async function createSubmissionsForDepartment(
  dept,
  patient,
  admission,
  ipid,
  admissionDate,
  today,
  formTemplates,
  checklistItems,
  deptUsersMap,
  submissions
) {
  // Find form template for this department
  const deptForm = formTemplates.find(ft => 
    ft.departments && ft.departments.some(d => {
      const deptId = typeof d === 'object' ? (d._id || d).toString() : d.toString();
      return deptId === dept._id.toString();
    })
  );

  if (!deptForm) {
    return; // No form template for this department
  }

  // Get checklist items for this form
  const formChecklistItems = checklistItems.filter(item => 
    item.formTemplate && item.formTemplate.toString() === deptForm._id.toString()
  );

  if (formChecklistItems.length === 0) {
    return; // No checklist items
  }

  const deptId = dept._id.toString();
  const hasUsers = deptUsersMap.has(deptId);
  
  if (!hasUsers) {
    return; // No users for this department
  }

  const deptUsers = deptUsersMap.get(deptId);
  const submittingUser = deptUsers[Math.floor(Math.random() * deptUsers.length)];

  // Create submissions for 70-100% of checklist items
  const numSubmissions = Math.floor(formChecklistItems.length * (0.7 + Math.random() * 0.3));
  const selectedItems = formChecklistItems
    .sort(() => Math.random() - 0.5)
    .slice(0, numSubmissions);

  for (const item of selectedItems) {
    let responseValue = '';
    let yesNoNa = null;

    // Generate response based on response type
    if (item.responseType === 'TEXT') {
      const textResponses = [
        'Patient is stable and responding well to treatment.',
        'Regular monitoring required. No complications observed.',
        'Patient shows improvement. Continue current medication.',
        'Follow-up scheduled. Patient advised to return if symptoms worsen.',
        'All vital parameters within normal range.',
      ];
      responseValue = textResponses[Math.floor(Math.random() * textResponses.length)];
    } else if (item.responseType === 'MULTI_SELECT') {
      const options = item.responseOptions ? item.responseOptions.split(',') : ['Option 1', 'Option 2'];
      responseValue = options[Math.floor(Math.random() * options.length)].trim();
    } else {
      // YES_NO type - only YES or NO (no NA)
      const responses = ['YES', 'NO'];
      const response = responses[Math.floor(Math.random() * responses.length)];
      responseValue = response;
      yesNoNa = response;
    }

    // Generate remarks (50% chance)
    const remarks = Math.random() > 0.5 
      ? ['Completed as per protocol.', 'Verified and documented.', 'All requirements met.', 'Standard procedure followed.'][Math.floor(Math.random() * 4)]
      : null;

    // Generate responsibility (50% chance)
    const responsibilities = ['Nurse', 'Doctor', 'Technician', 'Staff', 'Resident'];
    const responsibility = Math.random() > 0.5 
      ? responsibilities[Math.floor(Math.random() * responsibilities.length)]
      : null;

    // Submission date should be after admission date
    const submissionDate = new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()));

    const submission = await AuditSubmission.create({
      department: dept._id,
      formTemplate: deptForm._id,
      patient: patient._id,
      uhid: patient.uhid,
      ipid: ipid,
      admission: admission._id,
      patientName: patient.patientName,
      checklistItemId: item._id,
      yesNoNa,
      responseValue,
      remarks,
      responsibility,
      submittedBy: submittingUser._id,
      submittedAt: submissionDate,
      isLocked: true,
    });
    submissions.push(submission);
  }
}

RUN();
