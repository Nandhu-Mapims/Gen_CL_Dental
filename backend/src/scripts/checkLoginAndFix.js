/**
 * Check DB for login issues and fix admin so you can login.
 * Run: node src/scripts/checkLoginAndFix.js
 */

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const bcrypt = require('bcrypt');

const ADMIN_EMAIL = 'admin@hospital.com';
const ADMIN_PASSWORD = 'TataTiago@2026';

async function run() {
  try {
    await connectDB();

    const count = await User.countDocuments();
    console.log('\n📊 Users in DB:', count);

    if (count === 0) {
      console.log('❌ No users found. Run the seed: node src/seed/cleanSeed.js\n');
      process.exit(1);
    }

    const users = await User.find().select('email role isActive passwordHash').lean();
    console.log('\n👤 Users:');
    for (const u of users) {
      const hasHash = !!u.passwordHash;
      const active = u.isActive !== false;
      const ok = hasHash && active ? '✅' : '⚠️';
      console.log(`   ${ok} ${u.email} (${u.role}) isActive=${active} hasPassword=${hasHash}`);
    }

    let admin = await User.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
      console.log('\n❌ Admin user (admin@hospital.com) not found. Run: node src/seed/cleanSeed.js\n');
      process.exit(1);
    }

    admin.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    admin.isActive = true;
    await admin.save();

    console.log('\n✅ Admin login fixed.');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('\n🎉 Try logging in again.\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

run();
