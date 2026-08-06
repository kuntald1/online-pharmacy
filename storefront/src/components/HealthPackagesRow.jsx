import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { api } from "../api/client";

export default function HealthPackagesRow({ channel }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef(null);

  useEffect(() => {
    api.get(`/api/health-packages?channel=${channel}`).then(setPackages).finally(() => setLoading(false));
  }, [channel]);

  function scrollByCards(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.firstChild?.getBoundingClientRect().width || 220;
    el.scrollBy({ left: direction * (cardWidth + 16) * 2, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-72 rounded-card bg-bg animate-pulse" />
        ))}
      </div>
    );
  }

  // Nothing configured yet — render nothing rather than an empty section
  // with just a heading, same pattern as SpotlightRow/RelatedProductsRow.
  if (packages.length === 0) return null;

  // With only a handful of packages, the row leaves a large blank gap next
  // to the scroll arrow instead of looking like a full carousel. Repeating
  // the set to visually fill the row is exactly what the reference design
  // itself did (the same 3 packages shown 5 times) — not padding with fake
  // content, just presenting the real set more than once when there's
  // little of it. Keys are suffixed per repeat so React doesn't collide.
  const MIN_VISIBLE = 6;
  const display =
    packages.length < MIN_VISIBLE
      ? Array.from({ length: Math.ceil(MIN_VISIBLE / packages.length) }, (_, i) => i)
          .flatMap((rep) => packages.map((p) => ({ ...p, _repeatKey: `${p.id}-${rep}` })))
      : packages.map((p) => ({ ...p, _repeatKey: `${p.id}` }));

  return (
    <div className="relative group">
      <button
        onClick={() => scrollByCards(-1)}
        aria-label="Scroll left"
        className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white border border-border shadow-card items-center justify-center text-ink-soft hover:text-teal-dark hover:border-teal transition-colors"
      >
        <ChevronLeft size={18} />
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {display.map((pkg) => (
          <div key={pkg._repeatKey} className="w-56 shrink-0 snap-start bg-white border border-border rounded-card p-3">
            <div className="relative h-40 rounded-lg overflow-hidden bg-bg mb-3">
              <img src={pkg.image_url} alt={pkg.title} className="h-full w-full object-cover" />
              {pkg.is_popular && (
                <span className="absolute top-2 right-2 bg-teal text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                  POPULAR
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-ink leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">{pkg.title}</p>
            <div className="flex items-center justify-between">
              <div>
                {pkg.mrp && pkg.mrp > pkg.price && (
                  <span className="text-xs text-ink-soft line-through mr-1.5">₹{pkg.mrp}</span>
                )}
                <span className="font-display font-semibold text-ink">₹{pkg.price}</span>
              </div>
              <a
                href={pkg.link_url || "#"}
                target={pkg.link_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                aria-label={`View ${pkg.title}`}
                className="h-9 w-9 rounded-full bg-teal text-white flex items-center justify-center hover:bg-teal-dark transition-colors shrink-0"
              >
                <Eye size={16} />
              </a>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => scrollByCards(1)}
        aria-label="Scroll right"
        className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-white border border-border shadow-card items-center justify-center text-ink-soft hover:text-teal-dark hover:border-teal transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
