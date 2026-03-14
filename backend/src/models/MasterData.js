const mongoose = require('mongoose');

const masterDataSchema = new mongoose.Schema(
  {
    // Single document identifier
    key: { type: String, required: true, unique: true, default: 'default' },
    designations: [{ type: String, trim: true }],
    wards: [{ type: String, trim: true }],
    units: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('MasterData', masterDataSchema);
