const dotenv = require('dotenv');
const connectDB = require('../config/db');
const mongoose = require('mongoose');

dotenv.config();

async function run() {
  try {
    await connectDB();
    const coll = mongoose.connection.collection('auditsubmissions');

    const results = await coll
      .aggregate([
        { $match: { uhid: { $exists: true, $ne: '' } } },
        { $group: { _id: '$uhid', departments: { $addToSet: '$department' } } },
        { $project: { uhid: '$_id', deptCount: { $size: '$departments' }, deptIds: '$departments' } },
        { $match: { deptCount: { $gt: 1 } } },
        { $sort: { deptCount: -1 } },
      ])
      .toArray();

    console.log('\n--- UHIDs with multi-department checklists ---\n');
    if (results.length === 0) {
      console.log('None found.\n');
      process.exit(0);
      return;
    }
    console.log(`Found ${results.length} UHID(s):\n`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.uhid}  (${r.deptCount} departments)`);
    });
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
