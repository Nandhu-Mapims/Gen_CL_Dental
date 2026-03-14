/**
 * Clear all database data except users with role SUPER_ADMIN.
 * Use: node src/scripts/clearAllExceptAdmin.js
 * Docker: docker compose exec backend node src/scripts/clearAllExceptAdmin.js
 */

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
const ChiefDoctor = require('../models/ChiefDoctor');
const Location = require('../models/Location');
const Shift = require('../models/Shift');
const Asset = require('../models/Asset');
const Notification = require('../models/Notification');
const MasterData = require('../models/MasterData');

dotenv.config();

const ADMIN_ROLE = 'SUPER_ADMIN';

const run = async () => {
  try {
    await connectDB();

    const adminCount = await User.countDocuments({ role: ADMIN_ROLE });
    console.log('🗑️  Clearing all data except SUPER_ADMIN user(s)...\n');
    console.log(`   Keeping ${adminCount} admin user(s).\n`);

    const deleteInOrder = [
      [AuditSubmission, 'Audit submissions'],
      [ChecklistItem, 'Checklist items'],
      [FormTemplate, 'Form templates'],
      [ChiefDoctor, 'Chief doctors'],
      [Notification, 'Notifications'],
      [Admission, 'Admissions'],
      [Patient, 'Patients'],
      [Location, 'Locations'],
      [Shift, 'Shifts'],
      [Asset, 'Assets'],
      [MasterData, 'Master data'],
    ];

    for (const [Model, label] of deleteInOrder) {
      const result = await Model.deleteMany({});
      console.log(`   ✅ ${label}: ${result.deletedCount}`);
    }

    const userResult = await User.deleteMany({ role: { $ne: ADMIN_ROLE } });
    console.log(`   ✅ Non-admin users: ${userResult.deletedCount}`);

    const deptResult = await Department.deleteMany({});
    console.log(`   ✅ Departments: ${deptResult.deletedCount}`);

    const remainingAdmins = await User.countDocuments({ role: ADMIN_ROLE });
    console.log('\n🎉 Done. Remaining: ' + remainingAdmins + ' admin user(s).\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err?.message ?? err);
    process.exit(1);
  }
};

run();
