import qrcode from "qrcode-generator";

/**
 * Renders the URL as SVG paths rather than a canvas, so it stays sharp when a
 * merchant projects it, prints it, or screenshots it for a stall sign.
 */
export function QrCode({ value, size = 168 }: { readonly value: string; readonly size?: number }) {
  // Type number 0 lets the encoder pick the smallest that fits. Error
  // correction M survives a scuffed printout without inflating the modules.
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const quiet = 2;
  const span = count + quiet * 2;

  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) {
        path += `M${column + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label="QR code for this payment link"
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path d={path} fill="#14181f" />
    </svg>
  );
}
