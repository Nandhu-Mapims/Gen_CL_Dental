const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');

dotenv.config();

const CS_FORM_STRUCTURE = {
  name: 'MAPIMS - Case Sheet Audit Checklist',
  description: 'Comprehensive case sheet audit checklist for Cardiac Surgery department',
  sections: [
    { name: 'ADMISSION SLIP', order: 1, description: 'Admission documentation requirements' },
    { name: 'INITIAL ASSESSMENT AND CONSENT FORM', order: 2, description: 'Initial assessment and consent documentation' },
    { name: 'CONSENT', order: 3, description: 'Consent form requirements' },
    { name: 'OT', order: 4, description: 'Operating Theatre documentation' },
    { name: 'SURGICAL CONSENT', order: 5, description: 'Surgical consent requirements' },
    { name: 'INVESTIGATIONS', order: 6, description: 'Investigation completion status' },
    { name: 'DRUG CHART', order: 7, description: 'Drug chart documentation' },
  ],
  items: [
    // ADMISSION SLIP
    { section: 'ADMISSION SLIP', label: 'PATIENT NAME', order: 1, isMandatory: true },
    { section: 'ADMISSION SLIP', label: 'DATE OF ADMISSION AND TIME', order: 2, isMandatory: true },
    { section: 'ADMISSION SLIP', label: 'PROVISIONAL DIAGNOSIS', order: 3, isMandatory: true },
    { section: 'ADMISSION SLIP', label: 'ADMITTED IN WARD', order: 4, isMandatory: true },
    { section: 'ADMISSION SLIP', label: 'NAME AND SIGNATURE OF DOCTOR', order: 5, isMandatory: true },

    // INITIAL ASSESSMENT AND CONSENT FORM
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'SOCIOECONOMIC HISTORY', order: 1, isMandatory: false },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'CARDINAL SYSTEMIC EXAMINATION', order: 2, isMandatory: true },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'OTHER SYSTEMIC EXAMINATION', order: 3, isMandatory: false },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'PROVISIONAL DIAGNOSIS', order: 4, isMandatory: true },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'PROPOSED CARE PLAN', order: 5, isMandatory: true },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'TREATMENT TO BE GIVEN', order: 6, isMandatory: true },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'SIGNATURE OF DOCTOR', order: 7, isMandatory: true },
    { section: 'INITIAL ASSESSMENT AND CONSENT FORM', label: 'SIGNATURE OF DOCTOR IN GENERAL ADMISSION', order: 8, isMandatory: true },

    // CONSENT
    { section: 'CONSENT', label: 'YELLOW AND WHITE FORM', order: 1, isMandatory: true },
    { section: 'CONSENT', label: 'SIGN AND SEAL IN YELLOW', order: 2, isMandatory: true },
    { section: 'CONSENT', label: 'SIGN AND SEAL IN WHITE', order: 3, isMandatory: true },

    // OT (Operating Theatre)
    { section: 'OT', label: 'SURGICAL SAFETY CHECKLIST', order: 1, isMandatory: true },
    { section: 'OT', label: 'PROCEDURE / SURGERY', order: 2, isMandatory: true },
    { section: 'OT', label: 'PRIMARY SURGEON', order: 3, isMandatory: true },
    { section: 'OT', label: 'PRE-OP DIAGNOSIS', order: 4, isMandatory: true },
    { section: 'OT', label: 'PROCEDURE', order: 5, isMandatory: true },
    { section: 'OT', label: 'PRIMARY SURGEON NAME AND SIGNATURE', order: 6, isMandatory: true },

    // SURGICAL CONSENT
    { section: 'SURGICAL CONSENT', label: 'NAME', order: 1, isMandatory: true },
    { section: 'SURGICAL CONSENT', label: 'UHID NUMBER', order: 2, isMandatory: true },
    { section: 'SURGICAL CONSENT', label: 'CONSULTANT NAME', order: 3, isMandatory: true },
    { section: 'SURGICAL CONSENT', label: 'BRIEF DETAILS ABOUT SURGERY', order: 4, isMandatory: true },
    { section: 'SURGICAL CONSENT', label: 'RISKS AND POTENTIAL BENEFITS OF SURGERY EXPLAINED', order: 5, isMandatory: true },
    { section: 'SURGICAL CONSENT', label: 'PATIENT SIGNATURE', order: 6, isMandatory: true },
    { section: 'SURGICAL CONSENT', label: "DOCTOR'S SIGNATURE", order: 7, isMandatory: true },

    // INVESTIGATIONS
    { section: 'INVESTIGATIONS', label: 'COMPLETED', order: 1, isMandatory: true },

    // DRUG CHART
    { section: 'DRUG CHART', label: 'COMPLETED', order: 1, isMandatory: true },
  ],
};

const RUN = async () => {
  try {
    await connectDB();

    // Find CS department
    const csDept = await Department.findOne({ code: 'CS' });
    if (!csDept) {
      console.error('❌ CS (Cardiac Surgery) department not found. Please run main seed script first.');
      process.exit(1);
    }

    console.log(`✅ Found CS department: ${csDept.name}`);

    // Check if form already exists
    let formTemplate = await FormTemplate.findOne({ name: CS_FORM_STRUCTURE.name });
    
    if (formTemplate) {
      console.log(`ℹ️  Form template already exists. Updating...`);
      // Update existing form
      formTemplate.sections = CS_FORM_STRUCTURE.sections;
      formTemplate.departments = [csDept._id];
      formTemplate.isCommon = false;
      await formTemplate.save();
      console.log(`✅ Updated form template: ${formTemplate.name}`);
    } else {
      // Create new form template
      formTemplate = await FormTemplate.create({
        name: CS_FORM_STRUCTURE.name,
        description: CS_FORM_STRUCTURE.description,
        departments: [csDept._id],
        sections: CS_FORM_STRUCTURE.sections,
        isCommon: false,
        isActive: true,
      });
      console.log(`✅ Created form template: ${formTemplate.name}`);
    }

    // Delete existing checklist items for this form (to avoid duplicates)
    await ChecklistItem.deleteMany({ formTemplate: formTemplate._id });
    console.log(`✅ Cleared existing checklist items for this form`);

    // Create checklist items
    const createdItems = [];
    for (const itemData of CS_FORM_STRUCTURE.items) {
      const item = await ChecklistItem.create({
        label: itemData.label,
        section: itemData.section,
        departmentScope: 'SINGLE',
        department: csDept._id,
        formTemplate: formTemplate._id,
        isActive: true,
        order: itemData.order,
        isMandatory: itemData.isMandatory,
      });
      createdItems.push(item);
    }

    console.log(`✅ Created ${createdItems.length} checklist items`);
    console.log(`\n📋 Form Structure:`);
    console.log(`   Form Name: ${formTemplate.name}`);
    console.log(`   Department: ${csDept.name} (${csDept.code})`);
    console.log(`   Sections: ${CS_FORM_STRUCTURE.sections.length}`);
    console.log(`   Total Items: ${createdItems.length}`);
    console.log(`\n📝 Sections Created:`);
    CS_FORM_STRUCTURE.sections.forEach((section) => {
      const sectionItems = CS_FORM_STRUCTURE.items.filter((i) => i.section === section.name);
      console.log(`   - ${section.name} (${sectionItems.length} items)`);
    });

    console.log('\n🎉 CS Department form seeded successfully!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Login as admin');
    console.log('   2. Go to /admin/checklists');
    console.log('   3. Select the form to view/edit items');
    console.log('   4. CS department users will see this form when they login');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

RUN();

