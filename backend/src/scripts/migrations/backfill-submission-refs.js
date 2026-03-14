/**
 * Optional migration: create Location, Asset, Shift documents from distinct
 * AuditSubmission string values (location, asset, shift) and set
 * locationId, assetId, shiftId on submissions. Keeps legacy string fields.
 *
 * Usage (from backend root):
 *   node src/scripts/migrations/backfill-submission-refs.js
 *
 * Requires: MONGODB_URI in env; Location, Asset, Shift models exist.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/mrd-audit';
  await mongoose.connect(uri);

  const AuditSubmission = require(path.join(__dirname, '../../models/AuditSubmission'));
  const Location = require(path.join(__dirname, '../../models/Location'));
  const Asset = require(path.join(__dirname, '../../models/Asset'));
  const Shift = require(path.join(__dirname, '../../models/Shift'));

  console.log('Backfill: creating Location/Asset/Shift from submission strings and linking submissions...\n');

  const submissions = await AuditSubmission.find({
    $or: [
      { location: { $exists: true, $ne: '', $nin: [null] } },
      { asset: { $exists: true, $ne: '', $nin: [null] } },
      { shift: { $exists: true, $ne: '', $nin: [null] } },
    ],
  }).lean();

  const locationByStr = new Map();
  const assetByStr = new Map();
  const shiftByStr = new Map();

  for (const s of submissions) {
    const locStr = (s.location && String(s.location).trim()) || null;
    const astStr = (s.asset && String(s.asset).trim()) || null;
    const shfStr = (s.shift && String(s.shift).trim()) || null;
    if (locStr && !locationByStr.has(locStr)) locationByStr.set(locStr, null);
    if (astStr && !assetByStr.has(astStr)) assetByStr.set(astStr, null);
    if (shfStr && !shiftByStr.has(shfStr)) shiftByStr.set(shfStr, null);
  }

  for (const [name, _] of locationByStr) {
    const loc = await Location.findOneAndUpdate(
      { areaName: name },
      { $setOnInsert: { areaName: name, code: name.replace(/\s+/g, '_').toUpperCase().slice(0, 32), isActive: true } },
      { upsert: true, new: true }
    );
    locationByStr.set(name, loc._id);
  }
  for (const [name, _] of assetByStr) {
    const ast = await Asset.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, assetCode: name.replace(/\s+/g, '_').toUpperCase().slice(0, 32), isActive: true } },
      { upsert: true, new: true }
    );
    assetByStr.set(name, ast._id);
  }
  for (const [name, _] of shiftByStr) {
    const shf = await Shift.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, isActive: true } },
      { upsert: true, new: true }
    );
    shiftByStr.set(name, shf._id);
  }

  let updated = 0;
  for (const s of submissions) {
    const locStr = (s.location && String(s.location).trim()) || null;
    const astStr = (s.asset && String(s.asset).trim()) || null;
    const shfStr = (s.shift && String(s.shift).trim()) || null;
    const locationId = locStr ? locationByStr.get(locStr) : null;
    const assetId = astStr ? assetByStr.get(astStr) : null;
    const shiftId = shfStr ? shiftByStr.get(shfStr) : null;
    if (locationId || assetId || shiftId) {
      await AuditSubmission.updateOne(
        { _id: s._id },
        { $set: { locationId: locationId || null, assetId: assetId || null, shiftId: shiftId || null } }
      );
      updated++;
    }
  }

  console.log(`Locations created/used: ${locationByStr.size}`);
  console.log(`Assets created/used: ${assetByStr.size}`);
  console.log(`Shifts created/used: ${shiftByStr.size}`);
  console.log(`Submissions updated with refs: ${updated}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
