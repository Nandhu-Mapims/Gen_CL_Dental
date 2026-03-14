const dotenv = require('dotenv');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const AuditSubmission = require('../models/AuditSubmission');
const Department = require('../models/Department');
const User = require('../models/User');

dotenv.config();

const RUN = async () => {
  try {
    await connectDB();

    console.log('🔍 Finding duplicate submissions...\n');

    // Find all duplicate submissions grouped by UHID, IPID, and Department
    const duplicates = await AuditSubmission.aggregate([
      {
        $group: {
          _id: {
            uhid: '$uhid',
            ipid: '$ipid',
            department: '$department'
          },
          submissions: {
            $push: {
              _id: '$_id',
              submittedAt: '$submittedAt',
              submittedBy: '$submittedBy',
              patientName: '$patientName'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 } // Only groups with more than 1 submission
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate submissions found in the database.\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`📊 Found ${duplicates.length} duplicate group(s):\n`);

    let totalDuplicatesToDelete = 0;
    const duplicateDetails = [];

    // Process each duplicate group
    for (const group of duplicates) {
      const { uhid, ipid, department } = group._id;
      
      // Get department name
      const dept = await Department.findById(department);
      const deptName = dept ? dept.name : 'Unknown Department';

      // Sort submissions by submittedAt (oldest first)
      const sortedSubmissions = group.submissions.sort((a, b) => 
        new Date(a.submittedAt) - new Date(b.submittedAt)
      );

      // Keep the first (oldest) submission, mark others for deletion
      const toKeep = sortedSubmissions[0];
      const toDelete = sortedSubmissions.slice(1);

      totalDuplicatesToDelete += toDelete.length;

      // Get submitter names
      const keepSubmitter = await User.findById(toKeep.submittedBy);
      const keepSubmitterName = keepSubmitter ? keepSubmitter.name : 'Unknown';

      duplicateDetails.push({
        uhid,
        ipid,
        department: deptName,
        totalCount: group.count,
        keepCount: 1,
        deleteCount: toDelete.length,
        keepSubmission: {
          id: toKeep._id,
          submittedAt: toKeep.submittedAt,
          submittedBy: keepSubmitterName
        },
        deleteSubmissions: toDelete.map(sub => ({
          id: sub._id,
          submittedAt: sub.submittedAt
        }))
      });

      console.log(`📋 UHID: ${uhid}, IPID: ${ipid}, Department: ${deptName}`);
      console.log(`   Total submissions: ${group.count}`);
      console.log(`   Keeping: 1 (oldest - submitted on ${new Date(toKeep.submittedAt).toLocaleString('en-GB')} by ${keepSubmitterName})`);
      console.log(`   Deleting: ${toDelete.length} duplicate(s)`);
      console.log('');
    }

    console.log(`\n⚠️  SUMMARY:`);
    console.log(`   - Duplicate groups found: ${duplicates.length}`);
    console.log(`   - Total duplicate submissions to delete: ${totalDuplicatesToDelete}`);
    console.log(`   - Submissions to keep: ${duplicates.length} (one per group - the oldest)\n`);

    // Ask for confirmation
    console.log('⚠️  WARNING: This will permanently delete duplicate submissions.');
    console.log('   Only the oldest submission for each UHID/IPID/Department combination will be kept.\n');

    // For automated execution, we'll proceed (you can add readline for interactive confirmation)
    console.log('🗑️  Proceeding with deletion...\n');

    let deletedCount = 0;
    let errorCount = 0;

    // Delete duplicate submissions
    for (const detail of duplicateDetails) {
      const idsToDelete = detail.deleteSubmissions.map(sub => sub._id);
      
      try {
        const result = await AuditSubmission.deleteMany({
          _id: { $in: idsToDelete }
        });
        deletedCount += result.deletedCount;
        console.log(`✅ Deleted ${result.deletedCount} duplicate(s) for UHID: ${detail.uhid}, IPID: ${detail.ipid}, Department: ${detail.department}`);
      } catch (err) {
        console.error(`❌ Error deleting duplicates for UHID: ${detail.uhid}, IPID: ${detail.ipid}:`, err.message);
        errorCount++;
      }
    }

    // Verify results
    const remainingDuplicates = await AuditSubmission.aggregate([
      {
        $group: {
          _id: {
            uhid: '$uhid',
            ipid: '$ipid',
            department: '$department'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log('\n🎉 Cleanup completed!');
    console.log(`\n📌 Results:`);
    console.log(`   - Duplicate submissions deleted: ${deletedCount}`);
    console.log(`   - Errors encountered: ${errorCount}`);
    console.log(`   - Remaining duplicates: ${remainingDuplicates.length}`);

    if (remainingDuplicates.length === 0) {
      console.log('\n✅ All duplicates have been successfully removed!\n');
    } else {
      console.log('\n⚠️  Some duplicates may still exist. Please review the database.\n');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error removing duplicates:', err);
    await mongoose.connection.close();
    process.exit(1);
  }
};

RUN();

