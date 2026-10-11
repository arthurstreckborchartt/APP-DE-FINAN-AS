import { APP_NAME } from '../config'

/**
 * Marca do FINANCE ("Equilíbrio"): dois círculos que se encontram — o que entra e o que sai —
 * e a lente violeta onde eles se equilibram.
 */
export function BrandMark({ size = 32, withName = true, inverted = false, className = '' }: {
  size?: number
  withName?: boolean
  /** Versão clara, para usar sobre o painel violeta da marca. */
  inverted?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="shrink-0">
        <rect width="512" height="512" rx="128" fill={inverted ? '#ffffff' : '#5b3df5'} />
        <circle cx="204.8" cy="256" r="102.4" fill={inverted ? '#c9bdff' : '#c9bdff'} />
        <circle cx="307.2" cy="256" r="102.4" fill={inverted ? '#5b3df5' : '#ffffff'} fillOpacity={inverted ? 1 : 0.88} />
        <path d="M256 167.32 A102.4 102.4 0 0 1 256 344.68 A102.4 102.4 0 0 1 256 167.32 Z" fill={inverted ? '#3a22c4' : '#8b74ff'} />
      </svg>
      {withName && <span className="text-[17px] font-extrabold tracking-[0.08em]">{APP_NAME}</span>}
    </span>
  )
}
