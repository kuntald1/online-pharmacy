import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function HeroSlider({ channel }) {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cms, setCms] = useState({});

  useEffect(() => {
    api
      .get(`/api/banners?channel=${channel}&position=hero`)
      .then(setBanners)
      .finally(() => setLoading(false));
    // Same public settings endpoint Logo.jsx already uses — no auth needed,
    // just the CMS-editable homepage hero title/subtitle (Admin → CMS).
    fetch(`${API_BASE}/api/settings/public`)
      .then((res) => (res.ok ? res.json() : {}))
      .then(setCms)
      .catch(() => {});
  }, [channel]);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (loading) {
    return <div className="h-64 sm:h-80 rounded-card bg-bg animate-pulse" />;
  }

  if (banners.length === 0) {
    return (
      <div className="h-64 sm:h-80 rounded-card bg-gradient-to-br from-blue-light to-teal-light flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <p className="text-xs text-ink-soft mb-2">No hero banner set yet</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink mb-2">
            {cms.homepage_hero_title || "Your Trusted Partner in Better Health"}
          </h2>
          <p className="text-sm text-ink-soft">
            {cms.homepage_hero_subtitle || "Add a hero banner from the admin panel to replace this placeholder."}
          </p>
        </div>
      </div>
    );
  }

  const banner = banners[index];
  const hasCaption = cms.homepage_hero_title || cms.homepage_hero_subtitle;

  return (
    <div className="relative h-64 sm:h-80 rounded-card overflow-hidden bg-bg">
      <a href={banner.link_url || "#"} className="block h-full w-full">
        <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover" />
      </a>

      {/* Only rendered when the CMS field is actually filled in — an admin
          who never touches this setting should see their banner exactly as
          uploaded, with no empty/dead overlay box sitting on top of it. */}
      {hasCaption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 via-ink/30 to-transparent px-5 pt-10 pb-4 pointer-events-none">
          {cms.homepage_hero_title && (
            <h2 className="font-display font-bold text-lg sm:text-2xl text-white drop-shadow">{cms.homepage_hero_title}</h2>
          )}
          {cms.homepage_hero_subtitle && (
            <p className="text-xs sm:text-sm text-white/90 mt-1 drop-shadow">{cms.homepage_hero_subtitle}</p>
          )}
        </div>
      )}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-card"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % banners.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-card"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
