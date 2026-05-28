"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type Props = {
  area: "hero" | "gallery" | "about" | "general";
  value?: string;
  onChange: (v: {
    url: string;
    width: number | null;
    height: number | null;
    filename?: string;
  }) => void;
};

const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.85;

type AspectChoice = "free" | "1:1" | "4:5" | "3:4";
const ASPECT_VALUES: Record<AspectChoice, number | undefined> = {
  free: undefined,
  "1:1": 1,
  "4:5": 4 / 5,
  "3:4": 3 / 4,
};

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Decode + EXIF auto-rotate into a normalized PNG-ish blob URL the editor
// can display without further orientation handling.
async function decodeToUpright(
  file: File,
): Promise<{ url: string; width: number; height: number }> {
  const orient = file.type === "image/jpeg" ? await readExifOrientation(file) : 1;
  const sourceUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(sourceUrl);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }

  const swap = orient >= 5 && orient <= 8;
  const logicalW = swap ? img.naturalHeight : img.naturalWidth;
  const logicalH = swap ? img.naturalWidth : img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = logicalW;
  canvas.height = logicalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  switch (orient) {
    case 2: ctx.transform(-1, 0, 0, 1, logicalW, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, logicalW, logicalH); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, logicalH); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, logicalW, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, logicalW, logicalH); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, logicalH); break;
  }
  const drawW = swap ? logicalH : logicalW;
  const drawH = swap ? logicalW : logicalH;
  ctx.drawImage(img, 0, 0, drawW, drawH);

  const blob: Blob = await new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("canvas toBlob returned null"))),
      "image/png",
    );
  });
  return {
    url: URL.createObjectURL(blob),
    width: logicalW,
    height: logicalH,
  };
}

// Bake user rotation + crop into a final JPEG, downscaled to MAX_EDGE.
async function bakeCroppedJpeg(
  imageSrc: string,
  croppedAreaPixels: Area,
  rotationDeg: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(imageSrc);
  const rad = (rotationDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const rotatedW = img.naturalWidth * cos + img.naturalHeight * sin;
  const rotatedH = img.naturalWidth * sin + img.naturalHeight * cos;

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = Math.round(rotatedW);
  rotatedCanvas.height = Math.round(rotatedH);
  const rctx = rotatedCanvas.getContext("2d");
  if (!rctx) throw new Error("canvas 2d context unavailable");
  rctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const cropW = Math.max(1, Math.round(croppedAreaPixels.width));
  const cropH = Math.max(1, Math.round(croppedAreaPixels.height));
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cctx = cropCanvas.getContext("2d");
  if (!cctx) throw new Error("canvas 2d context unavailable");
  cctx.drawImage(
    rotatedCanvas,
    Math.round(croppedAreaPixels.x),
    Math.round(croppedAreaPixels.y),
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH,
  );

  const longEdge = Math.max(cropW, cropH);
  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
  const finalW = Math.max(1, Math.round(cropW * scale));
  const finalH = Math.max(1, Math.round(cropH * scale));

  let finalCanvas = cropCanvas;
  if (scale < 1) {
    finalCanvas = document.createElement("canvas");
    finalCanvas.width = finalW;
    finalCanvas.height = finalH;
    const fctx = finalCanvas.getContext("2d");
    if (!fctx) throw new Error("canvas 2d context unavailable");
    fctx.drawImage(cropCanvas, 0, 0, finalW, finalH);
  }

  const blob: Blob = await new Promise((res, rej) => {
    finalCanvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("canvas toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  return { blob, width: finalW, height: finalH };
}

export default function ImageUploader({ area, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorFilename, setEditorFilename] = useState<string>("");
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectChoice, setAspectChoice] = useState<AspectChoice>("free");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    return () => {
      if (editorSrc) URL.revokeObjectURL(editorSrc);
    };
  }, [editorSrc]);

  const onCropComplete = useCallback((_a: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function resetEditorState() {
    setRotation(0);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectChoice("free");
    setCroppedAreaPixels(null);
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const decoded = await decodeToUpright(file);
      if (editorSrc) URL.revokeObjectURL(editorSrc);
      setEditorSrc(decoded.url);
      setEditorFilename(file.name);
      resetEditorState();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function discardEditor() {
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
    setEditorFilename("");
    resetEditorState();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function commitEditor() {
    if (!editorSrc) return;
    setUploading(true);
    setError(null);
    try {
      const area_ = croppedAreaPixels;
      const baked = area_
        ? await bakeCroppedJpeg(editorSrc, area_, rotation)
        : await (async () => {
            const img = await loadImage(editorSrc);
            return bakeCroppedJpeg(
              editorSrc,
              { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
              rotation,
            );
          })();

      const fd = new FormData();
      fd.append(
        "file",
        new File([baked.blob], "upload.jpg", { type: "image/jpeg" }),
      );
      fd.append("area", area);
      if (editorFilename) fd.append("filename", editorFilename);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const j = (await res.json()) as {
        url: string;
        width: number | null;
        height: number | null;
      };
      onChange({ ...j, filename: editorFilename || undefined });
      setPreview(j.url);
      discardEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  if (editorSrc) {
    return (
      <div className="image-uploader">
        <div className="image-editor-stage">
          <Cropper
            image={editorSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={ASPECT_VALUES[aspectChoice]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid
            restrictPosition={false}
          />
        </div>
        <div className="image-editor-controls">
          <div className="image-editor-row">
            <span className="image-editor-label">Rotate</span>
            <button
              type="button"
              className="btn btn-small"
              disabled={uploading}
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              aria-label="Rotate left 90 degrees"
            >
              ⟲ Left
            </button>
            <button
              type="button"
              className="btn btn-small"
              disabled={uploading}
              onClick={() => setRotation((r) => (r + 90) % 360)}
              aria-label="Rotate right 90 degrees"
            >
              ⟳ Right
            </button>
          </div>
          <div className="image-editor-row">
            <span className="image-editor-label">Crop</span>
            {(Object.keys(ASPECT_VALUES) as AspectChoice[]).map((a) => (
              <button
                key={a}
                type="button"
                className={`chip${aspectChoice === a ? " is-active" : ""}`}
                aria-pressed={aspectChoice === a}
                onClick={() => {
                  setAspectChoice(a);
                  setCrop({ x: 0, y: 0 });
                  setZoom(1);
                }}
                disabled={uploading}
              >
                {a === "free" ? "Free" : a}
              </button>
            ))}
          </div>
          <div className="image-editor-actions">
            <button
              type="button"
              className="btn"
              onClick={commitEditor}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Use this"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={discardEditor}
              disabled={uploading}
            >
              Pick another
            </button>
          </div>
          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    );
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
