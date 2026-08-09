import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Heart, Share2, Check } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { resolveImageUrl } from "../utils/media";
import ImageMagnifier from "../components/ImageMagnifier";
import SpotlightRow from "../components/SpotlightRow";
import ReviewsSection from "../components/ReviewsSection";
import FrequentlyBoughtTogether from "../components/FrequentlyBoughtTogether";
import RelatedProductsRow from "../components/RelatedProductsRow";
import CouponsRow from "../components/CouponsRow";
import DeliverToRow from "../components/DeliverToRow";
import LoginModal from "../components/LoginModal";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function ProductDetail() {
  const { channelParam, slug } = useParams();
  const channel = channelParam || "b2c";
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isLoggedIn } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [variants, setVariants] = useState([]);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [quantities, setQuantities] = useState({}); // channel -> quantity, e.g. { b2b_normal: 20 }
  const [addedTier, setAddedTier] = useState(null); // which tier's button last showed "Added ✓"
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setActiveImage(0);
    api
      .get(`/api/products/${slug}?channel=${channel}`)
      .then((p) => {
        setProduct(p);
        setQuantities(Object.fromEntries(p.pricing.map((pr) => [pr.channel, pr.min_quantity || 1])));
        if (isLoggedIn) {
          api.get(`/api/wishlist/status/${p.id}`).then((r) => setSaved(r.is_saved)).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
    // Variants are fetched independently of the main product call and fail
    // silently to [] — a size-picker that doesn't load shouldn't block the
    // rest of the page from rendering.
    api
      .get(`/api/products/${slug}/variants?channel=${channel}`)
      .then(setVariants)
      .catch(() => setVariants([]));
  }, [slug, channel]);

  async function toggleSave() {
    if (!isLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
    setSaveBusy(true);
    try {
      if (saved) {
        await api.delete(`/api/wishlist/${product.id}`);
        setSaved(false);
      } else {
        await api.post("/api/wishlist", { product_id: product.id });
        setSaved(true);
      }
    } catch {
      // silently ignore — the button just stays in its current state, no need to alarm the user over a save/unsave hiccup
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleShare() {
    const shareData = { title: product.name, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the native share sheet — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {
      // clipboard access denied — nothing more we can do here
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="h-96 rounded-card bg-bg animate-pulse" />
        </main>
        <Footer channel={channel} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
          <p className="text-sm text-ink-soft">
            Couldn't find that product. <Link to={`/${channel}`} className="text-[#02696B] hover:underline">Back to home</Link>
          </p>
        </main>
        <Footer channel={channel} />
      </div>
    );
  }

  // B2C and CNF each have exactly one relevant pricing row. A generic "b2b"
  // request gets both tiers back from the API — rendered as two independent
  // blocks, each with its own quantity stepper starting at that tier's own
  // minimum order quantity, since there's no per-account tier to pick one
  // over the other.
  const tiers = product.pricing.filter((p) => {
    if (channel === "b2c") return p.channel === "b2c";
    if (channel === "cnf") return p.channel === "cnf";
    return p.channel === "b2b_normal" || p.channel === "b2b_advance";
  });
  const images = product.image_urls ? product.image_urls.split(",").filter(Boolean).map(resolveImageUrl) : [];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="md:sticky md:top-32 self-start">
            <div className="mb-3">
              {images.length > 0 ? (
                <ImageMagnifier src={images[activeImage]} alt={product.name} className="h-96" />
              ) : (
                <div className="h-96 rounded-card bg-bg flex items-center justify-center text-sm text-ink-soft">No image</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === activeImage ? "border-[#02696B]" : "border-border"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="font-display font-bold text-2xl text-ink">{product.name}</h1>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleSave}
                  disabled={saveBusy}
                  aria-label={saved ? "Remove from saved" : "Save for later"}
                  title={saved ? "Remove from saved" : "Save for later"}
                  className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-ink-soft hover:border-red hover:text-red transition-colors disabled:opacity-50"
                >
                  <Heart size={16} className={saved ? "fill-red text-red" : ""} />
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share"
                  title="Share"
                  className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-ink-soft hover:border-[#02696B] hover:text-[#02696B] transition-colors"
                >
                  {shareCopied ? <Check size={16} className="text-teal-dark" /> : <Share2 size={16} />}
                </button>
              </div>
            </div>
            <p className="text-xs text-ink-soft mb-4">SKU: {product.sku}</p>

            {variants.length > 1 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-ink-soft mb-2 uppercase tracking-wider">Size</p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => !v.is_current && navigate(`/${channel}/product/${v.slug}`)}
                      disabled={v.is_current}
                      className={`text-sm px-3.5 py-2 rounded-lg border transition-colors text-left ${
                        v.is_current
                          ? "border-[#02696B] bg-teal-light text-[#02696B] font-medium cursor-default"
                          : "border-border text-ink hover:border-[#02696B]"
                      } ${v.stock === 0 ? "opacity-50" : ""}`}
                    >
                      <span className="block">{v.variant_label || "Option"}</span>
                      {v.price != null && <span className="block text-xs mt-0.5">₹{v.price}</span>}
                      {v.stock === 0 && <span className="block text-[10px] text-red mt-0.5">Sold out</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tiers.length > 0 ? (
              <div className={tiers.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 items-start" : "mb-6"}>
                {tiers.map((tier) => {
                  const tierDiscountPct = tier.mrp && tier.mrp > tier.price
                    ? Math.round(((tier.mrp - tier.price) / tier.mrp) * 100)
                    : null;
                  const qty = quantities[tier.channel] ?? tier.min_quantity ?? 1;
                  const tierLabel = tier.channel === "b2b_normal" ? "B2B — Normal tier" : tier.channel === "b2b_advance" ? "B2B — Advance tier" : null;

                  return (
                    <div key={tier.channel} className={tiers.length > 1 ? "border border-border rounded-lg p-4" : ""}>
                      {tierLabel && <p className="text-sm font-medium text-ink mb-2">{tierLabel}</p>}

                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-display font-bold text-3xl text-ink">₹{tier.price}</span>
                        {tier.mrp && tier.mrp > tier.price && (
                          <span className="text-base text-ink-soft line-through">₹{tier.mrp}</span>
                        )}
                        {tierDiscountPct && (
                          <span className="bg-teal-light text-teal-dark text-xs font-semibold px-2 py-0.5 rounded-full">
                            {tierDiscountPct}% OFF
                          </span>
                        )}
                      </div>
                      {channel !== "b2c" && (
                        <p className="text-xs text-ink-soft mb-2">Minimum order quantity: {tier.min_quantity} units</p>
                      )}
                      <p className="text-sm text-ink-soft mb-3">
                        {tier.stock > 0 ? `${tier.stock} in stock` : "Out of stock"}
                      </p>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-border rounded-lg">
                          <button
                            type="button"
                            onClick={() => setQuantities((q) => ({ ...q, [tier.channel]: Math.max(tier.min_quantity || 1, qty - 1) }))}
                            disabled={qty <= (tier.min_quantity || 1)}
                            className="px-3 py-2 text-ink-soft hover:text-ink disabled:opacity-30"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="px-3 text-sm text-ink w-10 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQuantities((q) => ({ ...q, [tier.channel]: Math.min(tier.stock || qty, qty + 1) }))}
                            disabled={qty >= tier.stock}
                            className="px-3 py-2 text-ink-soft hover:text-ink disabled:opacity-30"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            addItem(product, tier, channel, qty);
                            setAddedTier(tier.channel);
                            setTimeout(() => setAddedTier(null), 1500);
                          }}
                          disabled={tier.stock === 0}
                          className="flex-1 bg-teal text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-teal-dark transition-colors disabled:bg-teal/40 disabled:cursor-not-allowed"
                        >
                          {addedTier === tier.channel ? "Added ✓" : tier.stock === 0 ? "Out of stock" : "Add to Cart"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-soft mb-6">Not available on this channel yet.</p>
            )}

            <CouponsRow channel={channel} />
            <DeliverToRow inStock={tiers.some((t) => t.stock > 0)} />

            {product.description && (
              <div>
                <h2 className="font-display font-semibold text-sm text-ink mb-2 uppercase tracking-wider">Description</h2>
                <div
                  className="prose prose-sm max-w-none text-ink-soft"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </div>
            )}
          </div>
        </div>

        <ReviewsSection slug={slug} />

        <FrequentlyBoughtTogether product={product} channel={channel} />

        <RelatedProductsRow title="Similar products" slug={slug} channel={channel} relationType="similar" />

        <SpotlightRow channel={channel} excludeSlug={slug} />

        <RelatedProductsRow title="Customers who bought this item also bought" slug={slug} channel={channel} relationType="also_bought" />

        {(product.manufacturer || product.marketer || product.country_of_origin || product.expiry_month) && (
          <div className="mt-10 pt-8 border-t border-border">
            <h2 className="font-display font-semibold text-base text-ink mb-4">Other information</h2>
            <p className="text-xs text-ink-soft mb-4">
              Last updated on {new Date(product.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              {product.manufacturer && (
                <div>
                  <p className="font-medium text-ink mb-1">Manufacturer details</p>
                  <p className="text-ink-soft">Name: {product.manufacturer.name}</p>
                  {product.manufacturer.address && <p className="text-ink-soft">Address: {product.manufacturer.address}</p>}
                </div>
              )}
              {product.marketer && (
                <div>
                  <p className="font-medium text-ink mb-1">Marketer details</p>
                  <p className="text-ink-soft">Name: {product.marketer.name}</p>
                  {product.marketer.address && <p className="text-ink-soft">Address: {product.marketer.address}</p>}
                </div>
              )}
              {(product.country_of_origin || product.expiry_month) && (
                <div>
                  <p className="font-medium text-ink mb-1">Vendor details</p>
                  {product.country_of_origin && <p className="text-ink-soft">Country of origin: {product.country_of_origin}</p>}
                  {product.expiry_month && product.expiry_year && (
                    <p className="text-ink-soft">
                      Expires on or after:{" "}
                      {new Date(product.expiry_year, product.expiry_month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer channel={channel} />
      {loginModalOpen && (
        <LoginModal onClose={() => setLoginModalOpen(false)} onSuccess={() => setLoginModalOpen(false)} />
      )}
    </div>
  );
}
