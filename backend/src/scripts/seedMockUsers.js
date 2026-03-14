/**
 * Seed Mock Users
 * ----------------
 * Adds a diverse set of mock users across all roles and departments.
 * Safe to re-run: uses upsert (findOneAndUpdate) so existing users are updated, not duplicated.
 *
 * Usage:  node src/scripts/seedMockUsers.js
 */

const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Department = require('../models/Department');

// ─── Mock Users ──────────────────────────────────────────────────────────────
// Password pattern: Password@123 (meets validation: uppercase, lowercase, digit, special char, 8+ chars)
const DEFAULT_PASSWORD = 'Password@123';

const MOCK_USERS = [
    // ── SUPER_ADMIN (no department required) ───────────────────────────────────
    {
        name: 'Dr. Arun Kapoor',
        email: 'arun.kapoor@hospital.com',
        role: 'SUPER_ADMIN',
        designation: 'Hospital Director',
    },
    {
        name: 'Priya Nataraj',
        email: 'priya.nataraj@hospital.com',
        role: 'SUPER_ADMIN',
        designation: 'IT Administrator',
    },

    // ── QA (no department required) ────────────────────────────────────────────
    {
        name: 'Dr. Meena Iyer',
        email: 'meena.iyer@hospital.com',
        role: 'QA',
        designation: 'Quality Assurance Lead',
    },
    {
        name: 'Sunil Bhatia',
        email: 'sunil.bhatia@hospital.com',
        role: 'QA',
        designation: 'Quality Analyst',
    },
    {
        name: 'Rekha Deshpande',
        email: 'rekha.deshpande@hospital.com',
        role: 'QA',
        designation: 'Quality Officer',
    },

    // ── DEPT_ADMIN (one per department) ────────────────────────────────────────
    { name: 'Dr. Lakshmi Rao', email: 'lakshmi.rao@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'OG' },
    { name: 'Dr. Ramesh Kulkarni', email: 'ramesh.kulkarni@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'GM' },
    { name: 'Dr. Anjali Deshmukh', email: 'anjali.deshmukh@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'ORTHO' },
    { name: 'Dr. Venkat Subramanian', email: 'venkat.s@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'PED' },
    { name: 'Dr. Sundar Pillai', email: 'sundar.pillai@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'CS' },
    { name: 'Dr. Kavita Joshi', email: 'kavita.joshi@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'GS' },
    { name: 'Dr. Nitin Saxena', email: 'nitin.saxena@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'ENT' },
    { name: 'Dr. Sneha Kulkarni', email: 'sneha.kulkarni@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'OPHTHAL' },
    { name: 'Dr. Ashwin Menon', email: 'ashwin.menon@hospital.com', role: 'DEPT_ADMIN', designation: 'Head of Department', deptCode: 'ANAE' },
    { name: 'Mrs. Sarita Naik', email: 'sarita.naik@hospital.com', role: 'DEPT_ADMIN', designation: 'Nursing Superintendent', deptCode: 'NUS' },
    { name: 'Mr. Deepak Jain', email: 'deepak.jain@hospital.com', role: 'DEPT_ADMIN', designation: 'MRD Manager', deptCode: 'MRD' },
    { name: 'Dr. Pooja Srinivasan', email: 'pooja.srini@hospital.com', role: 'DEPT_ADMIN', designation: 'Quality Director', deptCode: 'QUALITY' },

    // ── SUPERVISOR (2 per major department) ────────────────────────────────────
    { name: 'Dr. Suresh Menon', email: 'suresh.menon@hospital.com', role: 'SUPERVISOR', designation: 'Senior Consultant', deptCode: 'GM' },
    { name: 'Dr. Aruna Shastri', email: 'aruna.shastri@hospital.com', role: 'SUPERVISOR', designation: 'Senior Consultant', deptCode: 'GM' },
    { name: 'Dr. Rajeev Nambiar', email: 'rajeev.nambiar@hospital.com', role: 'SUPERVISOR', designation: 'Senior Surgeon', deptCode: 'GS' },
    { name: 'Dr. Shalini Verma', email: 'shalini.verma@hospital.com', role: 'SUPERVISOR', designation: 'Senior Surgeon', deptCode: 'GS' },
    { name: 'Dr. Kishore Hegde', email: 'kishore.hegde@hospital.com', role: 'SUPERVISOR', designation: 'Senior Orthopedic Surgeon', deptCode: 'ORTHO' },
    { name: 'Dr. Madhavi Pillai', email: 'madhavi.pillai@hospital.com', role: 'SUPERVISOR', designation: 'Senior Cardiologist', deptCode: 'CS' },
    { name: 'Dr. Swapna Kamath', email: 'swapna.kamath@hospital.com', role: 'SUPERVISOR', designation: 'Senior Pediatrician', deptCode: 'PED' },
    { name: 'Dr. Harish Tiwari', email: 'harish.tiwari@hospital.com', role: 'SUPERVISOR', designation: 'Senior OB-GYN', deptCode: 'OG' },
    { name: 'Mrs. Geetha Suresh', email: 'geetha.suresh@hospital.com', role: 'SUPERVISOR', designation: 'Nursing Supervisor', deptCode: 'NUS' },
    { name: 'Mr. Vivek Sharma', email: 'vivek.sharma@hospital.com', role: 'SUPERVISOR', designation: 'MRD Supervisor', deptCode: 'MRD' },

    // ── STAFF (3–4 per major department) ───────────────────────────────────────
    // General Medicine
    { name: 'Dr. Neelam Gupta', email: 'neelam.gupta@hospital.com', role: 'STAFF', designation: 'Consultant', deptCode: 'GM' },
    { name: 'Dr. Akash Jain', email: 'akash.jain@hospital.com', role: 'STAFF', designation: 'Resident', deptCode: 'GM' },
    { name: 'Nurse Fatima Khan', email: 'fatima.khan@hospital.com', role: 'STAFF', designation: 'Staff Nurse', deptCode: 'GM' },
    { name: 'Dr. Isha Reddy', email: 'isha.reddy@hospital.com', role: 'STAFF', designation: 'Junior Resident', deptCode: 'GM' },

    // General Surgery
    { name: 'Dr. Pranav Shetty', email: 'pranav.shetty@hospital.com', role: 'STAFF', designation: 'Surgeon', deptCode: 'GS' },
    { name: 'Dr. Ritu Agarwal', email: 'ritu.agarwal@hospital.com', role: 'STAFF', designation: 'Resident', deptCode: 'GS' },
    { name: 'Nurse Anita Das', email: 'anita.das@hospital.com', role: 'STAFF', designation: 'OT Nurse', deptCode: 'GS' },

    // Orthopedics
    { name: 'Dr. Gaurav Mishra', email: 'gaurav.mishra@hospital.com', role: 'STAFF', designation: 'Consultant', deptCode: 'ORTHO' },
    { name: 'Dr. Nisha Patil', email: 'nisha.patil@hospital.com', role: 'STAFF', designation: 'Resident', deptCode: 'ORTHO' },
    { name: 'Physio Arun Thomas', email: 'arun.thomas@hospital.com', role: 'STAFF', designation: 'Physiotherapist', deptCode: 'ORTHO' },

    // Pediatrics
    { name: 'Dr. Aarti Sharma', email: 'aarti.sharma@hospital.com', role: 'STAFF', designation: 'Pediatrician', deptCode: 'PED' },
    { name: 'Dr. Rohan Mehta', email: 'rohan.mehta@hospital.com', role: 'STAFF', designation: 'Resident', deptCode: 'PED' },
    { name: 'Nurse Latha Krishnan', email: 'latha.krishnan@hospital.com', role: 'STAFF', designation: 'Pediatric Nurse', deptCode: 'PED' },

    // Cardiac Surgery
    { name: 'Dr. Vikrant Choudhary', email: 'vikrant.c@hospital.com', role: 'STAFF', designation: 'Cardiac Surgeon', deptCode: 'CS' },
    { name: 'Dr. Divya Nair', email: 'divya.nair@hospital.com', role: 'STAFF', designation: 'Resident', deptCode: 'CS' },
    { name: 'Tech Manoj Kumar', email: 'manoj.kumar@hospital.com', role: 'STAFF', designation: 'Perfusionist', deptCode: 'CS' },

    // OB-GYN
    { name: 'Dr. Vandana Rao', email: 'vandana.rao@hospital.com', role: 'STAFF', designation: 'Obstetrician', deptCode: 'OG' },
    { name: 'Dr. Smita Pawar', email: 'smita.pawar@hospital.com', role: 'STAFF', designation: 'Gynecologist', deptCode: 'OG' },
    { name: 'Nurse Bindu Mohan', email: 'bindu.mohan@hospital.com', role: 'STAFF', designation: 'Midwife', deptCode: 'OG' },

    // ENT
    { name: 'Dr. Manoj Thapar', email: 'manoj.thapar@hospital.com', role: 'STAFF', designation: 'ENT Surgeon', deptCode: 'ENT' },
    { name: 'Dr. Pallavi Kulkarni', email: 'pallavi.k@hospital.com', role: 'STAFF', designation: 'Audiologist', deptCode: 'ENT' },

    // Ophthalmology
    { name: 'Dr. Sameer Bose', email: 'sameer.bose@hospital.com', role: 'STAFF', designation: 'Ophthalmologist', deptCode: 'OPHTHAL' },
    { name: 'Tech Meghna Roy', email: 'meghna.roy@hospital.com', role: 'STAFF', designation: 'Optometrist', deptCode: 'OPHTHAL' },

    // Anesthesiology
    { name: 'Dr. Rajiv Malhotra', email: 'rajiv.malhotra@hospital.com', role: 'STAFF', designation: 'Anesthesiologist', deptCode: 'ANAE' },
    { name: 'Dr. Tanvi Bhatt', email: 'tanvi.bhatt@hospital.com', role: 'STAFF', designation: 'Resident', deptCode: 'ANAE' },

    // Nursing Services
    { name: 'Nurse Jaya Prakash', email: 'jaya.prakash@hospital.com', role: 'STAFF', designation: 'Ward Nurse', deptCode: 'NUS' },
    { name: 'Nurse Shanti Devi', email: 'shanti.devi@hospital.com', role: 'STAFF', designation: 'ICU Nurse', deptCode: 'NUS' },
    { name: 'Nurse Preethi Thomas', email: 'preethi.thomas@hospital.com', role: 'STAFF', designation: 'OT Nurse', deptCode: 'NUS' },

    // MRD
    { name: 'Mr. Karthik Rajan', email: 'karthik.rajan@hospital.com', role: 'STAFF', designation: 'MRD Clerk', deptCode: 'MRD' },
    { name: 'Ms. Ananya Sen', email: 'ananya.sen@hospital.com', role: 'STAFF', designation: 'Medical Coder', deptCode: 'MRD' },

    // Quality Department
    { name: 'Ms. Revathi Krishnamurthy', email: 'revathi.k@hospital.com', role: 'STAFF', designation: 'Quality Coordinator', deptCode: 'QUALITY' },
    { name: 'Mr. Siddharth Nanda', email: 'siddharth.nanda@hospital.com', role: 'STAFF', designation: 'Data Analyst', deptCode: 'QUALITY' },
];

// ─── Main ────────────────────────────────────────────────────────────────────
const run = async () => {
    try {
        console.log('🚀 Seeding mock users...\n');
        await connectDB();

        // Hash the default password once
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // Build department code → _id map
        const departments = await Department.find({}).lean();
        const deptMap = new Map();
        departments.forEach((d) => deptMap.set(d.code, d._id));

        console.log(`📋 Found ${departments.length} departments\n`);

        const summary = { created: 0, updated: 0, skipped: 0, errors: [] };

        for (const mockUser of MOCK_USERS) {
            try {
                // Resolve department
                let departmentId = undefined;
                if (mockUser.deptCode) {
                    departmentId = deptMap.get(mockUser.deptCode);
                    if (!departmentId) {
                        console.log(`   ⚠️  Department ${mockUser.deptCode} not found — skipping ${mockUser.name}`);
                        summary.skipped++;
                        continue;
                    }
                }

                const userData = {
                    name: mockUser.name,
                    email: mockUser.email,
                    passwordHash,
                    role: mockUser.role,
                    designation: mockUser.designation || '',
                    isActive: true,
                };

                // Attach department for roles that require it
                if (['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(mockUser.role) && departmentId) {
                    userData.department = departmentId;
                }

                const result = await User.findOneAndUpdate(
                    { email: mockUser.email },
                    { $set: userData },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                const isNew = result.createdAt?.getTime() === result.updatedAt?.getTime();
                if (isNew) {
                    summary.created++;
                    console.log(`   ✅ Created  ${mockUser.role.padEnd(12)} ${mockUser.name} (${mockUser.email})`);
                } else {
                    summary.updated++;
                    console.log(`   🔄 Updated  ${mockUser.role.padEnd(12)} ${mockUser.name} (${mockUser.email})`);
                }
            } catch (err) {
                summary.errors.push({ user: mockUser.email, error: err.message });
                console.error(`   ❌ Error with ${mockUser.email}: ${err.message}`);
            }
        }

        // ─── Summary ───────────────────────────────────────────────────────────────
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 MOCK USER SEED COMPLETE');
        console.log('═'.repeat(60));
        console.log(`   ✅ Created:  ${summary.created}`);
        console.log(`   🔄 Updated:  ${summary.updated}`);
        console.log(`   ⏭️  Skipped:  ${summary.skipped}`);
        if (summary.errors.length) {
            console.log(`   ❌ Errors:   ${summary.errors.length}`);
            summary.errors.forEach((e) => console.log(`      • ${e.user}: ${e.error}`));
        }

        // Role breakdown
        const roleCounts = {};
        MOCK_USERS.forEach((u) => {
            roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
        });
        console.log('\n📊 ROLE BREAKDOWN:');
        Object.entries(roleCounts).forEach(([role, count]) => {
            console.log(`   ${role.padEnd(14)} ${count} users`);
        });

        console.log('\n🔑 ALL MOCK USERS USE THE SAME PASSWORD:');
        console.log(`   Password: ${DEFAULT_PASSWORD}`);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Print credentials table
        console.log('\n📋 CREDENTIALS TABLE:\n');
        console.log(`${'Role'.padEnd(14)} ${'Name'.padEnd(30)} ${'Email'.padEnd(35)} Password`);
        console.log('─'.repeat(100));
        MOCK_USERS.forEach((u) => {
            console.log(`${u.role.padEnd(14)} ${u.name.padEnd(30)} ${u.email.padEnd(35)} ${DEFAULT_PASSWORD}`);
        });

        console.log('\n✅ Done! You can now log in with any of these accounts.\n');
        process.exit(0);
    } catch (err) {
        console.error('❌ FATAL ERROR:', err);
        process.exit(1);
    }
};

run();
