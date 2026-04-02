/**
 * Whether a user's profile can work with a form's clinical/non-clinical type.
 * BOTH → all forms; CLINICAL → clinical forms only; NON_CLINICAL → non-clinical only.
 */
function userMatchesFormContext(userContext, formContext) {
  const fc = formContext || 'NON_CLINICAL';
  const uc = userContext || 'NON_CLINICAL';
  if (uc === 'BOTH') return true;
  if (uc === 'CLINICAL') return fc === 'CLINICAL';
  return fc === 'NON_CLINICAL';
}

module.exports = { userMatchesFormContext };
