import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCart } from "../context/CartContext";
import { api } from "../api/client";

/** The current product is always item #1 (pre-checked, can't be unchecked —
 * you're already looking at it). Curated companions load from the fbt
 * relation type and are pre-checked too, matching the familiar
 * "everything's selected, uncheck what you don't want" pattern. */
export default function FrequentlyBoughtTogether({ product, channel }) {
  const { addItem } = useCart();
  const [companions, setCompanions] = useState(null);
  const [checked, setChecked] = useState({}); // productId -> bool
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api
      .get(`/api/products/${product.slug}/related?type=fbt&channel=${channel}`)
      .then((rows) => {
        setCompanions(rows);
        setChecked((c) => ({ [product.id]: true, ...Object.fromEntries(rows.map((r) => [r.id, true])) }));
      })
      .catch(() => setCompanions([]));
  }, [product.slug, product.id, channel]);

  if (!companions || companions.length === 0) return null;

  const currentPricing =
    product.pricing.find((p) => p.channel === channel) ||
    product.pricing.find((p) => p.channel === "b2b_normal") ||
    product.pricing[0];
  const items = [
    { id: product.id, slug: product.slug, name: product.name, image_url: product.image_urls?.split(",")[0], price: currentPricing?.price, mrp: currentPricing?.mrp, min_quantity: currentPricing?.min_quantity, isCurrent: true },
    ...companions,
  ];

  const selected = items.filter((it) => checked[it.id]);
  const total = selected.reduce((sum, it) => sum + (it.price || 0), 0);
  const totalMrp = selected.reduce((sum, it) => sum + (it.mrp || it.price || 0), 0);
  const discountPct = totalMrp > total ? Math.round(((totalMrp - total) / totalMrp) * 100) : null;

  function toggle(id) {
    if (id === product.id) return; // current product can't be unchecked
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  function addAllSelected() {
    selected.forEach((it) => {
      if (it.price == null) return;
      addItem(
        { id: it.id, slug: it.slug, name: it.name, image_urls: it.image_url },
        { channel, price: it.price },
        channel,
        it.min_quantity || 1
      );
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <h2 className="font-display font-semibold text-base text-ink mb-4">Frequently bought together</h2>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-3">
            {i > 0 && <Plus size={16} className="text-ink-soft shrink-0" />}
            <label className="flex flex-col items-center gap-1.5 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={!!checked[it.id]}
                  onChange={() => toggle(it.id)}
                  disabled={it.isCurrent}
                  className="absolute -top-1 -left-1 z-10 h-4 w-4"
                />
                <div className="h-20 w-20 rounded-lg bg-bg overflow-hidden border border-border">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <span className="text-[10px] text-ink-soft">No image</span>
                    </div>
                  )}
                </div>
              </div>
              {it.isCurrent ? (
                <span className="text-xs text-ink-soft text-center w-20 line-clamp-2">{it.name}</span>
              ) : (
                <Link to={`/${channel}/product/${it.slug}`} className="text-xs text-[#02696B] hover:underline text-center w-20 line-clamp-2">
                  {it.name}
                </Link>
              )}
            </label>
          </div>
        ))}
      </div>

      <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-ink">
          Total for {selected.length} item{selected.length !== 1 ? "s" : ""}{" "}
          <span className="font-display font-semibold">₹{total}</span>
          {discountPct && (
            <>
              {" "}
              <span className="text-ink-soft line-through">₹{totalMrp}</span>{" "}
              <span className="text-teal-dark">{discountPct}% off</span>
            </>
          )}
        </p>
        <button
          onClick={addAllSelected}
          disabled={selected.length === 0}
          className="bg-teal text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
        >
          {added ? "Added ✓" : `Add ${selected.length > 1 ? "all" : ""} to cart`}
        </button>
      </div>
    </div>
  );
}
