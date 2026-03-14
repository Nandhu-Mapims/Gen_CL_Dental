const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');
const bcrypt = require('bcrypt');

dotenv.config();

const RUN = async () => {
  try {
    console.log('🔐 Resetting admin password...\n');
    await connectDB();

    const adminEmail = 'admin@hospital.com';
    const adminPassword = 'TataTiago@2026';

    const admin = await User.findOne({ email: adminEmail });
    
    if (!admin) {
      console.log('❌ Admin user not found. Please run seed script first.');
      process.exit(1);
    }

    // Reset password
    admin.passwordHash = await bcrypt.hash(adminPassword, 10);
    admin.isActive = true;
    await admin.save();

    console.log('✅ Admin password reset successfully!');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n🎉 You can now login with these credentials.\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

RUN();
