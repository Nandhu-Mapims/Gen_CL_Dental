const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Department = require('../models/Department');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');

dotenv.config();

// NABH Standards - Common forms (for ANAE and NUS)
const NABH_COMMON_FORMS = {
  'ANESTHESIOLOGY (ANAE) - Safety Checklist': {
    description: 'NABH compliant anesthesia safety checklist for all departments',
    sections: [
      'PRE-ANESTHESIA ASSESSMENT',
      'ANESTHESIA ADMINISTRATION',
      'POST-ANESTHESIA',
      'DOCUMENTATION & QUALITY'
    ],
    items: {
      'PRE-ANESTHESIA ASSESSMENT': [
        { label: 'Correct patient identified before anesthesia', isMandatory: true, order: 1 },
        { label: 'Correct medications verified and checked', isMandatory: true, order: 2 },
        { label: 'Monitoring equipment functional and calibrated', isMandatory: true, order: 3 },
        { label: 'Vital signs monitored continuously', isMandatory: true, order: 4 },
        { label: 'Anesthesia record maintained throughout procedure', isMandatory: true, order: 5 },
      ],
      'ANESTHESIA ADMINISTRATION': [
        { label: 'Anesthesia machine safety check completed', isMandatory: true, order: 1 },
        { label: 'Emergency drugs and equipment available', isMandatory: true, order: 2 },
        { label: 'Airway management equipment checked', isMandatory: true, order: 3 },
        { label: 'Patient positioning verified', isMandatory: true, order: 4 },
        { label: 'Allergies and contraindications reviewed', isMandatory: true, order: 5 },
      ],
      'POST-ANESTHESIA': [
        { label: 'Patient stable before transfer to recovery', isMandatory: true, order: 1 },
        { label: 'Post-anesthesia instructions given', isMandatory: true, order: 2 },
        { label: 'Recovery room monitoring documented', isMandatory: true, order: 3 },
        { label: 'Discharge criteria met before transfer', isMandatory: true, order: 4 },
      ],
      'DOCUMENTATION & QUALITY': [
        { label: 'Anesthesia record complete and signed', isMandatory: true, order: 1 },
        { label: 'Incident reporting done (if applicable)', isMandatory: false, order: 2 },
        { label: 'Quality indicators documented', isMandatory: true, order: 3 },
      ],
    }
  },
  'NURSING SERVICES (NUS) - Care Checklist': {
    description: 'NABH compliant nursing care checklist for all departments',
    sections: [
      'ADMISSION & ASSESSMENT',
      'CARE PLANNING',
      'MEDICATION ADMINISTRATION',
      'PATIENT SAFETY',
      'DISCHARGE PLANNING'
    ],
    items: {
      'ADMISSION & ASSESSMENT': [
        { label: 'Initial nursing assessment completed within 2 hours', isMandatory: true, order: 1 },
        { label: 'Vital signs recorded and documented', isMandatory: true, order: 2 },
        { label: 'Risk assessment for falls completed', isMandatory: true, order: 3 },
        { label: 'Pressure ulcer risk assessment done', isMandatory: true, order: 4 },
        { label: 'Allergies documented and communicated', isMandatory: true, order: 5 },
      ],
      'CARE PLANNING': [
        { label: 'Nursing care plan updated within 24 hours', isMandatory: true, order: 1 },
        { label: 'Patient care goals identified and documented', isMandatory: true, order: 2 },
        { label: 'Interventions planned and implemented', isMandatory: true, order: 3 },
        { label: 'Care plan reviewed and updated daily', isMandatory: true, order: 4 },
      ],
      'MEDICATION ADMINISTRATION': [
        { label: 'Right patient, right drug, right dose verified', isMandatory: true, order: 1 },
        { label: 'Right route and right time confirmed', isMandatory: true, order: 2 },
        { label: 'Medication administration documented', isMandatory: true, order: 3 },
        { label: 'Adverse drug reactions monitored and reported', isMandatory: true, order: 4 },
      ],
      'PATIENT SAFETY': [
        { label: 'Patient identification verified using two identifiers', isMandatory: true, order: 1 },
        { label: 'Hand hygiene compliance maintained', isMandatory: true, order: 2 },
        { label: 'Infection control protocols followed', isMandatory: true, order: 3 },
        { label: 'Restraint use documented (if applicable)', isMandatory: false, order: 4 },
      ],
      'DISCHARGE PLANNING': [
        { label: 'Discharge planning initiated on admission', isMandatory: true, order: 1 },
        { label: 'Patient and family education provided', isMandatory: true, order: 2 },
        { label: 'Discharge summary prepared and reviewed', isMandatory: true, order: 3 },
        { label: 'Follow-up instructions given', isMandatory: true, order: 4 },
      ],
    }
  }
};

