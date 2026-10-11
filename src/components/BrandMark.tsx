import { useId } from 'react'
import { APP_NAME } from '../config'

/** Marca do FINANCE: monograma "F" sobre o cobalto da marca, com o nome ao lado. */
export function BrandMark({ size = 32, withName = true, className = '' }: { size?: number; withName?: boolean; className?: string }) {
  const gradientId = `brand-${useId().replace(/:/g, '')}`
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="shrink-0 rounded-[24%] ring-1 ring-white/25">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2c4fd0" />
            <stop offset="1" stopColor="#172c86" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="120" fill={`url(#${gradientId})`} />
        <rect x="150" y="128" width="64" height="256" rx="32" fill="#fff" />
        <rect x="150" y="128" width="212" height="64" rx="32" fill="#fff" />
        <rect x="150" y="226" width="148" height="60" rx="30" fill="#c9d4fb" />
      </svg>
      {withName && <span className="text-[17px] font-extrabold tracking-[0.08em]">{APP_NAME}</span>}
    </span>
  )
}
