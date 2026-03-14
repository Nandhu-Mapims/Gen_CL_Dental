const dotenv = require('dotenv');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');
const Department = require('../models/Department');
const User = require('../models/User');

dotenv.config();

const RUN = async () => {
  try {
    await connectDB();

    console.log('🗑️  Clearing data from database (keeping Users and Departments)...\n');

    // Count records before deletion
    const counts = {
      departments: await Department.countDocuments(),
      users: await User.countDocuments(),
      formTemplates: await FormTemplate.countDocuments(),
      checklistItems: await ChecklistItem.countDocuments(),
      auditSubmissions: await AuditSubmission.countDocuments(),
      patients: await Patient.countDocuments(),
      admissions: await Admission.countDocuments(),
    };

    console.log('📊 Current data counts:');
    console.log(`   - Departments: ${counts.departments} (will be kept)`);
    console.log(`   - Users: ${counts.users} (will be kept)`);
    console.log(`   - Form Templates: ${counts.formTemplates} (will be deleted)`);
    console.log(`   - Checklist Items: ${counts.checklistItems} (will be deleted)`);
    console.log(`   - Audit Submissions: ${counts.auditSubmissions} (will be deleted)`);
    console.log(`   - Patients: ${counts.patients} (will be deleted)`);
    console.log(`   - Admissions: ${counts.admissions} (will be deleted)\n`);

    console.log('⚠️  WARNING: This will delete:');
    console.log('   - All audit submissions');
    console.log('   - All admissions');
    console.log('   - All patients');
    console.log('   - All checklist items');
    console.log('   - All form templates');
    console.log('\n✅ Will KEEP:');
    console.log('   - All users (including admins)');
    console.log('   - All departments\n');

    // Delete in order (respecting foreign key relationships)
    console.log('🗑️  Deleting data...\n');

    // 1. Delete audit submissions first (they reference patients, admissions, and checklist items)
    const deletedSubmissions = await AuditSubmission.deleteMany({});
    console.log(`✅ Deleted ${deletedSubmissions.deletedCount} audit submission(s)`);

    // 2. Delete admissions (they reference patients)
    const deletedAdmissions = await Admission.deleteMany({});
    console.log(`✅ Deleted ${deletedAdmissions.deletedCount} admission(s)`);

    // 3. Delete patients
    const deletedPatients = await Patient.deleteMany({});
    console.log(`✅ Deleted ${deletedPatients.deletedCount} patient(s)`);

    // 4. Delete checklist items (they reference form templates)
    const deletedChecklistItems = await ChecklistItem.deleteMany({});
    console.log(`✅ Deleted ${deletedChecklistItems.deletedCount} checklist item(s)`);

    // 5. Delete form templates
    const deletedFormTemplates = await FormTemplate.deleteMany({});
    console.log(`✅ Deleted ${deletedFormTemplates.deletedCount} form template(s)`);

    // Verify what's left
    const remainingCounts = {
      departments: await Department.countDocuments(),
      users: await User.countDocuments(),
      formTemplates: await FormTemplate.countDocuments(),
      checklistItems: await ChecklistItem.countDocuments(),
      auditSubmissions: await AuditSubmission.countDocuments(),
      patients: await Patient.countDocuments(),
      admissions: await Admission.countDocuments(),
    };

    console.log('\n🎉 Data cleared successfully!');
    console.log('\n📌 Remaining data:');
    console.log(`   - Departments: ${remainingCounts.departments} ✅`);
    console.log(`   - Users: ${remainingCounts.users} ✅`);
    console.log(`   - Form Templates: ${remainingCounts.formTemplates}`);
    console.log(`   - Checklist Items: ${remainingCounts.checklistItems}`);
    console.log(`   - Audit Submissions: ${remainingCounts.auditSubmissions}`);
    console.log(`   - Patients: ${remainingCounts.patients}`);
    console.log(`   - Admissions: ${remainingCounts.admissions}`);
    console.log('\n✅ Users and Departments have been preserved.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing database:', err);
    process.exit(1);
  }
};

RUN();

