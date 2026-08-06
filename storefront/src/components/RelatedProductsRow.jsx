import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api/client";

/** Renders nothing when there are no curated relations for this type — same
 * reasoning as SpotlightRow: an empty "Similar products" section with a
 * placeholder message is worse than no section at all. */
export default function RelatedProductsRow({ title, slug, channel, relationType }) {
  const [products, setProducts] = useState(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    api
      .get(`/api/products/${slug}/related?type=${relationType}&channel=${channel}`)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [slug, channel, relationType]);

  function scrollByCards(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.firstChild?.getBoundingClientRect().width || 200;
    el.scrollBy({ left: direction * (cardWidth + 16) * 2, behavior: "smooth" });
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <h2 className="font-display font-semibold text-base text-ink mb-4">{title}</h2>

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
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/${channel}/product/${p.slug}`}
              className="w-40 sm:w-48 shrink-0 snap-start bg-white border border-border rounded-card p-4 hover:shadow-card transition-shadow"
            >
              <div className="h-28 rounded-lg bg-bg mb-3 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-xs text-ink-soft">No image</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-ink font-medium leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">{p.name}</p>
              {p.price != null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display font-semibold text-ink">₹{p.price}</span>
                  {p.mrp && p.mrp > p.price && <span className="text-xs text-ink-soft line-through">₹{p.mrp}</span>}
                </div>
              )}
            </Link>
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
    </div>
  );
}
