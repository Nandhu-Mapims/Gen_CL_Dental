/**
 * Seed Full Mock Data (50 audit cases with submissions)
 * ─────────────────────────────────────────────────────
 * Creates departments, users, form templates, checklist items,
 * and ~50 audit submissions so the Admin Dashboard shows real data.
 *
 * Safe to re-run: clears AuditSubmission, ChecklistItem, FormTemplate,
 * then re-creates them. Users & Departments are upserted.
 *
 * Usage:  node src/scripts/seedFullMockData.js
 */

const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_PASSWORD = 'Password@123';

const DEPARTMENTS = [
    { name: 'Obstetrics & Gynecology', code: 'OG' },
    { name: 'General Medicine', code: 'GM' },
    { name: 'Orthopedics', code: 'ORTHO' },
    { name: 'Pediatrics', code: 'PED' },
    { name: 'Ophthalmology', code: 'OPHTHAL' },
    { name: 'Cardiac Surgery', code: 'CS' },
    { name: 'ENT', code: 'ENT' },
    { name: 'General Surgery', code: 'GS' },
    { name: 'Anesthesiology', code: 'ANAE' },
    { name: 'Nursing Services', code: 'NUS' },
    { name: 'Medical Records Department', code: 'MRD' },
    { name: 'Quality Department', code: 'QUALITY' },
];

// Checklist items per department form (realistic hospital audit questions)
const CHECKLIST_LABELS = [
    'Patient identification verified (name, UHID, DOB)',
    'Informed consent signed and filed',
    'Medication chart updated with current prescriptions',
    'Allergies documented on cover sheet',
    'Vital signs recorded at admission',
    'Infection control protocols followed (hand hygiene, PPE)',
    'Patient education provided (disease, treatment plan)',
    'Discharge planning initiated within 24 hrs',
    'Fall risk assessment completed',
    'Pain assessment documented',
];

// Mock staff users (one per dept) who will be "submitters"
const STAFF_USERS = [
    { name: 'Dr. Neelam Gupta', email: 'neelam.gupta@hospital.com', deptCode: 'GM' },
    { name: 'Dr. Pranav Shetty', email: 'pranav.shetty@hospital.com', deptCode: 'GS' },
    { name: 'Dr. Gaurav Mishra', email: 'gaurav.mishra@hospital.com', deptCode: 'ORTHO' },
    { name: 'Dr. Aarti Sharma', email: 'aarti.sharma@hospital.com', deptCode: 'PED' },
    { name: 'Dr. Sameer Bose', email: 'sameer.bose@hospital.com', deptCode: 'OPHTHAL' },
    { name: 'Dr. Vikrant Choudhary', email: 'vikrant.c@hospital.com', deptCode: 'CS' },
    { name: 'Dr. Manoj Thapar', email: 'manoj.thapar@hospital.com', deptCode: 'ENT' },
    { name: 'Dr. Vandana Rao', email: 'vandana.rao@hospital.com', deptCode: 'OG' },
    { name: 'Dr. Rajiv Malhotra', email: 'rajiv.malhotra@hospital.com', deptCode: 'ANAE' },
    { name: 'Nurse Jaya Prakash', email: 'jaya.prakash@hospital.com', deptCode: 'NUS' },
    { name: 'Mr. Karthik Rajan', email: 'karthik.rajan@hospital.com', deptCode: 'MRD' },
    { name: 'Ms. Revathi Krishnamurthy', email: 'revathi.k@hospital.com', deptCode: 'QUALITY' },
];

