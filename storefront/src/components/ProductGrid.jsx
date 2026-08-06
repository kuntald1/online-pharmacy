import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import { api } from "../api/client";

export default function ProductGrid({ channel }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef(null);

  useEffect(() => {
    api.get(`/api/products?channel=${channel}`).then(setProducts).finally(() => setLoading(false));
  }, [channel]);

  function scrollByCards(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.firstChild?.getBoundingClientRect().width || 200;
    el.scrollBy({ left: direction * (cardWidth + 16) * 2, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-card bg-bg animate-pulse" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return <p className="text-sm text-ink-soft">No products added for this channel yet — add some from the admin panel.</p>;
  }

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
        {products.slice(0, 20).map((product) => (
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
  );
}
