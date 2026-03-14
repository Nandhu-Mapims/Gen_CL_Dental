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
  'Manish', 'Ritu', 'Gaurav', 'Sneha', 'Vishal', 'Anita'
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Gupta', 'Verma', 'Jain',
  'Mehta', 'Shah', 'Desai', 'Rao', 'Nair', 'Iyer', 'Menon', 'Pillai',
  'Narayan', 'Krishnan', 'Sundaram', 'Venkatesh'
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
    'Cholecystitis', 'Hernia', 'Tonsillitis'
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

const RUN = async () => {
  try {
    console.log('🚀 Starting comprehensive dummy data seeding...\n');
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

    // Get users and refresh their department assignments based on email
    const users = await User.find({ role: 'user', isActive: true });
    const deptUsersMap = new Map(); // Map by department ObjectId
    const deptCodeMap = new Map(); // Map department code to ObjectId for easy lookup
    
    // Create code to ObjectId mapping
    departments.forEach(dept => {
      deptCodeMap.set(dept.code, dept._id.toString());
    });
    
    // Refresh user department assignments based on email pattern
    for (const user of users) {
      // Extract department code from email (e.g., og@hospital.com -> OG)
      const emailMatch = user.email.match(/^([a-z]+)@hospital\.com$/);
      if (emailMatch) {
        const deptCode = emailMatch[1].toUpperCase();
        const deptId = deptCodeMap.get(deptCode);
        
        if (deptId) {
          // Update user's department if it doesn't match
          const currentDeptId = user.department ? user.department.toString() : null;
          if (currentDeptId !== deptId) {
            user.department = deptId;
            await user.save();
            console.log(`   🔄 Updated ${user.email} department assignment to ${deptCode}`);
          }
          
          // Add to map
          if (!deptUsersMap.has(deptId)) {
            deptUsersMap.set(deptId, []);
          }
          deptUsersMap.get(deptId).push(user);
        }
      } else if (user.department) {
        // Fallback: use existing department if email doesn't match pattern
        const deptId = user.department.toString();
        const dept = departments.find(d => d._id.toString() === deptId);
        if (dept) {
          if (!deptUsersMap.has(deptId)) {
            deptUsersMap.set(deptId, []);
          }
          deptUsersMap.get(deptId).push(user);
        }
      }
    }
    
    console.log(`✅ Found ${users.length} users mapped to ${deptUsersMap.size} departments`);
    if (deptUsersMap.size === 0) {
      console.log('⚠️  Warning: No users found with department assignments. Submissions will not be created.');
      console.log('   Tip: Run "npm run seed" to ensure users are properly assigned to departments.');
    }

    // Get form templates and checklist items
    const formTemplates = await FormTemplate.find({ isActive: true }).populate('departments');
    const checklistItems = await ChecklistItem.find({ isActive: true });

    console.log(`✅ Found ${formTemplates.length} form templates and ${checklistItems.length} checklist items\n`);

    if (formTemplates.length === 0 || checklistItems.length === 0) {
      console.log('⚠️  Warning: No form templates or checklist items found.');
      console.log('   Please run seedDummyFormsChecklists.js first to create forms and checklists.');
      console.log('   Continuing with patient and admission data only...\n');
    }

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing patient, admission, and submission data...');
    await AuditSubmission.deleteMany({});
    await Admission.deleteMany({});
    await Patient.deleteMany({});
    console.log('✅ Cleared existing data\n');

    // Create patients and admissions
    const NUM_PATIENTS = 50;
    const patients = [];
    const admissions = [];
    const submissions = [];

    console.log(`📝 Creating ${NUM_PATIENTS} patients with admissions...\n`);

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const today = new Date();

    for (let i = 1; i <= NUM_PATIENTS; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const patientName = `${firstName} ${lastName}`;
      const uhid = generateUHID(i);
      const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
      
      // Generate DOB (age between 18 and 80)
      const age = Math.floor(Math.random() * 62) + 18;
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      dob.setMonth(Math.floor(Math.random() * 12));
      dob.setDate(Math.floor(Math.random() * 28) + 1);

      // Create patient
      const patient = await Patient.create({
        uhid,
        patientName,
        dateOfBirth: dob,
        gender,
        contactNumber: randomPhone(),
        address: randomAddress(),
      });
      patients.push(patient);
      console.log(`✅ Created patient ${i}/${NUM_PATIENTS}: ${patientName} (${uhid})`);

      // Create 1-3 admissions per patient
      const numAdmissions = Math.floor(Math.random() * 3) + 1;
      for (let j = 1; j <= numAdmissions; j++) {
        const admissionDate = randomDate(twoYearsAgo, today);
        const isDischarged = Math.random() > 0.3; // 70% discharged
        const dischargeDate = isDischarged 
          ? new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()))
          : null;
        
        const status = isDischarged ? 'Discharged' : 'Admitted';
        const dept = clinicalDepts[Math.floor(Math.random() * clinicalDepts.length)];
        const ipid = generateIPID((i - 1) * 10 + j); // Ensure unique IPIDs

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
        console.log(`   📋 Created admission: ${ipid} (${status})`);

        // Create audit submissions for this admission
        // Find form template for this department
        const deptForm = formTemplates.find(ft => 
          ft.departments && ft.departments.some(d => {
            const deptId = typeof d === 'object' ? (d._id || d).toString() : d.toString();
            return deptId === dept._id.toString();
          })
        );

        if (deptForm) {
          // Get checklist items for this form
          const formChecklistItems = checklistItems.filter(item => 
            item.formTemplate && item.formTemplate.toString() === deptForm._id.toString()
          );

          const hasUsers = deptUsersMap.has(dept._id.toString());
          
          if (!hasUsers) {
            console.log(`   ⚠️  No users found for department ${dept.name} (${dept.code})`);
          } else if (formChecklistItems.length === 0) {
            console.log(`   ⚠️  No checklist items found for form ${deptForm.name}`);
          } else if (formChecklistItems.length > 0 && hasUsers) {
            const deptUsers = deptUsersMap.get(dept._id.toString());
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
                ipid: admission.ipid,
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
            console.log(`   ✅ Created ${selectedItems.length} audit submissions`);
          }
        }
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 DUMMY DATA SEEDING SUMMARY');
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

    // Count by status
    const statusCounts = {};
    admissions.forEach(adm => {
      statusCounts[adm.status] = (statusCounts[adm.status] || 0) + 1;
    });
    
    console.log('\n   Admissions by Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });

    // Count submissions by response type
    const responseTypeCounts = {};
    submissions.forEach(sub => {
      const item = checklistItems.find(ci => ci._id.toString() === sub.checklistItemId.toString());
      if (item) {
        const type = item.responseType || 'YES_NO';
        responseTypeCounts[type] = (responseTypeCounts[type] || 0) + 1;
      }
    });
    
    console.log('\n   Submissions by Response Type:');
    Object.entries(responseTypeCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

    console.log('\n🎉 Dummy data seeding completed successfully!\n');
    console.log('💡 You can now:');
    console.log('   - View patients in Patient Report');
    console.log('   - Check Department Logs for submissions');
    console.log('   - Test the system with realistic data');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

RUN();