// Corrective / Preventive actions text
const CORRECTIVE = [
    'Staff retraining on patient ID protocol',
    'Immediate chart audit initiated',
    'Medication reconciliation workflow updated',
    'Allergy documentation template revised',
    'Vital-sign monitoring schedule adjusted',
    'PPE compliance check added to rounds',
];
const PREVENTIVE = [
    'Monthly compliance audit scheduled',
    'New SOP issued and circulated',
    'Competency assessment planned',
    'Double-check system implemented',
    'Quality indicator dashboard updated',
    'Peer-review process established',
];
const REMARKS = [
    'Completed as per protocol',
    'Verified and documented',
    'All requirements met',
    'Reviewed and confirmed',
    'Documented in patient chart',
    'Minor delay — corrected same day',
    'Partially compliant — follow-up needed',
    null,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (daysBack) => {
    const now = new Date();
    const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
};

// ─── Main ────────────────────────────────────────────────────────────────────
const run = async () => {
    try {
        console.log('🚀 Seeding full mock data (50 audit cases)...\n');
        await connectDB();

        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // ── 1. Upsert Departments ──────────────────────────────────────────────
        console.log('📋 Step 1: Upserting departments...');
        const deptMap = new Map(); // code → doc
        for (const d of DEPARTMENTS) {
            const dept = await Department.findOneAndUpdate(
                { code: d.code },
                { $set: { name: d.name, code: d.code, isActive: true } },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );
            deptMap.set(d.code, dept);
        }
        console.log(`   ✅ ${deptMap.size} departments ready\n`);

        // ── 2. Upsert Admin user ───────────────────────────────────────────────
        console.log('👤 Step 2: Upserting admin user...');
        const admin = await User.findOneAndUpdate(
            { email: 'admin@hospital.com' },
            {
                $set: {
                    name: 'System Administrator',
                    email: 'admin@hospital.com',
                    passwordHash: await bcrypt.hash('TataTiago@2026', 10),
                    role: 'SUPER_ADMIN',
                    isActive: true,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        console.log(`   ✅ Admin: admin@hospital.com / TataTiago@2026\n`);

        // ── 3. Upsert Staff users ──────────────────────────────────────────────
        console.log('👥 Step 3: Upserting staff users (one per dept)...');
        const staffUserMap = new Map(); // deptCode → user
        for (const s of STAFF_USERS) {
            const dept = deptMap.get(s.deptCode);
            if (!dept) continue;
            const user = await User.findOneAndUpdate(
                { email: s.email },
                {
                    $set: {
                        name: s.name,
                        email: s.email,
                        passwordHash,
                        role: 'STAFF',
                        designation: 'Staff',
                        department: dept._id,
                        isActive: true,
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );
            staffUserMap.set(s.deptCode, user);
        }
        console.log(`   ✅ ${staffUserMap.size} staff users ready\n`);

        // ── 4. Clear old submissions, forms, checklists ────────────────────────
        console.log('🧹 Step 4: Clearing old audit data...');
        const delSub = await AuditSubmission.deleteMany({});
        const delCk = await ChecklistItem.deleteMany({});
        const delFt = await FormTemplate.deleteMany({});
        console.log(`   ✅ Deleted ${delSub.deletedCount} submissions, ${delCk.deletedCount} checklist items, ${delFt.deletedCount} form templates\n`);

        // ── 5. Create Form Templates + Checklist Items ─────────────────────────
        console.log('📝 Step 5: Creating form templates & checklist items...');
        const formMap = new Map(); // deptCode → { form, items[] }
        const clinicalDepts = DEPARTMENTS.filter(d => !['ANAE', 'NUS'].includes(d.code));

        for (const d of clinicalDepts) {
            const dept = deptMap.get(d.code);
            const form = await FormTemplate.create({
                name: `${d.name} Audit Form`,
                description: `Quality audit checklist for ${d.name}`,
                departments: [dept._id],
                isCommon: false,
                isActive: true,
            });

            const items = [];
            for (let i = 0; i < CHECKLIST_LABELS.length; i++) {
                const item = await ChecklistItem.create({
                    label: CHECKLIST_LABELS[i],
                    responseType: 'YES_NO',
                    isMandatory: i < 6, // first 6 mandatory
                    order: i + 1,
                    formTemplate: form._id,
                    department: dept._id,
                    departmentScope: 'SINGLE',
                });
                items.push(item);
            }

            formMap.set(d.code, { form, items });
            console.log(`   ✅ ${d.code}: form + ${items.length} checklist items`);
        }
        console.log('');

        // ── 6. Create 50 Audit Submissions ─────────────────────────────────────
        console.log('📊 Step 6: Creating ~50 audit cases with submissions...');

        let totalSubmissions = 0;
        let totalYes = 0;
        let totalNo = 0;
        const casesPerDept = {};

        // We want ~50 total "cases". A case = one audit session (unique date+time+user).
        // Spread across clinical depts: ~5 cases each for 10 depts = 50 cases.
        const TARGET_CASES = 50;
        const numClinical = clinicalDepts.length;
        const casesEach = Math.ceil(TARGET_CASES / numClinical);

        for (const d of clinicalDepts) {
            const dept = deptMap.get(d.code);
            const formData = formMap.get(d.code);
            if (!formData) continue;

            // Pick submitter — prefer the dept's own staff, fall back to first available
            const submitter = staffUserMap.get(d.code) || staffUserMap.values().next().value;

            casesPerDept[d.code] = 0;

            for (let c = 0; c < casesEach; c++) {
                // Each "case" = one audit session at a specific datetime
                const auditDate = randomDate(180); // last 6 months
                const hours = 8 + Math.floor(Math.random() * 10); // 08:00 – 17:59
                const mins = Math.floor(Math.random() * 60);
                const auditTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

                // Submit 7-10 of the 10 checklist items per case
                const numItems = 7 + Math.floor(Math.random() * 4);
                const shuffled = [...formData.items].sort(() => Math.random() - 0.5);
                const selected = shuffled.slice(0, numItems);

                for (const item of selected) {
                    // ~78% compliance rate (realistic hospital data)
                    const isCompliant = Math.random() < 0.78;
                    const responseValue = isCompliant ? 'YES' : 'NO';

                    if (isCompliant) totalYes++;
                    else totalNo++;

                    // 25% of NO items get corrective/preventive actions
                    const hasActions = !isCompliant && Math.random() < 0.25;

                    const sub = await AuditSubmission.create({
                        department: dept._id,
                        formTemplate: formData.form._id,
                        checklistItemId: item._id,
                        responseValue,
                        yesNoNa: responseValue,
                        remarks: pick(REMARKS) || undefined,
                        responsibility: pick(['Nurse', 'Doctor', 'Staff', 'Pharmacist', 'Lab Tech']),
                        submittedBy: submitter._id,
                        submittedAt: auditDate,
                        auditDate,
                        auditTime,
                        corrective: hasActions ? pick(CORRECTIVE) : '',
                        preventive: hasActions ? pick(PREVENTIVE) : '',
                        isLocked: true,
                    });

                    totalSubmissions++;
                }
                casesPerDept[d.code]++;
            }

            console.log(`   ✅ ${d.code}: ${casesPerDept[d.code]} cases created`);
        }

        // ── Summary ────────────────────────────────────────────────────────────
        const compliance = ((totalYes / (totalYes + totalNo)) * 100).toFixed(1);
        const totalCases = Object.values(casesPerDept).reduce((a, b) => a + b, 0);

        console.log('\n' + '═'.repeat(60));
        console.log('🎉 FULL MOCK DATA SEED COMPLETE');
        console.log('═'.repeat(60));
        console.log(`   📋 Departments:       ${deptMap.size}`);
        console.log(`   📝 Form Templates:    ${formMap.size}`);
        console.log(`   ✅ Checklist Items:   ${formMap.size * CHECKLIST_LABELS.length}`);
        console.log(`   📊 Total Cases:       ${totalCases}`);
        console.log(`   📊 Total Submissions: ${totalSubmissions}`);
        console.log(`   ✅ Compliant (YES):   ${totalYes}`);
        console.log(`   ❌ Non-Compliant (NO):${totalNo}`);
        console.log(`   📈 Compliance Rate:   ${compliance}%`);

        console.log('\n🔑 LOGIN CREDENTIALS:');
        console.log('━'.repeat(60));
        console.log(`   ADMIN:  admin@hospital.com / TataTiago@2026`);
        console.log(`   STAFF:  (any staff email)  / ${DEFAULT_PASSWORD}`);
        console.log('\n   Staff emails:');
        STAFF_USERS.forEach(s => console.log(`     ${s.email.padEnd(35)} (${s.deptCode})`));

        console.log('\n━'.repeat(60));
        console.log('✅ Dashboard should now show charts and data!');
        console.log('🔄 Refresh http://localhost:5173/admin/dashboard\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ FATAL ERROR:', err);
        process.exit(1);
    }
};

run();