// NABH Quality Standards - Department-specific forms
const NABH_DEPARTMENT_STANDARDS = {
  'ACCESS, ASSESSMENT & CONTINUITY OF CARE': {
    description: 'NABH Standard: Access, Assessment and Continuity of Care (AAC)',
    sections: [
      'PATIENT ACCESS',
      'INITIAL ASSESSMENT',
      'CONTINUITY OF CARE',
      'DISCHARGE PROCESS'
    ],
    items: {
      'PATIENT ACCESS': [
        { label: 'Patient registration process completed accurately', isMandatory: true, order: 1 },
        { label: 'UHID generated and verified', isMandatory: true, order: 2 },
        { label: 'Patient demographics collected and documented', isMandatory: true, order: 3 },
        { label: 'Insurance/TPA details verified (if applicable)', isMandatory: false, order: 4 },
        { label: 'Emergency access protocol followed (if applicable)', isMandatory: true, order: 5 },
      ],
      'INITIAL ASSESSMENT': [
        { label: 'Initial assessment completed within 2 hours of admission', isMandatory: true, order: 1 },
        { label: 'Chief complaint documented', isMandatory: true, order: 2 },
        { label: 'History of present illness recorded', isMandatory: true, order: 3 },
        { label: 'Past medical history documented', isMandatory: true, order: 4 },
        { label: 'Physical examination findings recorded', isMandatory: true, order: 5 },
        { label: 'Vital signs documented', isMandatory: true, order: 6 },
      ],
      'CONTINUITY OF CARE': [
        { label: 'Care plan developed and documented', isMandatory: true, order: 1 },
        { label: 'Interdisciplinary team involved in care planning', isMandatory: true, order: 2 },
        { label: 'Care plan reviewed and updated regularly', isMandatory: true, order: 3 },
        { label: 'Handover communication documented', isMandatory: true, order: 4 },
      ],
      'DISCHARGE PROCESS': [
        { label: 'Discharge summary prepared within 24 hours', isMandatory: true, order: 1 },
        { label: 'Discharge instructions provided to patient/family', isMandatory: true, order: 2 },
        { label: 'Follow-up appointment scheduled', isMandatory: true, order: 3 },
        { label: 'Medication reconciliation completed', isMandatory: true, order: 4 },
      ],
    }
  },
  'CARE OF PATIENTS': {
    description: 'NABH Standard: Care of Patients (COP)',
    sections: [
      'CLINICAL CARE',
      'SURGICAL SAFETY',
      'PAIN MANAGEMENT',
      'END OF LIFE CARE'
    ],
    items: {
      'CLINICAL CARE': [
        { label: 'Clinical protocols and guidelines followed', isMandatory: true, order: 1 },
        { label: 'Diagnostic tests ordered as per clinical indication', isMandatory: true, order: 2 },
        { label: 'Test results reviewed and acted upon', isMandatory: true, order: 3 },
        { label: 'Treatment plan documented and implemented', isMandatory: true, order: 4 },
      ],
      'SURGICAL SAFETY': [
        { label: 'Surgical safety checklist completed', isMandatory: true, order: 1 },
        { label: 'Surgical site marking verified', isMandatory: true, order: 2 },
        { label: 'Time-out procedure performed', isMandatory: true, order: 3 },
        { label: 'Surgical count verified (if applicable)', isMandatory: true, order: 4 },
      ],
      'PAIN MANAGEMENT': [
        { label: 'Pain assessment completed and documented', isMandatory: true, order: 1 },
        { label: 'Pain management plan implemented', isMandatory: true, order: 2 },
        { label: 'Pain reassessment done post-intervention', isMandatory: true, order: 3 },
      ],
      'END OF LIFE CARE': [
        { label: 'End of life care preferences documented (if applicable)', isMandatory: false, order: 1 },
        { label: 'Family communication maintained', isMandatory: true, order: 2 },
        { label: 'Dignity and comfort maintained', isMandatory: true, order: 3 },
      ],
    }
  },
  'MANAGEMENT OF MEDICATION': {
    description: 'NABH Standard: Management of Medication (MOM)',
    sections: [
      'MEDICATION PRESCRIBING',
      'MEDICATION STORAGE',
      'MEDICATION ADMINISTRATION',
      'MEDICATION MONITORING'
    ],
    items: {
      'MEDICATION PRESCRIBING': [
        { label: 'Medication prescribed with clear instructions', isMandatory: true, order: 1 },
        { label: 'Drug allergies checked before prescribing', isMandatory: true, order: 2 },
        { label: 'Drug interactions reviewed', isMandatory: true, order: 3 },
        { label: 'High-risk medications identified and monitored', isMandatory: true, order: 4 },
      ],
      'MEDICATION STORAGE': [
        { label: 'Medications stored as per manufacturer guidelines', isMandatory: true, order: 1 },
        { label: 'Expired medications removed from inventory', isMandatory: true, order: 2 },
        { label: 'Controlled substances secured and documented', isMandatory: true, order: 3 },
        { label: 'Temperature monitoring maintained (if required)', isMandatory: true, order: 4 },
      ],
      'MEDICATION ADMINISTRATION': [
        { label: 'Five rights of medication verified', isMandatory: true, order: 1 },
        { label: 'Medication administration documented', isMandatory: true, order: 2 },
        { label: 'Missed doses documented and reported', isMandatory: true, order: 3 },
        { label: 'Medication errors reported and analyzed', isMandatory: true, order: 4 },
      ],
      'MEDICATION MONITORING': [
        { label: 'Therapeutic drug monitoring done (if required)', isMandatory: false, order: 1 },
        { label: 'Adverse drug reactions monitored', isMandatory: true, order: 2 },
        { label: 'Medication effectiveness assessed', isMandatory: true, order: 3 },
      ],
    }
  },
  'PATIENT RIGHTS & EDUCATION': {
    description: 'NABH Standard: Patient Rights and Education (PRE)',
    sections: [
      'PATIENT RIGHTS',
      'INFORMED CONSENT',
      'PATIENT EDUCATION',
      'PRIVACY & CONFIDENTIALITY'
    ],
    items: {
      'PATIENT RIGHTS': [
        { label: 'Patient rights displayed and explained', isMandatory: true, order: 1 },
        { label: 'Patient complaint mechanism available', isMandatory: true, order: 2 },
        { label: 'Grievance redressal process followed', isMandatory: true, order: 3 },
        { label: 'Patient dignity and respect maintained', isMandatory: true, order: 4 },
      ],
      'INFORMED CONSENT': [
        { label: 'Informed consent obtained before procedures', isMandatory: true, order: 1 },
        { label: 'Procedure explained in understandable language', isMandatory: true, order: 2 },
        { label: 'Risks and benefits discussed', isMandatory: true, order: 3 },
        { label: 'Consent form signed and witnessed', isMandatory: true, order: 4 },
      ],
      'PATIENT EDUCATION': [
        { label: 'Patient education provided as per need', isMandatory: true, order: 1 },
        { label: 'Educational materials provided', isMandatory: true, order: 2 },
        { label: 'Patient understanding assessed', isMandatory: true, order: 3 },
        { label: 'Family education provided (if applicable)', isMandatory: true, order: 4 },
      ],
      'PRIVACY & CONFIDENTIALITY': [
        { label: 'Patient privacy maintained during care', isMandatory: true, order: 1 },
        { label: 'Medical records kept confidential', isMandatory: true, order: 2 },
        { label: 'Information sharing done with consent', isMandatory: true, order: 3 },
      ],
    }
  },
  'HOSPITAL INFECTION CONTROL': {
    description: 'NABH Standard: Hospital Infection Control (HIC)',
    sections: [
      'INFECTION PREVENTION',
      'HAND HYGIENE',
      'ISOLATION PRECAUTIONS',
      'SURVEILLANCE & MONITORING'
    ],
    items: {
      'INFECTION PREVENTION': [
        { label: 'Infection control policies and procedures followed', isMandatory: true, order: 1 },
        { label: 'Standard precautions implemented', isMandatory: true, order: 2 },
        { label: 'Personal protective equipment used appropriately', isMandatory: true, order: 3 },
        { label: 'Environmental cleaning and disinfection done', isMandatory: true, order: 4 },
      ],
      'HAND HYGIENE': [
        { label: 'Hand hygiene performed before patient contact', isMandatory: true, order: 1 },
        { label: 'Hand hygiene performed after patient contact', isMandatory: true, order: 2 },
        { label: 'Hand hygiene performed before aseptic procedures', isMandatory: true, order: 3 },
        { label: 'Hand hygiene compliance monitored', isMandatory: true, order: 4 },
      ],
      'ISOLATION PRECAUTIONS': [
        { label: 'Isolation precautions implemented when indicated', isMandatory: true, order: 1 },
        { label: 'Isolation signage displayed appropriately', isMandatory: true, order: 2 },
        { label: 'Isolation protocol followed by all staff', isMandatory: true, order: 3 },
      ],
      'SURVEILLANCE & MONITORING': [
        { label: 'Healthcare-associated infections monitored', isMandatory: true, order: 1 },
        { label: 'Infection surveillance data collected', isMandatory: true, order: 2 },
        { label: 'Outbreak investigation protocol followed (if applicable)', isMandatory: false, order: 3 },
      ],
    }
  },
  'CONTINUOUS QUALITY IMPROVEMENT': {
    description: 'NABH Standard: Continuous Quality Improvement (CQI)',
    sections: [
      'QUALITY INDICATORS',
      'QUALITY MONITORING',
      'QUALITY IMPROVEMENT',
      'RISK MANAGEMENT'
    ],
    items: {
      'QUALITY INDICATORS': [
        { label: 'Quality indicators identified and measured', isMandatory: true, order: 1 },
        { label: 'Quality data collected systematically', isMandatory: true, order: 2 },
        { label: 'Benchmarking done with standards', isMandatory: true, order: 3 },
        { label: 'Quality goals set and monitored', isMandatory: true, order: 4 },
      ],
      'QUALITY MONITORING': [
        { label: 'Quality monitoring activities conducted', isMandatory: true, order: 1 },
        { label: 'Quality reports generated and reviewed', isMandatory: true, order: 2 },
        { label: 'Quality committee meetings held regularly', isMandatory: true, order: 3 },
      ],
      'QUALITY IMPROVEMENT': [
        { label: 'Quality improvement initiatives implemented', isMandatory: true, order: 1 },
        { label: 'Root cause analysis done for adverse events', isMandatory: true, order: 2 },
        { label: 'Corrective actions taken and monitored', isMandatory: true, order: 3 },
      ],
      'RISK MANAGEMENT': [
        { label: 'Risk assessment conducted regularly', isMandatory: true, order: 1 },
        { label: 'Risk mitigation strategies implemented', isMandatory: true, order: 2 },
        { label: 'Incident reporting system functional', isMandatory: true, order: 3 },
      ],
    }
  }
};

