const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');

dotenv.config();

// Generate 10 dummy checklist items
const generateChecklistItems = (departmentName, departmentCode) => {
  return [
    { label: `${departmentName} - Patient identification verified`, isMandatory: true, order: 1 },
    { label: `${departmentName} - Initial assessment completed`, isMandatory: true, order: 2 },
    { label: `${departmentName} - Consent form obtained and signed`, isMandatory: true, order: 3 },
    { label: `${departmentName} - Medical history documented`, isMandatory: true, order: 4 },
    { label: `${departmentName} - Vital signs recorded`, isMandatory: true, order: 5 },
    { label: `${departmentName} - Pre-procedure checklist completed`, isMandatory: false, order: 6 },
    { label: `${departmentName} - Safety protocols followed`, isMandatory: true, order: 7 },
    { label: `${departmentName} - Documentation updated in case sheet`, isMandatory: true, order: 8 },
    { label: `${departmentName} - Post-procedure monitoring done`, isMandatory: false, order: 9 },
    { label: `${departmentName} - Discharge planning initiated`, isMandatory: false, order: 10 },
  ];
};

const RUN = async () => {
  try {
    console.log('🚀 Creating dummy forms and checklists for departments...\n');
    await connectDB();

    // Get all clinical departments (excluding ANAE and NUS)
    const departments = await Department.find({ 
      isActive: true,
      code: { $nin: ['ANAE', 'NUS'] }
    }).sort({ name: 1 });

    if (departments.length === 0) {
      console.log('❌ No departments found. Please run seed script first.');
      process.exit(1);
    }

    console.log(`✅ Found ${departments.length} departments\n`);

    let formsCreated = 0;
    let itemsCreated = 0;

    // Create form and checklists for each department
    for (const dept of departments) {
      console.log(`📋 Processing: ${dept.name} (${dept.code})`);

      // Check if form already exists
      let form = await FormTemplate.findOne({
        name: { $regex: dept.name, $options: 'i' },
        departments: dept._id,
        isCommon: false
      });

      if (!form) {
        // Create form template with sections
        const sections = [
          { name: 'ADMISSION', order: 0, description: 'Admission checklist items' },
          { name: 'ASSESSMENT', order: 1, description: 'Assessment checklist items' },
          { name: 'DOCUMENTATION', order: 2, description: 'Documentation checklist items' },
        ];

        form = await FormTemplate.create({
          name: `${dept.name} - Audit Checklist`,
          description: `Dummy audit checklist for ${dept.name} department`,
          departments: [dept._id],
          isCommon: false,
          sections,
          isActive: true,
        });
        console.log(`   ✅ Created form: ${form.name}`);
        formsCreated++;
      } else {
        console.log(`   ℹ️  Form already exists: ${form.name}`);
      }

      // Check existing checklist items
      const existingItems = await ChecklistItem.countDocuments({ 
        formTemplate: form._id,
        isActive: true
      });

      if (existingItems === 0) {
        // Generate 10 checklist items
        const itemsData = generateChecklistItems(dept.name, dept.code);
        
        // Create checklist items
        for (const itemData of itemsData) {
          await ChecklistItem.create({
            label: itemData.label,
            section: itemData.order <= 3 ? 'ADMISSION' : itemData.order <= 6 ? 'ASSESSMENT' : 'DOCUMENTATION',
            departmentScope: 'SINGLE',
            department: dept._id,
            formTemplate: form._id,
            responseType: 'YES_NO',
            isActive: true,
            order: itemData.order,
            isMandatory: itemData.isMandatory,
          });
        }
        
        console.log(`   ✅ Created 10 checklist items`);
        itemsCreated += 10;
      } else {
        console.log(`   ℹ️  ${existingItems} checklist items already exist`);
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 DUMMY FORMS & CHECKLISTS CREATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Departments processed: ${departments.length}`);
    console.log(`✅ New forms created: ${formsCreated}`);
    console.log(`✅ New checklist items created: ${itemsCreated}`);
    
    const totalForms = await FormTemplate.countDocuments({ isActive: true });
    const totalItems = await ChecklistItem.countDocuments({ isActive: true });
    console.log(`\n📋 Total forms in database: ${totalForms}`);
    console.log(`📝 Total checklist items in database: ${totalItems}`);
    console.log('\n🎉 Dummy forms and checklists created successfully!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

RUN();

