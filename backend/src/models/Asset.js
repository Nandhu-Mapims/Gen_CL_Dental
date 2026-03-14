const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    assetType: { type: String, trim: true },
    assetCode: { type: String, trim: true },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

assetSchema.index({ assetCode: 1 }, { unique: true, sparse: true });
assetSchema.index({ locationId: 1, isActive: 1 });

module.exports = mongoose.model('Asset', assetSchema);
