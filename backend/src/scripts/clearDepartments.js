const dotenv = require('dotenv');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Department = require('../models/Department');

dotenv.config();

const RUN = async () => {
  try {
    await connectDB();

    console.log('🗑️  Deleting all departments from database...\n');

    // Count departments before deletion
    const count = await Department.countDocuments();
    console.log(`📊 Current department count: ${count}\n`);

    if (count === 0) {
      console.log('ℹ️  No departments found in database.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log('⚠️  WARNING: This will delete ALL departments.\n');

    // Delete all departments
    const result = await Department.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} department(s)\n`);

    console.log('🎉 All departments deleted successfully!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error deleting departments:', err);
    process.exit(1);
  }
};

RUN();

