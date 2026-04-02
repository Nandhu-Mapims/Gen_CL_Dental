const AuditSubmission = require('../models/AuditSubmission');
const Patient = require('../models/Patient');
const Admission = require('../models/Admission');
const Notification = require('../models/Notification');
const FormTemplate = require('../models/FormTemplate');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Get audit sessions for this supervisor (grouped by submittedBy + date + dept + form)
// Shows all submissions in the supervisor's department(s) — no unitChief field needed.
// ─────────────────────────────────────────────────────────────────────────────
function normalizeFormContextMode(m) {
  if (m === 'CLINICAL' || m === 'NON_CLINICAL') return m;
  return null; // BOTH/ALL/undefined/null
}

async function resolveFormContextFilter(req, requestedMode) {
  const mode = normalizeFormContextMode(requestedMode);
  if (mode) {
    const formTemplateIds = await FormTemplate.find({ formContext: mode, isActive: true }).distinct('_id');
    return { formTemplate: { $in: formTemplateIds } };
  }

  // Default for non-admin chiefs: use user's profile context, if clinical-only or non-clinical-only.
  const userId = req.user?.sub || req.user?.id || req.user?._id;
  if (!userId) return null;
  const currentUser = await User.findById(userId).select('role userContext').lean();
  if (!currentUser) return null;
  // SUPER_ADMIN should see both types by default for backward compatibility.
  if (currentUser.role === 'SUPER_ADMIN') return null;
  if (currentUser.userContext === 'CLINICAL' || currentUser.userContext === 'NON_CLINICAL') {
    const formTemplateIds = await FormTemplate
      .find({ formContext: currentUser.userContext, isActive: true })
      .distinct('_id');
    return { formTemplate: { $in: formTemplateIds } };
  }

  return null;
}

