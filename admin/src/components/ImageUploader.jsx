import { useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Backend returns relative paths (/uploads/xyz.jpg) since it doesn't know
// its own public-facing URL — resolve to an absolute URL here so the
// storefront (a different origin) can actually load the image.
function toAbsoluteUrl(relativeUrl) {
  return `${API_BASE}${relativeUrl}`;
}

export default function ImageUploader({ value, onChange }) {
  const urls = value ? value.split(",").filter(Boolean) : [];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const token = localStorage.getItem("pillpoints_admin_token");
      const res = await fetch(`${API_BASE}/api/admin/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      const newUrls = data.map((f) => toAbsoluteUrl(f.url));
      onChange([...urls, ...newUrls].join(","));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAt(index) {
    const next = urls.filter((_, i) => i !== index);
    onChange(next.join(","));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        {urls.map((url, i) => (
          <div key={url + i} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border group">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 bg-ink/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <label className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-ink-soft hover:border-teal hover:text-teal cursor-pointer transition-colors">
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          <span className="text-[10px]">{uploading ? "…" : "Add"}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>
      {error && <p className="text-red text-xs mb-2">{error}</p>}
      <p className="text-xs text-ink-soft">JPEG, PNG, WebP, or GIF — up to 5MB each, 10 at a time.</p>
    </div>
  );
}
