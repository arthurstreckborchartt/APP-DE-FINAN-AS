export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true
  // iPadOS 13+ se identifica como Macintosh, mas tem tela touch
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

export function isStandalone(
  matchMedia: (q: string) => { matches: boolean },
  navigatorStandalone?: boolean,
): boolean {
  return matchMedia('(display-mode: standalone)').matches || navigatorStandalone === true
}
