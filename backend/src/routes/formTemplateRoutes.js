const express = require('express');
const router = express.Router();
const FormTemplate = require('../models/FormTemplate');
const formTemplateController = require('../controllers/formTemplateController');
const auth = require('../middleware/auth');

// Admin: create form template (department required for analytics - form belongs to one department)
router.post('/', auth('SUPER_ADMIN'), async (req, res) => {
  try {
    const { name, description, departmentIds, isCommon, isActive, sections, formContext } = req.body;
    const deptIds = Array.isArray(departmentIds) ? departmentIds : [];
    if (deptIds.length === 0) {
      return res.status(400).json({
        message: 'Please select the department this form belongs to (required for analytics).',
      });
    }
    const ctx =
      formContext === 'CLINICAL' || formContext === 'NON_CLINICAL' ? formContext : 'NON_CLINICAL';
    const form = await FormTemplate.create({
      name,
      description,
      departments: deptIds,
      isCommon: !!isCommon,
      sections: sections || [],
      isActive: isActive !== undefined ? isActive : true,
      formContext: ctx,
    });
    res.status(201).json(form);
  } catch (err) {
    console.error('createFormTemplate error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: list/update/delete templates
router.get('/', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), async (_req, res) => {
  try {
    const forms = await FormTemplate.find().populate('departments');
    res.json(forms);
  } catch (err) {
    console.error('listFormTemplates error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get accessible forms for current user (must be before /:id)
router.get('/accessible/list', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), formTemplateController.getAccessibleForms);

router.get('/:id', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), async (req, res) => {
  try {
    const { id } = req.params;
    const form = await FormTemplate.findById(id).populate('departments');
    if (!form) {
      return res.status(404).json({ message: 'Form template not found' });
    }
    res.json(form);
  } catch (err) {
    console.error('getFormTemplate error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, departmentIds, isCommon, isActive, sections, formContext } = req.body;
    const deptIds = Array.isArray(departmentIds) ? departmentIds : [];
    if (deptIds.length === 0) {
      return res.status(400).json({
        message: 'Please select the department this form belongs to (required for analytics).',
      });
    }
    const ctx =
      formContext === 'CLINICAL' || formContext === 'NON_CLINICAL' ? formContext : 'NON_CLINICAL';
    const updateData = {
      name,
      description,
      departments: deptIds,
      isCommon: isCommon !== undefined ? isCommon : false,
      sections: sections || [],
      isActive: isActive !== undefined ? isActive : true,
      formContext: ctx,
    };
    
    console.log(`[DEBUG] Update data:`, JSON.stringify(updateData, null, 2));
    
    const form = await FormTemplate.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('departments');
    
    if (!form) return res.status(404).json({ message: 'Form template not found' });
    
    console.log(`[DEBUG] Updated form template:`, {
      id: form._id,
      name: form.name,
      departments: form.departments?.map(d => ({ id: d._id, name: d.name })) || []
    });
    
    res.json(form);
  } catch (err) {
    console.error('updateFormTemplate error', err);
    console.error('Error details:', {
      message: err.message,
      name: err.name,
      stack: err.stack,
      errors: err.errors,
      requestBody: req.body
    });
    
    const errorResponse = {
      message: 'Server error',
      error: err.message,
    };
    
    // Always include additional details for debugging
    errorResponse.stack = err.stack;
    if (err.errors) {
      errorResponse.validationErrors = err.errors;
    }
    errorResponse.requestBody = req.body;
    
    res.status(500).json(errorResponse);
  }
});

router.delete('/:id', auth('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await FormTemplate.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Form template not found' });
    res.status(200).json({ ok: true, id, isActive: false });
  } catch (err) {
    console.error('deleteFormTemplate error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign users to a form
router.put('/:id/assign-users', auth('SUPER_ADMIN'), formTemplateController.assignUsersToForm);

module.exports = router;


