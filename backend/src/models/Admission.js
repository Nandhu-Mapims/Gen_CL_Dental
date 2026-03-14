const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema(
  {
    ipid: {
      type: String,
      required: true,
      unique: true, // IPID must be globally unique
      trim: true,
      uppercase: true,
      index: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    uhid: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    admissionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dischargeDate: {
      type: Date,
      default: null, // null means still admitted
    },
    ward: {
      type: String,
      trim: true,
      required: true,
    },
    unitNo: {
      type: String,
      trim: true,
      required: true,
    },
    admissionType: {
      type: String,
      enum: ['Emergency', 'Elective', 'Day Care'],
      default: 'Elective',
    },
    status: {
      type: String,
      enum: ['Admitted', 'Discharged', 'Transferred', 'Absconded'],
      default: 'Admitted',
    },
    // Additional admission details
    admittingDoctor: {
      type: String,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    diagnosis: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
admissionSchema.index({ patient: 1, admissionDate: -1 });
admissionSchema.index({ uhid: 1, admissionDate: -1 });
admissionSchema.index({ status: 1, admissionDate: -1 });
admissionSchema.index({ ipid: 1, status: 1 });

module.exports = mongoose.model('Admission', admissionSchema);

