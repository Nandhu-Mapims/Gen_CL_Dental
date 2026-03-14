const mongoose = require('mongoose');
require('dotenv').config();

const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital-audit');
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

const RUN = async () => {
  try {
    await connectDB();

    console.log('\n📋 Checking Form Template Assignments...\n');

    // Get all departments
    const departments = await Department.find({ isActive: true });
    const anaDept = departments.find(d => d.code === 'ANAE');
    const nusDept = departments.find(d => d.code === 'NUS');
    const gsDept = departments.find(d => d.code === 'GS');

    console.log('Departments:');
    departments.forEach(dept => {
      console.log(`  - ${dept.name} (${dept.code}) - ID: ${dept._id}`);
    });

    // Get all forms
    const forms = await FormTemplate.find().populate('departments');

    console.log('\n📝 Form Templates:');
    forms.forEach(form => {
      console.log(`\n  Form: ${form.name}`);
      console.log(`    ID: ${form._id}`);
      console.log(`    isActive: ${form.isActive}`);
      console.log(`    isCommon: ${form.isCommon}`);
      console.log(`    Departments assigned:`);
      if (form.departments && form.departments.length > 0) {
        form.departments.forEach(dept => {
          const deptObj = typeof dept === 'object' ? dept : departments.find(d => d._id.toString() === dept.toString());
          if (deptObj) {
            console.log(`      - ${deptObj.name} (${deptObj.code})`);
          } else {
            console.log(`      - Unknown department ID: ${dept}`);
          }
        });
      } else {
        console.log(`      - None`);
      }

      // Check if form should be common (ANAE or NUS)
      const isAnaeForm = form.departments?.some(d => {
        const deptId = typeof d === 'object' ? d._id?.toString() : d?.toString();
        return deptId === anaDept?._id?.toString();
      });
      const isNusForm = form.departments?.some(d => {
        const deptId = typeof d === 'object' ? d._id?.toString() : d?.toString();
        return deptId === nusDept?._id?.toString();
      });

      if (isAnaeForm || isNusForm) {
        console.log(`    ⚠️  This form is assigned to ANAE or NUS - should be visible to ALL users`);
      } else if (form.isCommon) {
        console.log(`    ⚠️  WARNING: Form is marked as isCommon but NOT assigned to ANAE/NUS`);
      }
    });

    // Get all users
    console.log('\n👥 Users:');
    const users = await User.find().populate('department');
    users.forEach(user => {
      console.log(`\n  User: ${user.name} (${user.email})`);
      console.log(`    Role: ${user.role}`);
      if (user.department) {
        console.log(`    Department: ${user.department.name} (${user.department.code})`);
      } else {
        console.log(`    ⚠️  WARNING: No department assigned`);
      }
    });

    // Check General Surgery specifically
    if (gsDept) {
      console.log(`\n🔍 General Surgery Department Check:`);
      console.log(`  Department: ${gsDept.name} (${gsDept.code}) - ID: ${gsDept._id}`);
      
      const gsForms = forms.filter(form => {
        return form.departments?.some(d => {
          const deptId = typeof d === 'object' ? d._id?.toString() : d?.toString();
          return deptId === gsDept._id.toString();
        });
      });

      console.log(`  Forms assigned to GS: ${gsForms.length}`);
      gsForms.forEach(form => {
        console.log(`    - ${form.name} (isCommon: ${form.isCommon})`);
      });

      const gsUsers = users.filter(u => u.department && u.department._id.toString() === gsDept._id.toString());
      console.log(`  Users assigned to GS: ${gsUsers.length}`);
      gsUsers.forEach(user => {
        console.log(`    - ${user.name} (${user.email})`);
      });

      if (gsForms.length === 0) {
        console.log(`  ⚠️  WARNING: No forms assigned to General Surgery department!`);
      }
      if (gsUsers.length === 0) {
        console.log(`  ⚠️  WARNING: No users assigned to General Surgery department!`);
      }
    } else {
      console.log(`\n⚠️  WARNING: General Surgery department not found!`);
    }

    console.log('\n✅ Check complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

RUN();

