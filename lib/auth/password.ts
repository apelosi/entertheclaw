/** Client/server shared rules; Better Auth enforces min length 8 on the server. */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

const HAS_UPPERCASE = /[A-Z]/
const HAS_LOWERCASE = /[a-z]/
const HAS_DIGIT = /\d/
const HAS_SPECIAL = /[^A-Za-z0-9]/

export function validateNewPassword(raw: string): string | null {
  const password = raw
  if (!password) return 'Password is required.'
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`
  }
  if (!HAS_UPPERCASE.test(password)) {
    return 'Password must include at least one uppercase letter.'
  }
  if (!HAS_LOWERCASE.test(password)) {
    return 'Password must include at least one lowercase letter.'
  }
  if (!HAS_DIGIT.test(password)) {
    return 'Password must include at least one number.'
  }
  if (!HAS_SPECIAL.test(password)) {
    return 'Password must include at least one special character.'
  }
  return null
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (password !== confirm) return 'Passwords do not match.'
  return null
}
