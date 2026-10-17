import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readReturnTo } from '../../lib/return-to'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { useAuthProviders } from './useAuthProviders'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** "Continuar com Google" — só aparece quando o provedor está ligado no Supabase. */
export function GoogleButton() {
  const { t } = useTranslation()
  const { google } = useAuthProviders()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  if (!google) return null

  async function onClick() {
    setLoading(true)
    setError(false)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${readReturnTo() ?? '/'}` },
      })
      if (error) {
        setError(true)
        setLoading(false)
      }
      // Sem erro o navegador sai para o Google; o botão fica carregando até lá.
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-center gap-3 text-[13px] font-semibold text-muted">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{t('auth.errors.generic')}</p>}
      <Button type="button" variant="secondary" full loading={loading} onClick={() => void onClick()}>
        {!loading && <GoogleMark />}
        {t('auth.google')}
      </Button>
    </div>
  )
}
