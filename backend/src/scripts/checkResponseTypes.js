const dotenv = require('dotenv');
const connectDB = require('../config/db');
const ChecklistItem = require('../models/ChecklistItem');

dotenv.config();

const RUN = async () => {
  try {
    await connectDB();

    console.log('🔍 Checking checklist items response types...\n');

    // Get all items
    const allItems = await ChecklistItem.find({}).select('label responseType responseOptions');
    
    console.log(`Total items: ${allItems.length}\n`);
    
    // Check response types
    const typeCounts = {};
    const invalidItems = [];
    
    allItems.forEach(item => {
      const type = item.responseType || 'NO_TYPE';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      if (!['YES_NO', 'MULTI_SELECT', 'TEXT'].includes(type)) {
        invalidItems.push({
          id: item._id,
          label: item.label,
          responseType: type
        });
      }
    });
    
    console.log('📊 Response Type Distribution:');
    Object.keys(typeCounts).forEach(type => {
      console.log(`   ${type}: ${typeCounts[type]}`);
    });
    
    if (invalidItems.length > 0) {
      console.log(`\n❌ Found ${invalidItems.length} items with invalid responseType:`);
      invalidItems.forEach(item => {
        console.log(`   - ${item.label} (${item.responseType})`);
      });
    } else {
      console.log('\n✅ All items have valid response types');
    }
    
    // Test creating an item with TEXT type
    console.log('\n🧪 Testing TEXT responseType creation...');
    try {
      const testItem = new ChecklistItem({
        label: 'Test TEXT Item',
        responseType: 'TEXT',
        departmentScope: 'ALL',
        section: 'TEST'
      });
      await testItem.validate();
      console.log('✅ TEXT responseType is valid in schema');
    } catch (err) {
      console.error('❌ TEXT responseType validation failed:', err.message);
      if (err.errors) {
        Object.keys(err.errors).forEach(key => {
          console.error(`   ${key}: ${err.errors[key].message}`);
        });
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

RUN();

