import { useRef, useState, useCallback, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

export interface TiltCardProps {
  /** Maximum tilt angle in degrees */
  tiltLimit?: number
  /** Scale factor on hover */
  scale?: number
  /** Perspective distance in pixels */
  perspective?: number
  /** Tilt direction: "gravitate" follows cursor, "evade" tilts away */
  effect?: "gravitate" | "evade"
  /** Show a spotlight that follows the cursor on hover */
  spotlight?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: CSSProperties
  /** Card content */
  children?: ReactNode
}

export function TiltCard({
  tiltLimit = 15,
  scale = 1.05,
  perspective = 1200,
  effect = "evade",
  spotlight = true,
  className,
  style,
  children,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState(
    `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
  )
  const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 })
  const [isHovered, setIsHovered] = useState(false)

  const dir = effect === "evade" ? -1 : 1

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const el = cardRef.current
      // Só com mouse/caneta: no toque o card não inclina (evita brigar com a rolagem).
      if (!el || e.pointerType === "touch" || prefersReducedMotion()) return
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const xRot = (py - 0.5) * (tiltLimit * 2) * dir
      const yRot = (px - 0.5) * -(tiltLimit * 2) * dir
      setTransform(
        `perspective(${perspective}px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(${scale}, ${scale}, ${scale})`
      )
      if (spotlight) {
        setSpotlightPos({ x: px * 100, y: py * 100 })
      }
    },
    [tiltLimit, scale, perspective, dir, spotlight]
  )

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setTransform(
      `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
    )
    setIsHovered(false)
  }, [perspective])

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn("will-change-transform relative overflow-hidden", className)}
      style={{
        transform,
        transition: "transform 0.2s ease-out",
        transformStyle: "preserve-3d",
        ...style,
      }}
    >
      {children}
      {spotlight && (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={{ opacity: isHovered ? 1 : 0, transition: "opacity 0.3s" }}
        >
          <div
            className="absolute w-[200%] h-[200%] rounded-full opacity-100 dark:opacity-50"
            style={{
              left: `${spotlightPos.x}%`,
              top: `${spotlightPos.y}%`,
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 40%)",
            }}
          />
        </div>
      )}
    </div>
  )
}
