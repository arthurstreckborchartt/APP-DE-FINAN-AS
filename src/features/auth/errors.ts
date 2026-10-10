const MAP: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  user_already_exists: 'auth.errors.userExists',
  email_exists: 'auth.errors.userExists',
  weak_password: 'auth.errors.weakPassword',
  over_request_rate_limit: 'auth.errors.rateLimit',
  over_email_send_rate_limit: 'auth.errors.rateLimit',
}

export function authErrorKey(code: string | undefined): string {
  return (code && MAP[code]) || 'auth.errors.generic'
}
