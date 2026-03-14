const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, trim: true }, // e.g. "08:00" HH:mm
    endTime: { type: String, trim: true },   // e.g. "16:00" HH:mm
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shiftSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
