import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function ProductCard({ product, channel }) {
  const { addItem } = useCart();
  // A grid card shows one price. For "b2b" (generic — the backend returns
  // both tiers' pricing for this request), default to the Normal tier as
  // the representative figure; the full breakdown of both tiers lives on
  // the product detail page, not squeezed into a compact card.
  const pricing =
    product.pricing.find((p) => p.channel === channel) ||
    product.pricing.find((p) => p.channel === "b2b_normal") ||
    product.pricing[0];
  if (!pricing) return null;

  const discountPct = pricing.mrp && pricing.mrp > pricing.price
    ? Math.round(((pricing.mrp - pricing.price) / pricing.mrp) * 100)
    : null;
  const outOfStock = pricing.stock === 0;

  return (
    <div className="bg-white border border-border rounded-card p-4 flex flex-col hover:shadow-card transition-shadow relative">
      {outOfStock ? (
        <span className="absolute top-3 left-3 bg-ink-soft text-white text-[10px] font-semibold px-2 py-0.5 rounded-full z-10">
          Sold Out
        </span>
      ) : discountPct && (
        <span className="absolute top-3 left-3 bg-teal text-white text-[10px] font-semibold px-2 py-0.5 rounded-full z-10">
          {discountPct}% OFF
        </span>
      )}
      <Link to={`/${channel}/product/${product.slug}`} className="block">
        <div className={`h-28 rounded-lg bg-bg mb-3 overflow-hidden ${outOfStock ? "opacity-50" : ""}`}>
          {product.image_urls ? (
            <img
              src={product.image_urls.split(",")[0]}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-xs text-ink-soft">No image</span>
            </div>
          )}
        </div>
        <p className="text-sm text-ink font-medium leading-snug mb-1 line-clamp-2 min-h-[2.5rem] hover:text-[#02696B] transition-colors">
          {product.name}
        </p>
      </Link>
      {channel !== "b2c" && (
        <p className="text-xs text-ink-soft mb-1">MOQ: {pricing.min_quantity} units</p>
      )}
      <div className="flex items-baseline gap-1.5 mb-3 mt-auto">
        <span className="font-display font-semibold text-ink">₹{pricing.price}</span>
        {pricing.mrp && pricing.mrp > pricing.price && (
          <span className="text-xs text-ink-soft line-through">₹{pricing.mrp}</span>
        )}
      </div>
      <button
        onClick={() => addItem(product, pricing, channel, pricing.min_quantity || 1)}
        disabled={outOfStock}
        className="w-full bg-teal text-white text-xs font-medium py-2 rounded-lg hover:bg-teal-dark transition-colors disabled:bg-teal/40 disabled:cursor-not-allowed"
      >
        {outOfStock ? "Sold Out" : pricing.min_quantity > 1 ? `Add ${pricing.min_quantity} to Cart` : "Add to Cart"}
      </button>
    </div>
  );
}
