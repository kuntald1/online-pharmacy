import { useRef, useState } from "react";

export default function ImageMagnifier({ src, alt, className = "h-96" }) {
  const [showZoom, setShowZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const containerRef = useRef(null);

  function handleMouseMove(e) {
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  const LENS_SIZE = 32; // % of container width/height

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`${className} rounded-card bg-bg overflow-hidden relative cursor-crosshair`}
        onMouseEnter={() => setShowZoom(true)}
        onMouseLeave={() => setShowZoom(false)}
        onMouseMove={handleMouseMove}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover" />
        {showZoom && (
          <div
            data-testid="magnifier-lens"
            className="absolute border-2 border-white bg-white/25 pointer-events-none shadow-card"
            style={{
              width: `${LENS_SIZE}%`,
              height: `${LENS_SIZE}%`,
              left: `calc(${pos.x}% - ${LENS_SIZE / 2}%)`,
              top: `calc(${pos.y}% - ${LENS_SIZE / 2}%)`,
            }}
          />
        )}
      </div>

      {showZoom && (
        <div
          data-testid="magnifier-panel"
          className="hidden lg:block absolute top-0 left-[calc(100%+16px)] w-full max-w-md aspect-square rounded-card border border-border shadow-card bg-white z-30 overflow-hidden"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "250%",
            backgroundPosition: `${pos.x}% ${pos.y}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
    </div>
  );
}