exports.getSupervisorSessions = async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const User = require('../models/User');
    const currentUser = await User.findById(userId).lean();
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Build access filter:
    // - SUPER_ADMIN: can see all submissions (no restriction)
    // - Others (supervisors): see submissions explicitly assigned to them, regardless of department
    const accessFilter =
      currentUser.role === 'SUPER_ADMIN'
        ? {}
        : { assignedToUserId: userId };

    const formContextFilter = await resolveFormContextFilter(req, req.query.formContext);
    const submissions = await AuditSubmission.find({ ...accessFilter, ...(formContextFilter || {}) })
      .populate('submittedBy', 'name email designation')
      .populate('department', 'name code')
      .populate('formTemplate', 'name')
      .populate('checklistItemId', 'label section order responseType')
      .populate('locationId', 'areaName zone floor building locationType')
      .populate('shiftId', 'name startTime endTime')
      .sort({ submittedAt: -1 })
      .lean();

    // Group by: submittedBy + date (YYYY-MM-DD) + formTemplate + department
    const sessionsMap = {};

    submissions.forEach((sub) => {
      const submittedById = sub.submittedBy?._id?.toString() || 'unknown';
      const deptId = sub.department?._id?.toString() || 'unknown';
      const formId = sub.formTemplate?._id?.toString() || 'unknown';
      const dateStr = sub.auditDate
        ? new Date(sub.auditDate).toISOString().slice(0, 10)
        : sub.submittedAt
        ? new Date(sub.submittedAt).toISOString().slice(0, 10)
        : 'unknown';
      const timeStr = sub.auditTime || (sub.submittedAt ? new Date(sub.submittedAt).toISOString().slice(11, 16) : '');

      const key = `${submittedById}|${dateStr}|${formId}|${deptId}`;

      if (!sessionsMap[key]) {
        const locLabel = sub.locationId
          ? [sub.locationId.zone, sub.locationId.floor, sub.locationId.areaName].filter(Boolean).join(' / ')
          : sub.location || '';
        const shiftLabel = sub.shiftId
          ? (sub.shiftId.name || '')
          : sub.shift || '';

        sessionsMap[key] = {
          sessionKey: key,
          submittedBy: sub.submittedBy,
          department: sub.department,
          formTemplate: sub.formTemplate,
          date: dateStr,
          time: timeStr,
          location: locLabel,
          shift: shiftLabel,
          submittedAt: sub.submittedAt,
          totalItems: 0,
          yesCount: 0,
          noCount: 0,
          naCount: 0,
          withActions: 0,
          submissions: [],
        };
      }

      const session = sessionsMap[key];
      session.totalItems++;
      const val = (sub.responseValue || sub.yesNoNa || '').toString().trim().toUpperCase();
      if (val === 'YES') session.yesCount++;
      else if (val === 'NO') session.noCount++;
      else if (val === 'N/A' || val === 'NA') session.naCount++;
      if (sub.corrective || sub.preventive) session.withActions++;
      if (sub.submittedAt > session.submittedAt) session.submittedAt = sub.submittedAt;
      session.submissions.push(sub);
    });

    const sessions = Object.values(sessionsMap)
      .map((s) => ({
        ...s,
        complianceRate: s.totalItems > 0
          ? Math.round(((s.yesCount + s.naCount) / s.totalItems) * 100)
          : 0,
        pendingActions: s.noCount - s.withActions > 0 ? s.noCount - s.withActions : 0,
      }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json(sessions);
  } catch (err) {
    console.error('getSupervisorSessions error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all submissions for a specific session key (for the corrective/preventive modal)
exports.getSessionSubmissions = async (req, res) => {
  try {
    const { submittedById, date, formTemplateId, departmentId } = req.query;

    if (!submittedById || !date || !formTemplateId || !departmentId) {
      return res.status(400).json({ message: 'submittedById, date, formTemplateId and departmentId are required' });
    }

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    const submissions = await AuditSubmission.find({
      submittedBy: submittedById,
      formTemplate: formTemplateId,
      department: departmentId,
      submittedAt: { $gte: dayStart, $lte: dayEnd },
    })
      .populate('checklistItemId', 'label section order responseType isMandatory')
      .populate('submittedBy', 'name email designation')
      .populate('department', 'name code')
      .populate('formTemplate', 'name')
      .populate('correctivePreventiveBy', 'name email')
      .populate('locationId', 'areaName zone floor')
      .populate('shiftId', 'name')
      .sort({ 'checklistItemId.section': 1, 'checklistItemId.order': 1 })
      .lean();

    res.json(submissions);
  } catch (err) {
    console.error('getSessionSubmissions error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Supervisor/reviewer: set per-session reviewer signature image (updates all rows in the session)
exports.uploadReviewerSessionSignature = async (req, res) => {
  try {
    const { submittedById, date, formTemplateId, departmentId } = req.query;
    if (!submittedById || !date || !formTemplateId || !departmentId) {
      return res.status(400).json({ message: 'submittedById, date, formTemplateId and departmentId are required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Use form field name "signature".' });
    }

    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');
    const publicPath = `/uploads/session-signatures/reviewer/${req.file.filename}`;
    const now = new Date();
    const reviewerId = req.user?.sub || req.user?.id || req.user?._id || null;

    const AuditSubmission = require('../models/AuditSubmission');
    await AuditSubmission.updateMany(
      {
        submittedBy: submittedById,
        formTemplate: formTemplateId,
        department: departmentId,
        submittedAt: { $gte: dayStart, $lte: dayEnd },
      },
      {
        $set: {
          reviewerSignatureImage: publicPath,
          reviewerSignatureAt: now,
          reviewerSignatureBy: reviewerId,
        },
      }
    );

    res.json({ ok: true, reviewerSignatureImage: publicPath, reviewerSignatureAt: now, reviewerSignatureBy: reviewerId });
  } catch (err) {
    console.error('uploadReviewerSessionSignature error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all patients (IPIDs) assigned to this chief
exports.getChiefPatients = async (req, res) => {
  try {
    const { chiefName } = req.query;
    
    if (!chiefName || !chiefName.trim()) {
      return res.status(400).json({ message: 'Chief name is required' });
    }

    // Get all unique IPIDs where this chief is tagged
    const submissions = await AuditSubmission.find({
      unitChief: chiefName.trim(),
    })
      .populate('patient', 'uhid patientName')
      .populate('admission', 'ipid ward unitNo admissionDate')
      .populate('department', 'name code')
      .sort({ submittedAt: -1 });

    // Group by IPID
    const patientsMap = {};
    submissions.forEach((sub) => {
      const ipid = sub.ipid || sub.admission?.ipid;
      if (!ipid) return;

      if (!patientsMap[ipid]) {
        patientsMap[ipid] = {
          ipid: ipid,
          uhid: sub.uhid || sub.patient?.uhid,
          patientName: sub.patientName || sub.patient?.patientName,
          ward: sub.admission?.ward,
          unitNo: sub.admission?.unitNo,
          admissionDate: sub.admission?.admissionDate,
          departments: new Set(),
          totalSubmissions: 0,
          noCount: 0,
          noWithActions: 0,
          lastSubmittedAt: sub.submittedAt,
        };
      }

      patientsMap[ipid].totalSubmissions++;
      const isNo = (sub.responseValue || sub.yesNoNa || '').toString().toUpperCase() === 'NO';
      if (isNo) {
        patientsMap[ipid].noCount++;
        const cor = (sub.corrective || '').trim();
        const prev = (sub.preventive || '').trim();
        if (cor.length > 0 && prev.length > 0) {
          patientsMap[ipid].noWithActions++;
        }
      }
      if (sub.department) {
        patientsMap[ipid].departments.add(sub.department.name);
      }
      if (sub.submittedAt > patientsMap[ipid].lastSubmittedAt) {
        patientsMap[ipid].lastSubmittedAt = sub.submittedAt;
      }
    });

    // Convert to array
    const patients = Object.values(patientsMap).map((p) => ({
      ...p,
      departments: Array.from(p.departments),
    }));

    res.json(patients);
  } catch (err) {
    console.error('getChiefPatients error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all submissions for a specific IPID assigned to this chief
exports.getChiefPatientSubmissions = async (req, res) => {
  try {
    const { ipid, chiefName } = req.query;

    if (!ipid || !ipid.trim()) {
      return res.status(400).json({ message: 'IPID is required' });
    }
    if (!chiefName || !chiefName.trim()) {
      return res.status(400).json({ message: 'Chief name is required' });
    }

    const submissions = await AuditSubmission.find({
      ipid: ipid.trim().toUpperCase(),
      unitChief: chiefName.trim(),
    })
      .populate('patient', 'uhid patientName')
      .populate('admission', 'ipid ward unitNo admissionDate')
      .populate('department', 'name code')
      .populate('checklistItemId', 'label description responseType isMandatory section order')
      .populate('submittedBy', 'name email designation')
      .populate('correctivePreventiveBy', 'name email')
      .sort({ submittedAt: -1 })
      .lean();

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'No submissions found for this IPID and chief' });
    }

    // Group by department; sort submissions by section then order for consistent display
    const byDepartment = {};
    submissions.forEach((sub) => {
      const deptId = sub.department?._id?.toString() || 'unknown';
      if (!byDepartment[deptId]) {
        byDepartment[deptId] = {
          department: sub.department,
          submissions: [],
        };
      }
      byDepartment[deptId].submissions.push(sub);
    });
    Object.values(byDepartment).forEach((d) => {
      d.submissions.sort((a, b) => {
        const secA = (a.checklistItemId?.section || '').toString();
        const secB = (b.checklistItemId?.section || '').toString();
        if (secA !== secB) return secA.localeCompare(secB);
        const ordA = a.checklistItemId?.order ?? 0;
        const ordB = b.checklistItemId?.order ?? 0;
        return ordA - ordB;
      });
    });

    res.json({
      ipid: ipid.trim().toUpperCase(),
      patient: submissions[0]?.patient,
      admission: submissions[0]?.admission,
      departments: Object.values(byDepartment),
    });
  } catch (err) {
    console.error('getChiefPatientSubmissions error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update corrective and preventive actions for a submission
// NOTE: Chiefs can ONLY update corrective/preventive for NO responses
exports.updateCorrectivePreventive = async (req, res) => {
  try {
    const { id } = req.params;
    const { corrective, preventive } = req.body;
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const submission = await AuditSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const responseVal = (submission.responseValue || submission.yesNoNa || '').toString().toUpperCase();
    if (responseVal !== 'NO') {
      return res.status(400).json({
        message: 'Corrective and preventive actions can only be entered for NO responses.',
      });
    }

    const correctiveVal = corrective?.trim() || '';
    const preventiveVal = preventive?.trim() || '';
    if (!correctiveVal && !preventiveVal) {
      return res.status(400).json({
        message: 'Please enter at least one of Corrective Action or Preventive Action.',
      });
    }

    submission.corrective = correctiveVal;
    submission.preventive = preventiveVal;
    submission.correctivePreventiveBy = userId;
    submission.correctivePreventiveAt = new Date();

    await submission.save();

    // Create notification for submitting doctor (if available)
    if (submission.submittedBy) {
      try {
        await Notification.create({
          user: submission.submittedBy,
          title: 'Corrective & Preventive Actions Added',
          message: `Chief has updated corrective and preventive actions for UHID ${submission.uhid} (IPID ${submission.ipid || 'N/A'}).`,
          type: 'action',
        });
      } catch (notifyErr) {
        // Log but don't block main flow
        console.error('Notification create error (updateCorrectivePreventive):', notifyErr);
      }
    }

    // Populate before sending response
    await submission.populate('correctivePreventiveBy', 'name email');

    res.json(submission);
  } catch (err) {
    console.error('updateCorrectivePreventive error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin only: Chief Analytics - statistics, trends, performance insights of all chiefs
exports.getChiefAnalytics = async (req, res) => {
  try {
    const formContextFilter = await resolveFormContextFilter(req, req.query.formContext);
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Current seed uses `assignedToUserId` for supervisor assignment.
    // The legacy fields `unitChief/ipid/uhid` are not populated, so we group by `assignedToUserId` instead.
    const allSubmissions = await AuditSubmission.find(formContextFilter || {})
      .select('assignedToUserId department formTemplate responseValue yesNoNa corrective preventive submittedAt patientUhid patientName')
      .lean();

    const chiefsMap = {}; // supervisorId -> stats
    const chiefsTrendMap = {}; // supervisorId -> { last7SessionKeys, prev7SessionKeys }
    const supervisorIds = new Set();

    allSubmissions.forEach((sub) => {
      const supervisorId = sub.assignedToUserId ? sub.assignedToUserId.toString() : '';
      if (!supervisorId) return;
      supervisorIds.add(supervisorId);

      const deptId = sub.department ? (sub.department._id ? sub.department._id.toString() : sub.department.toString()) : '';
      const formId = sub.formTemplate ? (sub.formTemplate._id ? sub.formTemplate._id.toString() : sub.formTemplate.toString()) : '';
      const submittedAtMs = sub.submittedAt ? new Date(sub.submittedAt).getTime() : 0;
      const submittedAtSec = Math.floor(submittedAtMs / 1000);

      const patientKey = (sub.patientUhid && String(sub.patientUhid).trim())
        ? String(sub.patientUhid).trim()
        : (sub.patientName && String(sub.patientName).trim())
          ? String(sub.patientName).trim()
          : '';

      const sessionKey = `${supervisorId}|${patientKey}|${deptId}|${formId}|${submittedAtSec}`;

      if (!chiefsMap[supervisorId]) {
        chiefsMap[supervisorId] = {
          supervisorId,
          sessionKeys: new Set(),
          yesCount: 0,
          noCount: 0,
          itemCount: 0,
          compliantCount: 0,
          patients: new Set(),
          withActionsCount: 0,
          lastSubmittedAt: null,
        };
        chiefsTrendMap[supervisorId] = { last7SessionKeys: new Set(), prev7SessionKeys: new Set() };
      }

      const stats = chiefsMap[supervisorId];
      stats.sessionKeys.add(sessionKey);
      stats.itemCount++;

      const val = (sub.responseValue || sub.yesNoNa || '').toString().trim().toUpperCase();
      if (val === 'YES') stats.yesCount++;
      else if (val === 'NO') stats.noCount++;

      if (patientKey) stats.patients.add(patientKey);
      if (sub.corrective || sub.preventive) stats.withActionsCount++;

      // Compliance: only NO is negative; YES, N/A, text/select = positive; NO with both corrective+preventive filled = positive
      const cor = (sub.corrective || '').trim();
      const prev = (sub.preventive || '').trim();
      const hasActions = cor.length > 0 && prev.length > 0;
      const isCompliant = val === 'NO' ? hasActions : (val === 'YES' || val === 'N/A' || val === 'NA' || val.length > 0);
      if (isCompliant) stats.compliantCount++;

      if (sub.submittedAt) {
        if (!stats.lastSubmittedAt || sub.submittedAt > stats.lastSubmittedAt) {
          stats.lastSubmittedAt = sub.submittedAt;
        }
      }

      const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
      if (subDate) {
        if (subDate >= sevenDaysAgo) chiefsTrendMap[supervisorId].last7SessionKeys.add(sessionKey);
        else if (subDate >= fourteenDaysAgo) chiefsTrendMap[supervisorId].prev7SessionKeys.add(sessionKey);
      }
    });

    const supervisorsById = new Map(
      (await User.find({ _id: { $in: Array.from(supervisorIds) } }).select('name').lean()).map((u) => [
        u._id.toString(),
        u,
      ])
    );

    const chiefs = Object.values(chiefsMap).map((s) => {
      const supervisor = supervisorsById.get(s.supervisorId);
      return {
        chiefName: supervisor?.name || s.supervisorId,
        totalSubmissions: s.sessionKeys.size,
        yesCount: s.yesCount,
        noCount: s.noCount,
        totalPatients: s.patients.size,
        withActionsCount: s.withActionsCount,
        complianceRate:
          s.itemCount > 0 ? parseFloat(((s.compliantCount / s.itemCount) * 100).toFixed(1)) : 0,
        actionCoverageRate:
          s.noCount > 0 ? parseFloat(((s.withActionsCount / s.noCount) * 100).toFixed(1)) : 100,
        lastSubmittedAt: s.lastSubmittedAt,
        trendLast7: chiefsTrendMap[s.supervisorId]?.last7SessionKeys?.size ?? 0,
        trendPrev7: chiefsTrendMap[s.supervisorId]?.prev7SessionKeys?.size ?? 0,
      }
    })
      .filter((c) => c.chiefName);

    chiefs.sort((a, b) => b.totalSubmissions - a.totalSubmissions);

    const totalFormSubmissions = chiefs.reduce((sum, c) => sum + c.totalSubmissions, 0);
    const totalChecklistFields = Object.values(chiefsMap).reduce((sum, s) => sum + s.itemCount, 0);
    const summary = {
      totalChiefs: chiefs.length,
      totalSubmissions: totalFormSubmissions,
      totalChecklistFields,
      totalNoResponses: chiefs.reduce((sum, c) => sum + c.noCount, 0),
      totalWithActions: chiefs.reduce((sum, c) => sum + c.withActionsCount, 0),
    };

    res.json({
      summary,
      chiefs,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error('getChiefAnalytics error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Chief's own analytics (for Chief role) – summary, by department, trend
exports.getMyAnalytics = async (req, res) => {
  try {
    const { chiefName } = req.query;
    if (!chiefName || !chiefName.trim()) {
      return res.status(400).json({ message: 'Chief name is required' });
    }

    const name = chiefName.trim();
    const formContextFilter = await resolveFormContextFilter(req, req.query.formContext);
    const supervisorUser = await User.findOne({ name }).select('_id').lean();
    if (!supervisorUser) {
      return res.status(404).json({ message: 'Supervisor not found' });
    }

    const submissions = await AuditSubmission.find({
      assignedToUserId: supervisorUser._id,
      ...(formContextFilter || {}),
    })
      .select('department responseValue yesNoNa corrective preventive submittedAt patientUhid patientName')
      .populate('department', 'name code')
      .lean();

    const now = new Date();
    const dayBuckets = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setUTCHours(0, 0, 0, 0);
      dayBuckets.push({ date: date.toISOString().slice(0, 10), count: 0 });
    }

    const summary = {
      totalSubmissions: 0,
      yesCount: 0,
      noCount: 0,
      compliantCount: 0,
      withActionsCount: 0,
      patients: new Set(),
    };
    const byDept = {};
    submissions.forEach((sub) => {
      summary.totalSubmissions++;
      const val = (sub.responseValue || sub.yesNoNa || '').toString().trim().toUpperCase();
      if (val === 'YES') summary.yesCount++;
      else if (val === 'NO') summary.noCount++;
      if (sub.corrective || sub.preventive) summary.withActionsCount++;
      const patientKey = (sub.patientUhid && String(sub.patientUhid).trim())
        ? String(sub.patientUhid).trim()
        : (sub.patientName && String(sub.patientName).trim())
          ? String(sub.patientName).trim()
          : '';
      if (patientKey) summary.patients.add(patientKey);

      const cor = (sub.corrective || '').trim();
      const prev = (sub.preventive || '').trim();
      const hasActions = cor.length > 0 && prev.length > 0;
      const isCompliant = val === 'NO' ? hasActions : (val === 'YES' || val === 'N/A' || val === 'NA' || val.length > 0);
      if (isCompliant) summary.compliantCount++;

      const deptId = sub.department?._id?.toString() || 'unknown';
      const deptName = sub.department?.name || 'Unknown';
      if (!byDept[deptId]) {
        byDept[deptId] = {
          departmentName: deptName,
          departmentCode: sub.department?.code,
          totalSubmissions: 0,
          withActions: 0,
          noCount: 0,
          patients: new Set(),
        };
      }
      byDept[deptId].totalSubmissions++;
      if (sub.corrective || sub.preventive) byDept[deptId].withActions++;
      if (val === 'NO') byDept[deptId].noCount++;
      if (patientKey) byDept[deptId].patients.add(patientKey);

      const subDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
      if (subDate) {
        const key = subDate.toISOString().slice(0, 10);
        const bucket = dayBuckets.find((b) => b.date === key);
        if (bucket) bucket.count++;
      }
    });

    const byDepartment = Object.values(byDept).map((d) => ({
      departmentName: d.departmentName,
      departmentCode: d.departmentCode,
      totalSubmissions: d.totalSubmissions,
      withActions: d.withActions,
      noCount: d.noCount,
      patientCount: d.patients.size,
    })).sort((a, b) => b.totalSubmissions - a.totalSubmissions);

    const totalPatients = summary.patients.size;
    const complianceRate = summary.totalSubmissions > 0
      ? parseFloat(((summary.compliantCount / summary.totalSubmissions) * 100).toFixed(1))
      : 0;
    const actionCoverageRate = summary.noCount > 0
      ? parseFloat(((summary.withActionsCount / summary.noCount) * 100).toFixed(1))
      : 100;

    res.json({
      chiefName: name,
      summary: {
        totalSubmissions: summary.totalSubmissions,
        yesCount: summary.yesCount,
        noCount: summary.noCount,
        withActionsCount: summary.withActionsCount,
        totalPatients,
        complianceRate,
        actionCoverageRate,
      },
      byDepartment,
      last7Days: dayBuckets,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error('getMyAnalytics error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get doctor performance analytics for this chief
exports.getDoctorPerformance = async (req, res) => {
  try {
    const { chiefName } = req.query;

    if (!chiefName || !chiefName.trim()) {
      return res.status(400).json({ message: 'Chief name is required' });
    }

    // Get all submissions for this chief
    const submissions = await AuditSubmission.find({
      unitChief: chiefName.trim(),
    })
      .populate('submittedBy', 'name email role')
      .populate('department', 'name code')
      .sort({ submittedAt: -1 });

    // Group by doctor (submittedBy)
    const doctorStats = {};

    submissions.forEach((sub) => {
      const doctorId = sub.submittedBy?._id?.toString();
      if (!doctorId) return;

      if (!doctorStats[doctorId]) {
        doctorStats[doctorId] = {
          doctor: {
            id: doctorId,
            name: sub.submittedBy.name,
            email: sub.submittedBy.email,
            role: sub.submittedBy.role,
          },
          totalSubmissions: 0,
          noResponses: 0,
          noWithRemarks: 0,
          departments: new Set(),
          patients: new Set(),
          lastSubmittedAt: sub.submittedAt,
          firstSubmittedAt: sub.submittedAt,
        };
      }

      const stats = doctorStats[doctorId];
      stats.totalSubmissions++;

      // Track thoroughness: when auditor marks NO, did they add remarks? (required for proper documentation)
      const responseVal = (sub.responseValue || sub.yesNoNa || '').toString().toUpperCase();
      if (responseVal === 'NO') {
        stats.noResponses++;
        if (sub.remarks && String(sub.remarks).trim()) {
          stats.noWithRemarks++;
        }
      }

      // Track departments and patients
      if (sub.department?._id) {
        stats.departments.add(sub.department.name);
      }
      if (sub.ipid) {
        stats.patients.add(sub.ipid);
      }

      // Update timestamps
      if (sub.submittedAt > stats.lastSubmittedAt) {
        stats.lastSubmittedAt = sub.submittedAt;
      }
      if (sub.submittedAt < stats.firstSubmittedAt) {
        stats.firstSubmittedAt = sub.submittedAt;
      }
    });

    // Convert to array - auditor performance = productivity + thoroughness (not department compliance)
    const performanceData = Object.values(doctorStats).map((stats) => {
      // Thoroughness: when auditor found NO (non-compliance), did they document with remarks?
      const thoroughnessRate = stats.noResponses > 0
        ? Math.round((stats.noWithRemarks / stats.noResponses) * 100)
        : 100; // No NOs = fully thorough (nothing to document)

      return {
        doctor: stats.doctor,
        totalSubmissions: stats.totalSubmissions,
        noResponses: stats.noResponses,
        noWithRemarks: stats.noWithRemarks,
        thoroughnessRate,
        departments: Array.from(stats.departments),
        totalPatients: stats.patients.size,
        lastSubmittedAt: stats.lastSubmittedAt,
        firstSubmittedAt: stats.firstSubmittedAt,
      };
    });

    // Sort by total submissions (most active first)
    performanceData.sort((a, b) => b.totalSubmissions - a.totalSubmissions);

    res.json({
      chiefName: chiefName.trim(),
      totalDoctors: performanceData.length,
      doctors: performanceData,
    });
  } catch (err) {
    console.error('getDoctorPerformance error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
