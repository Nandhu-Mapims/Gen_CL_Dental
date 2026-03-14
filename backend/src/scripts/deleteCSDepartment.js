const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');
const User = require('../models/User');

dotenv.config();

(async () => {
  try {
    await connectDB();

    // Find CS department
    const csDept = await Department.findOne({ code: 'CS' });
    if (!csDept) {
      console.log('❌ CS department not found');
      process.exit(1);
    }

    console.log(`\n🗑️  Deleting Cardiac Surgery (CS) Department and all related data...\n`);

    // 1. Find all forms assigned to CS
    const forms = await FormTemplate.find({
      departments: csDept._id,
    });

    console.log(`📋 Found ${forms.length} form(s) assigned to CS:`);
    forms.forEach((form) => {
      console.log(`   - ${form.name} (${form._id})`);
    });

    // 2. Find all checklist items for these forms
    const formIds = forms.map((f) => f._id);
    const items = await ChecklistItem.find({
      formTemplate: { $in: formIds },
    });

    console.log(`\n📝 Found ${items.length} checklist item(s) in CS forms`);

    // 3. Find all audit submissions for CS
    const submissions = await AuditSubmission.find({
      department: csDept._id,
    });

    console.log(`\n📊 Found ${submissions.length} audit submission(s) for CS`);

    // 4. Find users assigned to CS
    const users = await User.find({
      department: csDept._id,
    });

    console.log(`\n👤 Found ${users.length} user(s) assigned to CS:`);
    users.forEach((user) => {
      console.log(`   - ${user.name} (${user.email})`);
    });

    // Confirmation
    console.log(`\n⚠️  WARNING: This will delete:`);
    console.log(`   - CS Department`);
    console.log(`   - ${forms.length} form template(s)`);
    console.log(`   - ${items.length} checklist item(s)`);
    console.log(`   - ${submissions.length} audit submission(s)`);
    console.log(`   - ${users.length} user account(s) will be unassigned (not deleted)`);

    // Delete in order
    console.log(`\n🗑️  Starting deletion...\n`);

    // Delete audit submissions
    if (submissions.length > 0) {
      const deleteSubmissions = await AuditSubmission.deleteMany({
        department: csDept._id,
      });
      console.log(`✅ Deleted ${deleteSubmissions.deletedCount} audit submission(s)`);
    }

    // Delete checklist items
    if (items.length > 0) {
      const deleteItems = await ChecklistItem.deleteMany({
        formTemplate: { $in: formIds },
      });
      console.log(`✅ Deleted ${deleteItems.deletedCount} checklist item(s)`);
    }

    // Delete form templates
    if (forms.length > 0) {
      const deleteForms = await FormTemplate.deleteMany({
        _id: { $in: formIds },
      });
      console.log(`✅ Deleted ${deleteForms.deletedCount} form template(s)`);
    }

    // Unassign users from CS (set department to null)
    if (users.length > 0) {
      await User.updateMany(
        { department: csDept._id },
        { $unset: { department: 1 } }
      );
      console.log(`✅ Unassigned ${users.length} user(s) from CS department`);
    }

    // Finally, delete the department
    await Department.findByIdAndDelete(csDept._id);
    console.log(`✅ Deleted CS Department`);

    console.log(`\n🎉 Deletion completed successfully!`);
    console.log(`\n📌 Summary:`);
    console.log(`   - Department: Deleted`);
    console.log(`   - Forms: ${forms.length} deleted`);
    console.log(`   - Checklist Items: ${items.length} deleted`);
    console.log(`   - Audit Submissions: ${submissions.length} deleted`);
    console.log(`   - Users: ${users.length} unassigned (accounts preserved)`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();

