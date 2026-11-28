import type { Ref } from "react";
import QRCode from "react-qr-code";
import type { QrFields } from "./vietqr";

type QrArtworkProps = {
  artworkRef: Ref<SVGSVGElement>;
  payload: string;
  fields: QrFields;
  bankName: string;
  title: string;
  amount: string;
  logo: string | null;
};

export function QrArtwork({
  artworkRef,
  payload,
  fields,
  bankName,
  title,
  amount,
  logo,
}: QrArtworkProps) {
  const decorated = fields.template !== "qr-only";
  const details = fields.template === "details";
  const headline = fields.businessName || bankName;
  const headlineSize = Math.min(28, 440 / Array.from(headline).length);
  const height = details ? 694 : 560;
  const qrTop = decorated ? 157 : 72;
  const qrSize = decorated ? 336 : 416;
  const logoSize = qrSize / 8;
  const logoX = (560 - logoSize) / 2;
  const logoY = qrTop + (qrSize - logoSize) / 2;

  return (
    <svg
      ref={artworkRef}
      xmlns="http://www.w3.org/2000/svg"
      width="560"
      height={height}
      viewBox={`0 0 560 ${height}`}
      role="img"
      aria-label={title}
      className="mx-auto block h-auto w-full max-w-xs rounded-xl border shadow-sm"
    >
      <rect width="560" height={height} fill="#fff" />
      {decorated && (
        <>
          <rect width="560" height="14" fill={fields.accent} />
          <circle
            cx="18"
            cy="60"
            r="54"
            fill={fields.accent}
            fillOpacity="0.15"
          />
          <circle
            cx="555"
            cy="38"
            r="67"
            fill={fields.accent}
            fillOpacity="0.19"
          />
          <rect
            x="60"
            y="105"
            width="440"
            height="440"
            rx="28"
            fill="none"
            stroke={fields.accent}
            strokeWidth="4"
          />
          <text
            x="280"
            y="68"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize={headlineSize}
            fontWeight="700"
            fill="#191527"
          >
            {headline}
          </text>
          {fields.businessName && (
            <text
              x="280"
              y="94"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize="17"
              fill="#514c5e"
            >
              {bankName}
            </text>
          )}
        </>
      )}
      {/* The accent stays outside the white quiet zone around the modules. */}
      <QRCode
        x={(560 - qrSize) / 2}
        y={qrTop}
        size={qrSize}
        value={payload}
        fgColor={fields.ink}
        level={logo ? "H" : "L"}
      />
      {logo && (
        <>
          <rect
            x={logoX - 5}
            y={logoY - 5}
            width={logoSize + 10}
            height={logoSize + 10}
            rx="5"
            fill="#fff"
          />
          <image
            href={logo}
            x={logoX}
            y={logoY}
            width={logoSize}
            height={logoSize}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}
      {details && (
        <g
          textAnchor="middle"
          fill="#191527"
          fontFamily="system-ui, sans-serif"
        >
          {fields.name && (
            <text
              x="280"
              y="586"
              fontSize="21"
              textLength={fields.name.length > 32 ? 440 : undefined}
              lengthAdjust={
                fields.name.length > 32 ? "spacingAndGlyphs" : undefined
              }
            >
              {fields.name}
            </text>
          )}
          <text
            x="280"
            y={fields.name ? 626 : 610}
            fontSize="28"
            fontWeight="700"
            fontFamily="monospace"
          >
            {fields.account}
          </text>
          <text x="280" y={fields.name ? 659 : 651} fontSize="20">
            {amount}
          </text>
        </g>
      )}
    </svg>
  );
}

export async function downloadQrPng(
  artwork: SVGSVGElement,
  exportWidth: number,
) {
  const { width, height } = artwork.viewBox.baseVal;
  const svg = artwork.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("width", String(exportWidth));
  svg.setAttribute(
    "height",
    String(Math.round((height * exportWidth) / width)),
  );
  const image = new Image();
  image.src =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(new XMLSerializer().serializeToString(svg));
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot export QR image");
  context.drawImage(image, 0, 0);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `vietqr-${exportWidth}.png`;
  document.body.append(link);
  link.click();
  link.remove();
}

export const logoTypes = ["image/png", "image/jpeg", "image/svg+xml"];

export async function rasterizeLogo(file: File) {
  if (file.size > 3 * 1024 * 1024 || !logoTypes.includes(file.type)) {
    throw new Error("Unsupported logo");
  }
  const src = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    // SVG is decoded in image mode and embedded only as pixels.
    const scale = 256 / Math.max(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot read logo image");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(src);
  }
}
