import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'

export function ProfileErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  async function logout() {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      qc.clear()
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] bg-surface p-6 text-center shadow-sheet sm:p-8">
        <AlertTriangle className="size-10 text-danger" aria-hidden="true" />
        <p role="alert">{t('common.profileLoadError')}</p>
        <Button full onClick={onRetry}>{t('common.retry')}</Button>
        <Button full variant="ghost" onClick={() => void logout()}>{t('settings.logout')}</Button>
      </div>
    </div>
  )
}
