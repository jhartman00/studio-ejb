import { put } from "@vercel/blob";
import { ulid } from "ulid";
import { sql } from "@/lib/db";

export type SniffedType =
  | { kind: "jpeg"; ext: "jpg"; mime: "image/jpeg" }
  | { kind: "png"; ext: "png"; mime: "image/png" }
  | { kind: "webp"; ext: "webp"; mime: "image/webp" };

// Sniff JPEG, PNG, or WebP from the first 12 bytes. Returns null on any
// other content. Never trust the Content-Type header; this is the only
// allow-list.
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "jpeg", ext: "jpg", mime: "image/jpeg" };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { kind: "png", ext: "png", mime: "image/png" };
  }
  // RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { kind: "webp", ext: "webp", mime: "image/webp" };
  }
  return null;
}

// Best-effort intrinsic dimensions from raw image bytes. Implements only
// the three formats we accept. Returns null if the header doesn't parse.
export function readImageDimensions(
  bytes: Uint8Array,
  type: SniffedType,
): { width: number; height: number } | null {
  try {
    if (type.kind === "png") {
      // IHDR is at offset 16 (after 8-byte signature + 4-byte length + 4-byte type)
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      return { width, height };
    }
    if (type.kind === "jpeg") {
      // Walk JPEG markers until SOF (0xC0..0xCF except 0xC4, 0xC8, 0xCC).
      let i = 2;
      while (i + 8 < bytes.length) {
        if (bytes[i] !== 0xff) break;
        const marker = bytes[i + 1]!;
        const isSof =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc;
        const segLen = (bytes[i + 2]! << 8) | bytes[i + 3]!;
        if (isSof) {
          const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
          const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
          return { width, height };
        }
        i += 2 + segLen;
      }
      return null;
    }
    if (type.kind === "webp") {
      // VP8L starts at offset 12 with chunk fourcc.
      // For VP8L: bytes 21-23 contain width-1 and height-1 packed
      // For VP8 : bytes 26-29 contain width/height
      const fourcc = String.fromCharCode(
        bytes[12]!,
        bytes[13]!,
        bytes[14]!,
        bytes[15]!,
      );
      if (fourcc === "VP8L") {
        const b0 = bytes[21]!;
        const b1 = bytes[22]!;
        const b2 = bytes[23]!;
        const b3 = bytes[24]!;
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      }
      if (fourcc === "VP8 ") {
        const width = (bytes[26]! | (bytes[27]! << 8)) & 0x3fff;
        const height = (bytes[28]! | (bytes[29]! << 8)) & 0x3fff;
        return { width, height };
      }
      if (fourcc === "VP8X") {
        const width =
          1 +
          ((bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) & 0xffffff);
        const height =
          1 +
          ((bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) & 0xffffff);
        return { width, height };
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function uploadImage(opts: {
  bytes: Uint8Array;
  area: string;
  originalFilename?: string | null;
}): Promise<{ url: string; width: number | null; height: number | null }> {
  const type = sniffImageType(opts.bytes);
  if (!type) throw new Error("not a supported image type");
  const dims = readImageDimensions(opts.bytes, type);

  const filename = `${opts.area}/${ulid()}.${type.ext}`;
  // Pass bytes directly — @vercel/blob accepts Uint8Array via Blob conversion.
  const blob = new Blob([opts.bytes as BlobPart], { type: type.mime });
  const result = await put(filename, blob, {
    access: "public",
    contentType: type.mime,
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await sql`
    insert into uploads (url, area, original_filename, created_at)
    values (${result.url}, ${opts.area}, ${opts.originalFilename ?? null}, now())
  `;

  return {
    url: result.url,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  };
}
