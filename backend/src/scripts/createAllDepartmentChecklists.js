const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');

dotenv.config();

// Comprehensive checklist items by section
const CHECKLIST_ITEMS_BY_SECTION = {
  'ADMISSION SLIP': [
    { label: 'Patient Name verified with ID proof', isMandatory: true, order: 1 },
    { label: 'UHID Number correct and verified', isMandatory: true, order: 2 },
    { label: 'Date of Admission recorded accurately', isMandatory: true, order: 3 },
    { label: 'Ward/Bed number assigned and documented', isMandatory: true, order: 4 },
    { label: 'Emergency contact information collected and verified', isMandatory: true, order: 5 },
    { label: 'Insurance details verified (if applicable)', isMandatory: false, order: 6 },
    { label: 'Admission slip signed by admitting doctor', isMandatory: true, order: 7 },
  ],
  'CONSENT': [
    { label: 'Informed consent obtained from patient/relative', isMandatory: true, order: 1 },
    { label: 'Consent form signed by patient/relative', isMandatory: true, order: 2 },
    { label: 'Witness present during consent process', isMandatory: true, order: 3 },
    { label: 'Procedure explained clearly to patient/relative', isMandatory: true, order: 4 },
    { label: 'Risks and benefits discussed in detail', isMandatory: true, order: 5 },
    { label: 'Alternative treatment options explained', isMandatory: false, order: 6 },
    { label: 'Consent form dated and time-stamped', isMandatory: true, order: 7 },
  ],
  'PRE-OPERATIVE': [
    { label: 'Pre-operative assessment completed by surgeon', isMandatory: true, order: 1 },
    { label: 'Anesthesia evaluation done and documented', isMandatory: true, order: 2 },
    { label: 'Laboratory reports reviewed and normal', isMandatory: true, order: 3 },
    { label: 'Surgical site marked by surgeon', isMandatory: true, order: 4 },
    { label: 'NPO status confirmed (Nil by mouth)', isMandatory: true, order: 5 },
    { label: 'Allergies documented and verified', isMandatory: true, order: 6 },
    { label: 'Pre-operative medications administered as ordered', isMandatory: true, order: 7 },
    { label: 'Blood grouping and cross-matching done (if required)', isMandatory: false, order: 8 },
    { label: 'ECG and Chest X-ray reviewed (if required)', isMandatory: false, order: 9 },
  ],
  'OT': [
    { label: 'Time out performed before procedure start', isMandatory: true, order: 1 },
    { label: 'Correct patient identified using two identifiers', isMandatory: true, order: 2 },
    { label: 'Correct procedure site confirmed and marked', isMandatory: true, order: 3 },
    { label: 'Correct procedure verified with consent form', isMandatory: true, order: 4 },
    { label: 'Equipment checked and functional', isMandatory: true, order: 5 },
    { label: 'Surgical team members identified', isMandatory: true, order: 6 },
    { label: 'Antibiotic prophylaxis given (if required)', isMandatory: false, order: 7 },
    { label: 'Positioning of patient verified', isMandatory: true, order: 8 },
  ],
  'POST-OPERATIVE': [
    { label: 'Post-operative instructions given to patient/relative', isMandatory: true, order: 1 },
    { label: 'Discharge summary prepared and signed', isMandatory: true, order: 2 },
    { label: 'Medications prescribed with dosage instructions', isMandatory: true, order: 3 },
    { label: 'Follow-up appointment scheduled', isMandatory: true, order: 4 },
    { label: 'Wound care instructions provided', isMandatory: true, order: 5 },
    { label: 'Dietary restrictions explained', isMandatory: false, order: 6 },
    { label: 'Activity restrictions explained', isMandatory: false, order: 7 },
  ],
  'REMARKS & OBSERVATION': [
    { label: 'General observations documented in case sheet', isMandatory: false, order: 1 },
    { label: 'Special instructions noted and communicated', isMandatory: false, order: 2 },
    { label: 'Follow-up requirements specified clearly', isMandatory: false, order: 3 },
    { label: 'Any deviations from standard protocol documented', isMandatory: false, order: 4 },
    { label: 'Patient condition at discharge documented', isMandatory: false, order: 5 },
  ],
};

const RUN = async () => {
  try {
    console.log('🚀 Creating checklists for all departments...\n');
    await connectDB();

    // Get all departments (excluding common ones ANAE and NUS)
    const departments = await Department.find({ 
      isActive: true,
      code: { $nin: ['ANAE', 'NUS'] }
    });

    if (departments.length === 0) {
      console.log('❌ No departments found. Please run seed script first.');
      process.exit(1);
    }

    console.log(`✅ Found ${departments.length} departments\n`);

    let formsCreated = 0;
    let formsUpdated = 0;
    let itemsCreated = 0;

    // Create forms for all departments
    for (const dept of departments) {
      console.log(`📋 Processing: ${dept.name} (${dept.code})`);

      // Check if form already exists
      let form = await FormTemplate.findOne({
        name: { $regex: dept.name, $options: 'i' },
        'departments': dept._id,
        isCommon: false
      });

      if (!form) {
        // Create form template
        const sections = Object.keys(CHECKLIST_ITEMS_BY_SECTION).map((sectionName, idx) => ({
          name: sectionName,
          order: idx,
          description: `${sectionName} section checklist items`,
        }));

        form = await FormTemplate.create({
          name: `${dept.name} - Case Sheet Audit Checklist`,
          description: `Comprehensive audit checklist for ${dept.name} department`,
          departments: [dept._id],
          isCommon: false,
          sections,
          isActive: true,
        });
        console.log(`   ✅ Created form: ${form.name}`);
        formsCreated++;
      } else {
        console.log(`   ℹ️  Form already exists: ${form.name}`);
        formsUpdated++;
      }

      // Check if checklist items exist
      const existingItems = await ChecklistItem.countDocuments({ 
        formTemplate: form._id,
        isActive: true
      });

      if (existingItems === 0) {
        // Create checklist items
        let itemOrder = 1;
        for (const [sectionName, items] of Object.entries(CHECKLIST_ITEMS_BY_SECTION)) {
          for (const itemData of items) {
            await ChecklistItem.create({
              label: itemData.label,
              section: sectionName,
              departmentScope: 'SINGLE',
              department: dept._id,
              formTemplate: form._id,
              responseType: 'YES_NO', // Default to YES_NO for existing checklist items
              isActive: true,
              order: itemOrder++,
              isMandatory: itemData.isMandatory,
            });
          }
        }
        const totalItems = Object.values(CHECKLIST_ITEMS_BY_SECTION).reduce((sum, items) => sum + items.length, 0);
        console.log(`   ✅ Created ${totalItems} checklist items`);
        itemsCreated += totalItems;
      } else {
        console.log(`   ℹ️  ${existingItems} checklist items already exist`);
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 CHECKLIST CREATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Departments processed: ${departments.length}`);
    console.log(`✅ New forms created: ${formsCreated}`);
    console.log(`✅ Existing forms found: ${formsUpdated}`);
    console.log(`✅ New checklist items created: ${itemsCreated}`);
    
    const totalForms = await FormTemplate.countDocuments({ isActive: true });
    const totalItems = await ChecklistItem.countDocuments({ isActive: true });
    console.log(`\n📋 Total forms in database: ${totalForms}`);
    console.log(`📝 Total checklist items in database: ${totalItems}`);
    console.log('\n🎉 All department checklists created successfully!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

RUN();

