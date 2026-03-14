const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    // single department or "ALL" (common item)
    departmentScope: {
      type: String,
      enum: ['SINGLE', 'ALL'],
      default: 'SINGLE',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: function () {
        return this.departmentScope === 'SINGLE';
      },
    },
    formTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FormTemplate',
      required: false,
    },
    // Section name within the form (e.g., "ADMISSION SLIP", "CONSENT", "OT")
    section: { type: String, trim: true },
    // Response type for the checklist item
    responseType: {
      type: String,
      enum: ['YES_NO', 'MULTI_SELECT', 'TEXT'],
      default: 'YES_NO',
    },
    // Options for DROPDOWN type (comma-separated or array)
    responseOptions: { type: String, trim: true }, // e.g., "Option1,Option2,Option3"
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    isMandatory: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChecklistItem', checklistItemSchema);


