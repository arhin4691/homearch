"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Button } from "./Button";
import { useToast } from "./Toast";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string, fileId: string) => void;
  onClear?: () => void;
  folder?: string;
  label?: string;
  cropToSquare?: boolean;
}

function centerCropSquare(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        size,
        size,
      );
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
          else resolve(file);
        },
        "image/jpeg",
        0.92,
      );
    };
    img.src = objectUrl;
  });
}

export function ImageUpload({ value, onChange, onClear, folder = "/homearch", label, cropToSquare }: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const upload = useCallback(
    async (file: File) => {
      setLoading(true);
      try {
        // Get auth params
        const authRes = await fetch("/api/imagekit/auth");
        const auth = await authRes.json();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("folder", folder);
        formData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!);
        formData.append("signature", auth.data.signature);
        formData.append("expire", auth.data.expire.toString());
        formData.append("token", auth.data.token);

        const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");
        const result = await uploadRes.json();
        onChange(result.url, result.fileId);
      } catch (e) {
        showToast("Image upload failed", "error");
      } finally {
        setLoading(false);
      }
    },
    [folder, onChange, showToast]
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toUpload = cropToSquare ? await centerCropSquare(file) : file;
    upload(toUpload);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-[var(--foreground)]">{label}</label>}
      {value ? (
        <div className={`relative w-full rounded-xl overflow-hidden border border-[var(--card-border)] ${cropToSquare ? "aspect-square" : "h-48"}`}>
          <Image src={value} alt="Uploaded" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className={`w-full rounded-xl border-2 border-dashed border-[var(--card-border)] hover:border-[#7dc0ff] bg-[var(--card)] flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group ${cropToSquare ? "aspect-square" : "h-48"}`}
        >
          {loading ? (
            <Loader2 className="h-8 w-8 text-[#7dc0ff] animate-spin" />
          ) : (
            <>
              <div className="p-3 rounded-xl bg-[#7dc0ff]/10 group-hover:bg-[#7dc0ff]/20 transition-colors">
                <Upload className="h-6 w-6 text-[#7dc0ff]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">Click to upload</p>
                <p className="text-xs text-[var(--muted)]">PNG, JPG, WEBP up to 10MB</p>
              </div>
            </>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
