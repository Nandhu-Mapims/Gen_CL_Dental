const mongoose = require('mongoose');

const chiefDoctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
      default: 'Unit Supervisor',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: false, // Optional - can be assigned to specific departments or all
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

chiefDoctorSchema.index({ name: 1, department: 1 });
chiefDoctorSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('ChiefDoctor', chiefDoctorSchema);
