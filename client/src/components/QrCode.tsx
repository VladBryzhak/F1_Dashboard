import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

// A QR code as a single SVG path: dark modules on a white tile with the
// standard 4-module quiet zone, so phone cameras read it on our dark theme.
export default function QrCode({
  value,
  size = 168,
  label,
}: {
  value: string
  size?: number
  label: string
}) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    let path = ''
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`
      }
    }
    return { d: path, n: count + 8 }
  }, [value])
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#0e0e13" />
    </svg>
  )
}
