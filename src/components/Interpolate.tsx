import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const MARK = '\u0000'

/**
 * Frase traduzida com elementos React no lugar das variáveis (ex.: `Amount` em "{{spent}} de {{limit}}"),
 * para que valores continuem passando pelo `Amount` (e pelo "ocultar valores") e a ordem siga o idioma.
 */
export function Interpolate({ i18nKey, values }: { i18nKey: string; values: Record<string, ReactNode> }) {
  const { t } = useTranslation()
  const marks = Object.fromEntries(Object.keys(values).map((k) => [k, `${MARK}${k}${MARK}`]))
  const parts = t(i18nKey, marks).split(MARK)
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 && Object.hasOwn(values, part)
        ? <Fragment key={i}>{values[part]}</Fragment>
        : part))}
    </>
  )
}
