const dotenv = require('dotenv');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const AuditSubmission = require('../models/AuditSubmission');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');

dotenv.config();

const RUN = async () => {
  try {
    await connectDB();

    console.log('\n🗑️  DELETING ALL PATIENT REPORTS AND DATA...\n');

    // Count records before deletion
    const patientCount = await Patient.countDocuments();
    const admissionCount = await Admission.countDocuments();
    const submissionCount = await AuditSubmission.countDocuments();

    console.log('📊 Current data counts:');
    console.log(`   - Patients: ${patientCount}`);
    console.log(`   - Admissions: ${admissionCount}`);
    console.log(`   - Audit Submissions (Patient Reports): ${submissionCount}\n`);

    if (patientCount === 0 && admissionCount === 0 && submissionCount === 0) {
      console.log('ℹ️  No patient data found. Database is already empty.');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log('⚠️  WARNING: This will permanently delete:');
    console.log('   - ALL patient records');
    console.log('   - ALL admission records');
    console.log('   - ALL audit submissions (patient reports)');
    console.log('   - This action CANNOT be undone!\n');

    // Delete in order (respecting foreign key relationships)
    console.log('🗑️  Starting deletion...\n');

    // 1. Delete all audit submissions first (they reference patients and admissions)
    const deletedSubmissions = await AuditSubmission.deleteMany({});
    console.log(`✅ Deleted ${deletedSubmissions.deletedCount} audit submission(s) / patient report(s)`);

    // 2. Delete all admissions (they reference patients)
    const deletedAdmissions = await Admission.deleteMany({});
    console.log(`✅ Deleted ${deletedAdmissions.deletedCount} admission(s)`);

    // 3. Delete all patients
    const deletedPatients = await Patient.deleteMany({});
    console.log(`✅ Deleted ${deletedPatients.deletedCount} patient(s)`);

    // Verify deletion
    const remainingPatients = await Patient.countDocuments();
    const remainingAdmissions = await Admission.countDocuments();
    const remainingSubmissions = await AuditSubmission.countDocuments();

    console.log('\n📊 Verification:');
    console.log(`   - Remaining Patients: ${remainingPatients}`);
    console.log(`   - Remaining Admissions: ${remainingAdmissions}`);
    console.log(`   - Remaining Submissions: ${remainingSubmissions}`);

    if (remainingPatients === 0 && remainingAdmissions === 0 && remainingSubmissions === 0) {
      console.log('\n✅ SUCCESS: All patient data has been deleted successfully!');
      console.log('\n📌 Summary:');
      console.log(`   - Patients deleted: ${deletedPatients.deletedCount}`);
      console.log(`   - Admissions deleted: ${deletedAdmissions.deletedCount}`);
      console.log(`   - Audit Submissions deleted: ${deletedSubmissions.deletedCount}`);
      console.log('\n   ✅ Departments, forms, checklist items, and users remain intact.\n');
    } else {
      console.log('\n⚠️  WARNING: Some data may still remain. Please check manually.');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error deleting patient data:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

RUN();

