/**
 * Backfill Ward and Unit No for admissions that have empty or missing values.
 * Use after importing old data or when Ward/Unit show as NA in the UI.
 *
 * Usage: node src/scripts/seedWardUnit.js
 * Or:    npm run seed:ward-unit  (if added to package.json)
 */

const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Admission = require('../models/Admission');

dotenv.config();

const WARDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'ICU', 'ICU-2', 'CCU', 'Maternity', 'Pediatric', 'Emergency'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Day Care', 'Surgical', 'Medical'];

async function run() {
  await connectDB();

  const emptyWardOrUnit = await Admission.find({
    $or: [
      { ward: { $in: [null, '', undefined] } },
      { unitNo: { $in: [null, '', undefined] } },
    ],
  }).lean();

  if (emptyWardOrUnit.length === 0) {
    console.log('No admissions with empty Ward or Unit No. Nothing to update.');
    process.exit(0);
    return;
  }

  let updated = 0;
  for (const adm of emptyWardOrUnit) {
    const ward = (adm.ward && String(adm.ward).trim()) ? adm.ward : WARDS[Math.floor(Math.random() * WARDS.length)];
    const unitNo = (adm.unitNo && String(adm.unitNo).trim()) ? adm.unitNo : UNITS[Math.floor(Math.random() * UNITS.length)];
    await Admission.updateOne(
      { _id: adm._id },
      { $set: { ward: String(ward).trim(), unitNo: String(unitNo).trim() } }
    );
    updated++;
  }

  console.log(`Updated Ward and Unit No for ${updated} admission(s).`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
