/** True when sign-in failed because the account likely does not exist yet. */
export function isNewUserSignInError(message: string | undefined, code?: string): boolean {
  if (!message && !code) return false
  const normalized = `${code ?? ''} ${message ?? ''}`.toUpperCase()
  return (
    normalized.includes('USER_NOT_FOUND') ||
    normalized.includes('CREDENTIAL_ACCOUNT_NOT_FOUND') ||
    normalized.includes('USER NOT FOUND')
  )
}

/** True when sign-up failed because the email is already registered. */
export function isExistingUserSignUpError(message: string | undefined, code?: string): boolean {
  if (!message && !code) return false
  const normalized = `${code ?? ''} ${message ?? ''}`.toUpperCase()
  return (
    normalized.includes('USER_ALREADY_EXISTS') ||
    normalized.includes('ALREADY_EXISTS') ||
    normalized.includes('ALREADY EXISTS')
  )
}
