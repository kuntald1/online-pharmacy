import { useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function toAbsoluteUrl(relativeUrl) {
  return `${API_BASE}${relativeUrl}`;
}

export default function SingleImageUploader({ value, onChange, label = "Image" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handleFile(fileList) {
    const file = fileList[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);

      const token = localStorage.getItem("pillpoints_admin_token");
      const res = await fetch(`${API_BASE}/api/admin/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      onChange(toAbsoluteUrl(data[0].url));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {value ? (
          <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border group">
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-0.5 right-0.5 bg-ink/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${label.toLowerCase()}`}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-0.5 text-ink-soft hover:border-teal hover:text-teal cursor-pointer transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="text-[9px]">{uploading ? "…" : "Upload"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files)}
              disabled={uploading}
            />
          </label>
        )}
        {value && (
          <label className="text-xs font-medium text-teal-dark hover:underline cursor-pointer">
            Replace
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files)}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      {error && <p className="text-red text-xs">{error}</p>}
    </div>
  );
}
