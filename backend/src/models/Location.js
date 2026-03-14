const mongoose = require('mongoose');

const LOCATION_TYPES = ['ZONE', 'FLOOR', 'WARD', 'ROOM', 'UNIT', 'OTHER'];

const locationSchema = new mongoose.Schema(
  {
    areaName: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    // Type of location for quality audit context
    locationType: {
      type: String,
      enum: LOCATION_TYPES,
      default: 'OTHER',
    },
    // Parent location (e.g. a FLOOR under a ZONE). Enables zone → multiple floors hierarchy.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    // Zone label (e.g. "Zone A", "Zone B") — used when locationType is ZONE
    zone: { type: String, trim: true },
    // Floor label (e.g. "Ground Floor", "1st Floor") — used when locationType is FLOOR
    floor: { type: String, trim: true },
    // Building or block (e.g. "Block A", "Main Building")
    building: { type: String, trim: true },
    // Additional description
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

locationSchema.index({ code: 1 }, { unique: true, sparse: true });
locationSchema.index({ isActive: 1, areaName: 1 });
locationSchema.index({ locationType: 1, isActive: 1 });
locationSchema.index({ parent: 1 });

module.exports = mongoose.model('Location', locationSchema);
module.exports.LOCATION_TYPES = LOCATION_TYPES;
