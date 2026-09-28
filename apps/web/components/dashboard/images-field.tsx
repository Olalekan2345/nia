"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button, Input, cn } from "@nia/ui";

const MAX_PHOTOS = 8;

/** Shrink in the browser first: phone photos are often 3–8 MB and uploads are capped at 4 MB. */
async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn’t read “${file.name}”. Use a JPEG, PNG or WebP photo.`);
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t prepare that photo."))), "image/jpeg", 0.86));
}

/** Product photos: upload from the device or paste a link; the first photo is the main one. */
export function ImagesField({ merchantId, value, onChange }: { merchantId: string; value: string[]; onChange: (next: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - value.length)) {
        const body = new FormData();
        body.set("merchantId", merchantId);
        body.set("file", await shrink(file), "photo.jpg");
        const res = await fetch("/api/media", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Please try again.");
        added.push(json.url);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (added.length) onChange([...value, ...added]);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const addLink = () => {
    const url = link.trim();
    if (!/^https:\/\/\S+$/.test(url)) return setError("Paste a full https:// link to an image.");
    setError(null);
    onChange([...value, url].slice(0, MAX_PHOTOS));
    setLink("");
  };

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-3" aria-label="Photos">
        {value.map((src, i) => (
          <li key={`${src}-${i}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- merchant photos, any host */}
            <img src={src} alt={i === 0 ? "Main photo" : `Photo ${i + 1}`} className={cn("size-24 rounded-xl border object-cover", i === 0 ? "border-accent" : "border-border")} />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">Main</span>
            ) : (
              <button
                type="button"
                onClick={() => onChange([src, ...value.filter((_, j) => j !== i)])}
                className="absolute bottom-1 left-1 grid size-7 place-items-center rounded-md bg-background/90 text-muted-foreground hover:text-foreground"
                aria-label={`Make photo ${i + 1} the main photo`}
              >
                <Star className="size-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-float hover:text-danger"
              aria-label={`Remove photo ${i + 1}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
        {value.length < MAX_PHOTOS ? (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors duration-100 hover:border-accent hover:text-accent-strong disabled:opacity-60"
            >
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                {busy ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
                {busy ? "Uploading…" : "Add photos"}
              </span>
            </button>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" tabIndex={-1} aria-label="Upload photos" onChange={(e) => upload(e.target.files)} />
          </li>
        ) : null}
      </ul>
      <div className="flex gap-2">
        <label htmlFor="image-link" className="sr-only">
          Image link
        </label>
        <Input
          id="image-link"
          type="url"
          inputMode="url"
          placeholder="…or paste an https:// image link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLink();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={addLink} disabled={!link.trim()}>
          Add link
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Up to {MAX_PHOTOS} photos. The first is the main one. Photos are resized and their location data removed.</p>
      )}
    </div>
  );
}
