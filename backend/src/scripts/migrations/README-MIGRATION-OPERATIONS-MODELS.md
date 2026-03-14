# Migration: Operations Checklist Models (Location, Asset, Shift, Submission refs)

## Summary

- **New models:** `Location`, `Asset`, `Shift`.
- **Updated:** `Department` (index), `AuditSubmission` (added `locationId`, `assetId`, `shiftId`, `assignedToUserId`; kept `location`, `asset`, `shift` strings for backward compatibility).
- **Unchanged:** `FormTemplate` (= ChecklistTemplate), `ChecklistItem` (= ChecklistTask). No patient references; no schema change required.

## Model mapping

| Your term        | Codebase model   | Notes                                      |
|------------------|------------------|--------------------------------------------|
| Department       | Department       | name, code, isActive                        |
| Location         | Location         | building, floor, areaName, code, isActive   |
| Asset            | Asset            | name, assetType, assetCode, locationId, isActive |
| Shift            | Shift            | name, startTime, endTime, isActive          |
| ChecklistTemplate| FormTemplate     | form definition + departments               |
| ChecklistTask    | ChecklistItem    | per-item definition                        |
| Submission       | AuditSubmission  | departmentId, locationId, assetId?, shiftId, assignedToUserId |

## Migration strategy (minimal breaking change)

### Phase 1: Deploy schema only

1. Deploy new models (`Location`, `Asset`, `Shift`) and updated `AuditSubmission` (new fields are optional/default null).
2. No data migration yet. Existing submissions keep using string `location`/`asset`/`shift`; new APIs can start writing `locationId`/`assetId`/`shiftId`/`assignedToUserId` when provided.

### Phase 2: Backfill reference data (optional)

1. Run seed or admin UI to create `Location`, `Asset`, `Shift` master data.
2. Optionally run `backfill-submission-refs.js` to create Location/Asset/Shift from distinct submission string values and set `locationId`/`assetId`/`shiftId` on submissions. Existing string fields remain for readability.

### Phase 3: Prefer IDs in API and UI

1. APIs: accept and return both IDs and legacy strings; when both exist, prefer IDs and populate display from refs.
2. Frontend: use dropdowns for Location/Asset/Shift from new APIs; submit `locationId`, `assetId`, `shiftId`, `assignedToUserId` when selected.
3. Later: deprecate writing legacy strings; keep reading them for old records.

## Rollback

- New fields on `AuditSubmission` are optional. Dropping them in a future schema change is safe if you are not yet relying on them.
- New collections `locations`, `assets`, `shifts` can be dropped if unused.

## Files

- `backfill-submission-refs.js` – optional script to create Location/Asset/Shift from existing submission strings and link submissions.
