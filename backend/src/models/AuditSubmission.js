const mongoose = require('mongoose');

const auditSubmissionSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    formTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FormTemplate',
      required: false,
    },
    // Operational context (reference IDs – preferred)
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Legacy/fallback: string values (for backward compatibility and migration)
    location: { type: String, trim: true },
    asset: { type: String, trim: true },
    shift: { type: String, trim: true },
    // Corrective/Preventive actions (reviewer)
    corrective: { type: String, trim: true, default: '' },
    preventive: { type: String, trim: true, default: '' },
    correctivePreventiveBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    correctivePreventiveAt: { type: Date },
    checklistItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChecklistItem',
      required: true,
    },
    yesNoNa: { type: String, enum: ['YES', 'NO'], required: false },
    responseValue: { type: String },
    remarks: { type: String },
    responsibility: { type: String },
    status: { type: String },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedAt: { type: Date, default: Date.now },
    auditDate: { type: Date, required: false, index: true },
    auditTime: { type: String, trim: true, required: false, index: true },
    isLocked: { type: Boolean, default: true },
  },
  { timestamps: true }
);

auditSubmissionSchema.index({ department: 1, submittedAt: -1 });
auditSubmissionSchema.index({ submittedAt: -1 });
auditSubmissionSchema.index({ department: 1, formTemplate: 1 });
auditSubmissionSchema.index({ locationId: 1, assetId: 1, shiftId: 1 });
auditSubmissionSchema.index({ department: 1, formTemplate: 1, submittedBy: 1, submittedAt: -1 });
auditSubmissionSchema.index({ assignedToUserId: 1 });

module.exports = mongoose.model('AuditSubmission', auditSubmissionSchema);
