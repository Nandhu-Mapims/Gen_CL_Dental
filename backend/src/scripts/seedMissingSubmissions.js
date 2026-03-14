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

const RUN = async () => {
  try {
    console.log('🚀 Starting to seed missing submissions for existing admissions...\n');
    await connectDB();

    // Get all departments
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

    // Get users and map them to departments
    const users = await User.find({ role: 'user', isActive: true });
    const deptUsersMap = new Map();
    const deptCodeMap = new Map();
    
    departments.forEach(dept => {
      deptCodeMap.set(dept.code, dept._id.toString());
    });
    
    // Map users to departments based on email
    for (const user of users) {
      const emailMatch = user.email.match(/^([a-z]+)@hospital\.com$/);
      if (emailMatch) {
        const deptCode = emailMatch[1].toUpperCase();
        const deptId = deptCodeMap.get(deptCode);
        
        if (deptId) {
          if (!deptUsersMap.has(deptId)) {
            deptUsersMap.set(deptId, []);
          }
          deptUsersMap.get(deptId).push(user);
        }
      } else if (user.department) {
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

    // Get form templates and checklist items
    const formTemplates = await FormTemplate.find({ isActive: true }).populate('departments');
    const checklistItems = await ChecklistItem.find({ isActive: true });

    console.log(`✅ Found ${formTemplates.length} form templates and ${checklistItems.length} checklist items\n`);

    if (formTemplates.length === 0 || checklistItems.length === 0) {
      console.log('⚠️  Warning: No form templates or checklist items found.');
      console.log('   Please run seedDummyFormsChecklists.js first to create forms and checklists.');
      process.exit(1);
    }

    // Get all admissions
    const allAdmissions = await Admission.find({}).populate('patient').populate('department');
    console.log(`📋 Found ${allAdmissions.length} total admissions\n`);

    if (allAdmissions.length === 0) {
      console.log('❌ No admissions found. Please create admissions first.');
      process.exit(1);
    }

    let totalSubmissionsCreated = 0;
    let admissionsProcessed = 0;
    let admissionsWithSubmissions = 0;
    let admissionsWithoutSubmissions = 0;

    // Process each admission
    for (const admission of allAdmissions) {
      admissionsProcessed++;
      
      if (!admission.department) {
        console.log(`⚠️  Skipping admission ${admission.ipid} - no department assigned`);
        continue;
      }

      const deptId = admission.department._id ? admission.department._id.toString() : admission.department.toString();
      const dept = departments.find(d => d._id.toString() === deptId);
      
      if (!dept) {
        console.log(`⚠️  Skipping admission ${admission.ipid} - department not found`);
        continue;
      }

      // Check if submissions already exist for this IPID and department
      const existingSubmissions = await AuditSubmission.find({
        ipid: admission.ipid,
        department: deptId
      });

      if (existingSubmissions.length > 0) {
        admissionsWithSubmissions++;
        continue; // Skip if submissions already exist
      }

      admissionsWithoutSubmissions++;
      console.log(`📋 Processing admission ${admission.ipid} (${dept.name}) - No submissions found`);

      // Find form template for this department
      const deptForm = formTemplates.find(ft => 
        ft.departments && ft.departments.some(d => {
          const dId = typeof d === 'object' ? (d._id || d).toString() : d.toString();
          return dId === deptId;
        })
      );

      if (!deptForm) {
        console.log(`   ⚠️  No form template found for department ${dept.name}`);
        continue;
      }

      // Get checklist items for this form
      const formChecklistItems = checklistItems.filter(item => 
        item.formTemplate && item.formTemplate.toString() === deptForm._id.toString()
      );

      if (formChecklistItems.length === 0) {
        console.log(`   ⚠️  No checklist items found for form ${deptForm.name}`);
        continue;
      }

      const hasUsers = deptUsersMap.has(deptId);
      if (!hasUsers) {
        console.log(`   ⚠️  No users found for department ${dept.name}`);
        continue;
      }

      const deptUsers = deptUsersMap.get(deptId);
      const submittingUser = deptUsers[Math.floor(Math.random() * deptUsers.length)];

      // Create submissions for 70-100% of checklist items
      const numSubmissions = Math.floor(formChecklistItems.length * (0.7 + Math.random() * 0.3));
      const selectedItems = formChecklistItems
        .sort(() => Math.random() - 0.5)
        .slice(0, numSubmissions);

      const submissionsCreated = [];

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
        const today = new Date();
        const admissionDate = new Date(admission.admissionDate);
        const submissionDate = new Date(admissionDate.getTime() + Math.random() * (today.getTime() - admissionDate.getTime()));

        const submission = await AuditSubmission.create({
          department: dept._id,
          formTemplate: deptForm._id,
          patient: admission.patient._id || admission.patient,
          uhid: admission.uhid,
          ipid: admission.ipid,
          admission: admission._id,
          patientName: admission.patient.patientName || 'N/A',
          checklistItemId: item._id,
          yesNoNa,
          responseValue,
          remarks,
          responsibility,
          submittedBy: submittingUser._id,
          submittedAt: submissionDate,
          isLocked: true,
        });
        
        submissionsCreated.push(submission);
      }

      totalSubmissionsCreated += submissionsCreated.length;
      console.log(`   ✅ Created ${submissionsCreated.length} audit submissions\n`);
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 MISSING SUBMISSIONS SEEDING SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Total admissions processed: ${admissionsProcessed}`);
    console.log(`✅ Admissions with existing submissions: ${admissionsWithSubmissions}`);
    console.log(`✅ Admissions without submissions (processed): ${admissionsWithoutSubmissions}`);
    console.log(`✅ New submissions created: ${totalSubmissionsCreated}`);
    console.log('\n🎉 Missing submissions seeding completed successfully!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

RUN();