const RUN = async () => {
  try {
    console.log('🚀 Seeding NABH and Quality Standards data...\n');
    await connectDB();

    // Get departments
    const departments = await Department.find({ isActive: true });
    const anaDept = departments.find(d => d.code === 'ANAE');
    const nusDept = departments.find(d => d.code === 'NUS');
    const clinicalDepts = departments.filter(d => d.code !== 'ANAE' && d.code !== 'NUS');

    if (departments.length === 0) {
      console.log('❌ No departments found. Please run seed script first.');
      process.exit(1);
    }

    console.log(`✅ Found ${departments.length} departments\n`);

    let formsCreated = 0;
    let itemsCreated = 0;

    // Create common forms (ANAE and NUS)
    console.log('📋 Creating Common Forms (ANAE & NUS)...\n');
    
    for (const [formName, formData] of Object.entries(NABH_COMMON_FORMS)) {
      let targetDept = null;
      if (formName.includes('ANAE') && anaDept) {
        targetDept = anaDept;
      } else if (formName.includes('NUS') && nusDept) {
        targetDept = nusDept;
      }

      if (!targetDept) {
        console.log(`⚠️  Department not found for ${formName}, skipping...`);
        continue;
      }

      // Check if form exists
      let form = await FormTemplate.findOne({
        name: formName,
        departments: targetDept._id,
      });

      if (!form) {
        const sections = formData.sections.map((sectionName, idx) => ({
          name: sectionName,
          order: idx,
          description: `${sectionName} section for ${formName}`,
        }));

        form = await FormTemplate.create({
          name: formName,
          description: formData.description,
          departments: [targetDept._id],
          isCommon: false, // Not common, but assigned to ANAE/NUS
          sections,
          isActive: true,
        });
        console.log(`   ✅ Created form: ${formName}`);
        formsCreated++;
      } else {
        console.log(`   ℹ️  Form already exists: ${formName}`);
      }

      // Create checklist items
      const existingItems = await ChecklistItem.countDocuments({
        formTemplate: form._id,
        isActive: true,
      });

      if (existingItems === 0) {
        let itemOrder = 1;
        for (const [sectionName, items] of Object.entries(formData.items)) {
          for (const itemData of items) {
            await ChecklistItem.create({
              label: itemData.label,
              section: sectionName,
              departmentScope: 'SINGLE',
              department: targetDept._id,
              formTemplate: form._id,
              responseType: 'YES_NO',
              isActive: true,
              order: itemOrder++,
              isMandatory: itemData.isMandatory,
            });
          }
        }
        const totalItems = Object.values(formData.items).reduce((sum, items) => sum + items.length, 0);
        console.log(`   ✅ Created ${totalItems} checklist items`);
        itemsCreated += totalItems;
      } else {
        console.log(`   ℹ️  ${existingItems} checklist items already exist`);
      }
      console.log('');
    }

    // Create department-specific NABH standards forms
    console.log('📋 Creating Department-Specific NABH Standards Forms...\n');

    for (const dept of clinicalDepts) {
      console.log(`📋 Processing: ${dept.name} (${dept.code})`);

      for (const [standardName, standardData] of Object.entries(NABH_DEPARTMENT_STANDARDS)) {
        const formName = `${dept.name} - ${standardName}`;

        // Check if form exists
        let form = await FormTemplate.findOne({
          name: formName,
          departments: dept._id,
        });

        if (!form) {
          const sections = standardData.sections.map((sectionName, idx) => ({
            name: sectionName,
            order: idx,
            description: `${sectionName} section for ${standardName}`,
          }));

          form = await FormTemplate.create({
            name: formName,
            description: standardData.description,
            departments: [dept._id],
            isCommon: false,
            sections,
            isActive: true,
          });
          console.log(`   ✅ Created form: ${formName}`);
          formsCreated++;
        } else {
          console.log(`   ℹ️  Form already exists: ${formName}`);
        }

        // Create checklist items
        const existingItems = await ChecklistItem.countDocuments({
          formTemplate: form._id,
          isActive: true,
        });

        if (existingItems === 0) {
          let itemOrder = 1;
          for (const [sectionName, items] of Object.entries(standardData.items)) {
            for (const itemData of items) {
              await ChecklistItem.create({
                label: itemData.label,
                section: sectionName,
                departmentScope: 'SINGLE',
                department: dept._id,
                formTemplate: form._id,
                responseType: 'YES_NO',
                isActive: true,
                order: itemOrder++,
                isMandatory: itemData.isMandatory,
              });
            }
          }
          const totalItems = Object.values(standardData.items).reduce((sum, items) => sum + items.length, 0);
          console.log(`   ✅ Created ${totalItems} checklist items for ${standardName}`);
          itemsCreated += totalItems;
        } else {
          console.log(`   ℹ️  ${existingItems} checklist items already exist for ${standardName}`);
        }
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 NABH & QUALITY STANDARDS SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Common forms created: ${Object.keys(NABH_COMMON_FORMS).length}`);
    console.log(`✅ Department-specific forms created: ${formsCreated - Object.keys(NABH_COMMON_FORMS).length}`);
    console.log(`✅ Total forms created: ${formsCreated}`);
    console.log(`✅ Total checklist items created: ${itemsCreated}`);

    const totalForms = await FormTemplate.countDocuments({ isActive: true });
    const totalItems = await ChecklistItem.countDocuments({ isActive: true });
    console.log(`\n📋 Total forms in database: ${totalForms}`);
    console.log(`📝 Total checklist items in database: ${totalItems}`);
    console.log('\n🎉 NABH and Quality Standards data seeded successfully!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.error(err.stack);
    process.exit(1);
  }
};

RUN();

