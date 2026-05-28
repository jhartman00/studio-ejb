import Image from "next/image";

// Renders a remote Vercel Blob image with next/image when possible,
// falls back to a plain <img> for data: URIs (used by the seed
// placeholders). Width/height come from the DB row so the box is
// reserved before the image loads.

type Props = {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

export default function SafeImage({
  src,
  alt,
  width,
  height,
  sizes,
  className,
  priority,
}: Props) {
  if (!src) return null;
  const w = width ?? 1200;
  const h = height ?? 1200;

  const isData = src.startsWith("data:");
  if (isData) {
    return (
      <img
        src={src}
        alt={alt}
        width={w}
        height={h}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}
