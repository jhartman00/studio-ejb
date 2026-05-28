"use client";

import { useRef, useState } from "react";

type Props = {
  area: "hero" | "gallery" | "about" | "general";
  value?: string;
  onChange: (v: { url: string; width: number | null; height: number | null }) => void;
};

const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.85;

async function readExifOrientation(blob: Blob): Promise<number> {
  // JPEG only. Returns 1 (default) for anything else.
  const head = await blob.slice(0, 64 * 1024).arrayBuffer();
  const view = new DataView(head);
  if (view.byteLength < 4) return 1;
  if (view.getUint16(0, false) !== 0xffd8) return 1; // not a JPEG

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      // APP1
      const size = view.getUint16(offset, false);
      offset += 2;
      // Skip 'Exif\0\0'
      if (view.byteLength < offset + 6) return 1;
      const exifHeader =
        view.getUint32(offset, false) === 0x45786966 &&
        view.getUint16(offset + 4, false) === 0;
      if (!exifHeader) return 1;
      const tiff = offset + 6;
      const little = view.getUint16(tiff, false) === 0x4949;
      const firstIfd = view.getUint32(tiff + 4, little);
      let dir = tiff + firstIfd;
      if (dir + 2 > view.byteLength) return 1;
      const count = view.getUint16(dir, little);
      dir += 2;
      for (let i = 0; i < count; i++) {
        const entry = dir + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        const tag = view.getUint16(entry, little);
        if (tag === 0x0112) {
          return view.getUint16(entry + 8, little) || 1;
        }
      }
      offset += size - 2;
    } else if ((marker & 0xff00) !== 0xff00) {
      return 1;
    } else {
      const size = view.getUint16(offset, false);
      offset += size;
    }
  }
  return 1;
}

function loadImage(blobUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = blobUrl;
  });
}

// Maps EXIF orientation -> the canvas operations needed to make the
// image render upright.
async function processImage(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const orient = file.type === "image/jpeg" ? await readExifOrientation(file) : 1;
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } finally {
    // we'll revoke after canvas draws
  }

  let drawW = img.naturalWidth;
  let drawH = img.naturalHeight;
  const swap = orient >= 5 && orient <= 8;
  let logicalW = swap ? drawH : drawW;
  let logicalH = swap ? drawW : drawH;

  // Downscale to MAX_EDGE on the longer side.
  const longEdge = Math.max(logicalW, logicalH);
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
  const targetW = Math.round(logicalW * scale);
  const targetH = Math.round(logicalH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // Apply EXIF orientation transform.
  switch (orient) {
    case 2: ctx.transform(-1, 0, 0, 1, targetW, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, targetW, targetH); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, targetH); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, targetW, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, targetW, targetH); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, targetH); break;
  }

  const drawDestW = swap ? targetH : targetW;
  const drawDestH = swap ? targetW : targetH;
  ctx.drawImage(img, 0, 0, drawDestW, drawDestH);
  URL.revokeObjectURL(url);

  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("canvas toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return { blob, width: targetW, height: targetH };
}

export default function ImageUploader({ area, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const processed = await processImage(file);
      const previewUrl = URL.createObjectURL(processed.blob);
      setPreview(previewUrl);

      const fd = new FormData();
      fd.append("file", new File([processed.blob], "upload.jpg", { type: "image/jpeg" }));
      fd.append("area", area);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const j = (await res.json()) as {
        url: string;
        width: number | null;
        height: number | null;
      };
      onChange(j);
      setPreview(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-uploader">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="image-uploader-preview" />
      ) : (
        <div className="image-uploader-empty">No image yet</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <div className="image-uploader-actions">
        <button
          type="button"
          className="btn"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading..." : preview ? "Replace image" : "Choose image"}
        </button>
        {preview ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={uploading}
            onClick={() => {
              setPreview(null);
              onChange({ url: "", width: null, height: null });
            }}
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="form-error" role="alert">
          {error}
          <button
            type="button"
            className="btn"
            style={{ marginLeft: "var(--s-12)" }}
            onClick={() => inputRef.current?.click()}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
