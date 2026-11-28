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
};

export function QrArtwork({
  artworkRef,
  payload,
  fields,
  bankName,
  title,
  amount,
}: QrArtworkProps) {
  const decorated = fields.template !== "qr-only";
  const details = fields.template === "details";
  const headline = fields.businessName || bankName;
  const headlineSize = Math.min(28, 440 / Array.from(headline).length);
  const height = details ? 694 : 560;

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
        x={decorated ? 112 : 72}
        y={decorated ? 157 : 72}
        size={decorated ? 336 : 416}
        value={payload}
      />
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

export async function downloadQrPng(artwork: SVGSVGElement) {
  const { width, height } = artwork.viewBox.baseVal;
  const svg = artwork.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("width", String(width * 3));
  svg.setAttribute("height", String(height * 3));
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
  link.download = "vietqr.png";
  document.body.append(link);
  link.click();
  link.remove();
}
