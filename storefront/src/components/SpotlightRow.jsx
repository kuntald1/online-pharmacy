import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import { api } from "../api/client";

/** Admin-curated "In the Spotlight" promo carousel. Unlike ProductGrid, this
 * renders nothing at all when there's nothing to show — a PDP shouldn't have
 * an empty "In the Spotlight" section with a placeholder message just
 * because no products happen to be spotlighted right now. */
export default function SpotlightRow({ channel, excludeSlug }) {
  const [products, setProducts] = useState(null); // null = still loading
  const scrollerRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams({ channel, spotlight_only: "true" });
    if (excludeSlug) params.set("exclude_slug", excludeSlug);
    api
      .get(`/api/products?${params.toString()}`)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [channel, excludeSlug]);

  function scrollByCards(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.firstChild?.getBoundingClientRect().width || 200;
    el.scrollBy({ left: direction * (cardWidth + 16) * 2, behavior: "smooth" });
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display font-semibold text-base text-ink">In the Spotlight</h2>
        <span className="text-[10px] font-medium text-ink-soft border border-border rounded px-1.5 py-0.5">Ad</span>
      </div>

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
          {products.map((product) => (
            <div key={product.id} className="w-40 sm:w-48 shrink-0 snap-start">
              <ProductCard product={product} channel={channel} />
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
    </div>
  );
}
