/**
 * Clinical / non-clinical access helpers.
 * BOTH → all; CLINICAL → clinical only; NON_CLINICAL → non-clinical only (incl. legacy users).
 */

function normalizeUserContext(userContext) {
  if (userContext === 'CLINICAL' || userContext === 'NON_CLINICAL' || userContext === 'BOTH') {
    return userContext;
  }
  return 'NON_CLINICAL';
}

/** Whether a user's profile can work with a form's clinical/non-clinical type. */
function userMatchesFormContext(userContext, formContext) {
  const fc = formContext || 'NON_CLINICAL';
  const uc = normalizeUserContext(userContext);
  if (uc === 'BOTH') return true;
  if (uc === 'CLINICAL') return fc === 'CLINICAL';
  return fc === 'NON_CLINICAL';
}

/** Mongo filter for FormTemplate lists scoped to viewer's userContext. */
function formContextMongoFilter(userContext) {
  const uc = normalizeUserContext(userContext);
  if (uc === 'BOTH') return {};
  return { formContext: uc };
}

/** Whether target user should appear in lists for a viewer with viewerContext. */
function userVisibleToViewer(viewerContext, targetUserContext) {
  const vc = normalizeUserContext(viewerContext);
  const tc = normalizeUserContext(targetUserContext);
  if (vc === 'BOTH') return true;
  if (vc === 'CLINICAL') return tc === 'CLINICAL' || tc === 'BOTH';
  return tc === 'NON_CLINICAL' || tc === 'BOTH';
}

/** Mongo filter for User lists scoped to viewer's userContext. */
function userContextMongoFilter(viewerContext) {
  const vc = normalizeUserContext(viewerContext);
  if (vc === 'BOTH') return {};
  if (vc === 'CLINICAL') {
    return { userContext: { $in: ['CLINICAL', 'BOTH'] } };
  }
  return {
    $or: [
      { userContext: { $in: ['NON_CLINICAL', 'BOTH'] } },
      { userContext: { $exists: false } },
      { userContext: null },
    ],
  };
}

const SUPERVISORY_ROLES = ['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR'];

function isSupervisoryRole(role) {
  return SUPERVISORY_ROLES.includes(role);
}

/**
 * Supervisors/admins oversee both clinical and non-clinical checklists in their scope.
 * Only STAFF (and similar front-line roles) are restricted by userContext.
 */
function formContextMongoFilterForUser(user) {
  if (!user) return formContextMongoFilter(null);
  if (isSupervisoryRole(user.role)) return {};
  return formContextMongoFilter(user.userContext);
}

/** Assigned users may load a form even if context was changed after assignment. */
function isUserAssignedToForm(userId, formTemplate) {
  if (!userId || !formTemplate?.assignedUsers?.length) return false;
  const uid = String(userId);
  return formTemplate.assignedUsers.some((id) => String(id) === uid);
}

function shouldBypassFormContextCheck(user, formTemplate, userId) {
  if (!user) return false;
  if (isSupervisoryRole(user.role)) return true;
  const id = userId || user._id || user.id || user.sub;
  if (isUserAssignedToForm(id, formTemplate)) return true;
  return false;
}

function formContextMismatchMessage(userContext, formContext) {
  const uc = normalizeUserContext(userContext);
  const fc = formContext || 'NON_CLINICAL';
  if (uc === 'CLINICAL' && fc !== 'CLINICAL') {
    return 'This is a non-clinical checklist but your account is clinical-only. Ask your administrator to set your user type to "Both" or use a non-clinical profile.';
  }
  if (uc === 'NON_CLINICAL' && fc === 'CLINICAL') {
    return 'This is a clinical checklist but your account is non-clinical-only. Ask your administrator to set your user type to "Both" or use a clinical profile.';
  }
  return 'Your user type does not match this checklist form type.';
}

module.exports = {
  normalizeUserContext,
  userMatchesFormContext,
  formContextMongoFilter,
  formContextMongoFilterForUser,
  userVisibleToViewer,
  userContextMongoFilter,
  isSupervisoryRole,
  isUserAssignedToForm,
  shouldBypassFormContextCheck,
  formContextMismatchMessage,
  SUPERVISORY_ROLES,
};
