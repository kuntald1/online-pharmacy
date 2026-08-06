import { useState } from "react";

export function ClickableThumbnail({ src, alt = "", className = "h-9 w-9 rounded-lg object-cover bg-bg" }) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return <div className={className.replace("object-cover", "")} />;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-zoom-in shrink-0">
        <img src={src} alt={alt} className={className} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt={alt} className="max-h-[85vh] max-w-[85vw] rounded-lg shadow-card object-contain" />
        </div>
      )}
    </>
  );
}
