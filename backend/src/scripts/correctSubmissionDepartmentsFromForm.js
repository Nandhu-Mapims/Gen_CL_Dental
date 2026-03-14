/**
 * Correct AuditSubmission.department to the form's department (form tag),
 * so department logs and reports show data by form's department, not submitter's.
 *
 * For each submission with formTemplate set:
 *   submission.department = form.departments[0] (form's tagged department)
 * Submissions without formTemplate are left unchanged.
 *
 * Usage: node src/scripts/correctSubmissionDepartmentsFromForm.js
 * Or:    npm run correct-submission-depts  (if added to package.json)
 */

const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const connectDB = require('../config/db');
const AuditSubmission = require('../models/AuditSubmission');
const FormTemplate = require('../models/FormTemplate');

const RUN = async () => {
  try {
    console.log('Correcting AuditSubmission.department from form\'s department...\n');
    await connectDB();

    const forms = await FormTemplate.find({}).select('_id departments').lean();
    const formToDept = new Map();
    for (const f of forms) {
      const depts = f.departments || [];
      if (depts.length > 0) {
        const firstDeptId = depts[0]._id || depts[0];
        formToDept.set(String(f._id), firstDeptId);
      }
    }
    console.log(`Loaded ${forms.length} form templates; ${formToDept.size} have departments.\n`);

    const submissions = await AuditSubmission.find({ formTemplate: { $exists: true, $ne: null } })
      .select('_id department formTemplate')
      .lean();
    console.log(`Found ${submissions.length} submissions with formTemplate.\n`);

    const updates = [];
    let changed = 0;
    let skipped = 0;
    for (const sub of submissions) {
      const formId = sub.formTemplate && (sub.formTemplate._id || sub.formTemplate);
      if (!formId) {
        skipped++;
        continue;
      }
      const formDeptId = formToDept.get(String(formId));
      if (!formDeptId) {
        skipped++;
        continue;
      }
      const currentDept = sub.department && (sub.department._id || sub.department);
      if (String(currentDept) === String(formDeptId)) {
        skipped++;
        continue;
      }
      updates.push({
        updateOne: {
          filter: { _id: sub._id },
          update: { $set: { department: formDeptId } },
        },
      });
      changed++;
    }

    if (updates.length === 0) {
      console.log('No submissions need updating (all already have form\'s department or form has no department).');
      process.exit(0);
      return;
    }

    const BATCH = 500;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await AuditSubmission.bulkWrite(batch);
      console.log(`  Updated batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(updates.length / BATCH)}`);
    }

    console.log('\nDone.');
    console.log(`  Updated: ${changed} submission(s)`);
    console.log(`  Skipped: ${skipped} (no form dept or already correct)`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

RUN();
