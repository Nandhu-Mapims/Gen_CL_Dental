const mongoose = require('mongoose');

// Department / Service (operations context)
const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ isActive: 1 });
departmentSchema.index({ parent: 1 });
module.exports = mongoose.model('Department', departmentSchema);


