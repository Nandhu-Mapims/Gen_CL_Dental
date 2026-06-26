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

module.exports = {
  normalizeUserContext,
  userMatchesFormContext,
  formContextMongoFilter,
  userVisibleToViewer,
  userContextMongoFilter,
};
