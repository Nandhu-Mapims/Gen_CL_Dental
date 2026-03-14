const mongoose = require('mongoose');

const ROLES = ['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'STAFF', required: true },
    designation: { type: String, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: function () {
        return ['STAFF', 'SUPERVISOR', 'DEPT_ADMIN'].includes(this.role);
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
