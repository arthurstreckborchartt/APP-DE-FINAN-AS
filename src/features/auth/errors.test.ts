import { expect, test } from 'vitest'
import { authErrorKey } from './errors'

test.each([
  ['invalid_credentials', 'auth.errors.invalidCredentials'],
  ['email_not_confirmed', 'auth.errors.emailNotConfirmed'],
  ['user_already_exists', 'auth.errors.userExists'],
  ['email_exists', 'auth.errors.userExists'],
  ['weak_password', 'auth.errors.weakPassword'],
  ['over_request_rate_limit', 'auth.errors.rateLimit'],
  ['over_email_send_rate_limit', 'auth.errors.rateLimit'],
  ['algo_desconhecido', 'auth.errors.generic'],
  [undefined, 'auth.errors.generic'],
])('%s → %s', (code, key) => expect(authErrorKey(code)).toBe(key))
