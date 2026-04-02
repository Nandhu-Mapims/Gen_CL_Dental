const mongoose = require('mongoose');

const formTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    departments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    // Flag to indicate this form is common (e.g. ANAE, NUS) for all departments
    isCommon: { type: Boolean, default: false },
    // Assigned users (doctors) who can access this form
    // If empty, all users in the department can access
    assignedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Sections within the form (e.g., "ADMISSION SLIP", "CONSENT", "OT", etc.)
    sections: [
      {
        name: { type: String, required: true, trim: true },
        order: { type: Number, default: 0 },
        description: { type: String },
      },
    ],
    isActive: { type: Boolean, default: true },
    // NON_CLINICAL: operational checklist (location, questions). CLINICAL: patient-linked audit (UHID, name).
    formContext: {
      type: String,
      enum: ['NON_CLINICAL', 'CLINICAL'],
      default: 'NON_CLINICAL',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FormTemplate', formTemplateSchema);


