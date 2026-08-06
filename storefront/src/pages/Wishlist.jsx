import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Heart } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useCart } from "../context/CartContext";
import { api } from "../api/client";

export default function Wishlist() {
  const { channelParam } = useParams();
  const channel = channelParam || "b2c";
  const { addItem } = useCart();
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.get(`/api/wishlist?channel=${channel}`).then(setItems).catch(() => setItems([]));
  }

  useEffect(load, [channel]);

  async function remove(productId) {
    setBusyId(productId);
    try {
      await api.delete(`/api/wishlist/${productId}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <h1 className="font-display font-bold text-2xl text-ink mb-6">Saved for later</h1>

        {items === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-64 rounded-card bg-bg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Heart size={40} className="text-border mx-auto mb-3" />
            <p className="text-sm text-ink-soft mb-4">Nothing saved yet — tap the heart icon on any product to save it here.</p>
            <Link to={`/${channel}`} className="text-sm font-medium text-[#02696B] hover:underline">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {items.map((p) => {
              const discountPct = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : null;
              return (
                <div key={p.id} className="bg-white border border-border rounded-card p-4 flex flex-col relative">
                  {discountPct && (
                    <span className="absolute top-3 left-3 bg-teal text-white text-[10px] font-semibold px-2 py-0.5 rounded-full z-10">
                      {discountPct}% OFF
                    </span>
                  )}
                  <button
                    onClick={() => remove(p.id)}
                    disabled={busyId === p.id}
                    aria-label="Remove from saved"
                    className="absolute top-3 right-3 text-red hover:opacity-70 disabled:opacity-40 z-10"
                  >
                    <Heart size={18} className="fill-red" />
                  </button>
                  <Link to={`/${channel}/product/${p.slug}`} className="block">
                    <div className="h-28 rounded-lg bg-bg mb-3 overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-xs text-ink-soft">No image</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-ink font-medium leading-snug mb-1 line-clamp-2 min-h-[2.5rem] hover:text-[#02696B] transition-colors">
                      {p.name}
                    </p>
                  </Link>
                  <div className="flex items-baseline gap-1.5 mb-3 mt-auto">
                    {p.price != null ? (
                      <>
                        <span className="font-display font-semibold text-ink">₹{p.price}</span>
                        {p.mrp && p.mrp > p.price && <span className="text-xs text-ink-soft line-through">₹{p.mrp}</span>}
                      </>
                    ) : (
                      <span className="text-xs text-ink-soft">Not available on this channel</span>
                    )}
                  </div>
                  <button
                    onClick={() => p.price != null && addItem({ id: p.id, slug: p.slug, name: p.name, image_urls: p.image_url }, { channel, price: p.price }, channel, p.min_quantity || 1)}
                    disabled={p.price == null || p.stock === 0}
                    className="w-full bg-teal text-white text-xs font-medium py-2 rounded-lg hover:bg-teal-dark transition-colors disabled:bg-teal/40 disabled:cursor-not-allowed"
                  >
                    {p.stock === 0 ? "Sold Out" : "Add to Cart"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer channel={channel} />
    </div>
  );
}
