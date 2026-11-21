import Image from "next/image";

import { isBlogMediaUrl } from "@/lib/blog/links";
import { cn } from "@/lib/utils";

/**
 * A post's cover at the 1.91:1 ratio social cards use, through next/image.
 *
 * Only for files on the media host: next/image throws on a host missing from
 * images.remotePatterns, and one bad URL must not take the page down. A local
 * MinIO origin (http) is shown unoptimized, since the optimizer refuses to
 * fetch from private addresses.
 */
export function BlogCover({
  src,
  alt,
  sizes,
  preload = false,
  className,
}: {
  src: string | null;
  alt: string | null;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  if (!isBlogMediaUrl(src)) return null;
  return (
    <div
      className={cn(
        "relative aspect-[1.91/1] overflow-hidden bg-muted/30",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt ?? ""}
        fill
        sizes={sizes}
        preload={preload}
        unoptimized={src.startsWith("http:")}
        className="object-cover"
      />
    </div>
  );
}
