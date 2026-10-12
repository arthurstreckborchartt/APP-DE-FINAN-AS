import { formatMoney } from '@/lib/money'
import { useHideValues } from '@/lib/privacy'
import { LineChart } from '@/components/ui/LineChart'

type Props = {
  /** Valores em centavos, um por ponto. */
  values: number[]
  labels: string[]
  currency: string
  locale: string
  /** Nome da série no balão (ex.: "Saldo"). */
  name: string
  color?: string
  showXAxis?: boolean
  className?: string
}

/**
 * Gráfico de linha de dinheiro (componente @spell/chart): o balão mostra o valor formatado
 * na moeda, ou "••••" quando os valores estão ocultos.
 */
export function MoneyLineChart({ values, labels, currency, locale, name, color = 'var(--primary)', showXAxis = true, className }: Props) {
  const hidden = useHideValues()
  if (values.length === 0) return null
  return (
    <LineChart
      data={values}
      labels={labels}
      name={name}
      color={color}
      width={2000}
      showXAxis={showXAxis}
      tickCount={5}
      formatValue={(v) => (hidden ? '••••' : formatMoney(v, currency, locale))}
      className={className}
    />
  )
}

/** Rótulo curto de dia para o eixo: "5 de out." conforme o idioma. */
export function dayLabels(month: string, days: number, locale: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  return Array.from({ length: days }, (_, i) => fmt.format(new Date(y, m - 1, i + 1)))
}
