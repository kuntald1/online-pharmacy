import { resolveImageUrl } from "../utils/media";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import { api } from "../api/client";

export default function BrandProducts() {
  const { channelParam, slug } = useParams();
  const channel = channelParam || "b2c";
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/brands?channel=${channel}`).then((brands) => {
      const match = brands.find((b) => b.slug === slug);
      setBrand(match || null);
      if (!match) {
        setLoading(false);
        return;
      }
      api
        .get(`/api/products?channel=${channel}&brand_id=${match.id}`)
        .then(setProducts)
        .finally(() => setLoading(false));
    });
  }, [slug, channel]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Link to={`/${channel}`} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors mb-4 w-fit">
          <ArrowLeft size={16} />
          Back
        </Link>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-64 rounded-card bg-bg animate-pulse" />
            ))}
          </div>
        ) : !brand ? (
          <p className="text-sm text-ink-soft">
            Couldn't find that brand. <Link to={`/${channel}/brands`} className="text-[#02696B] hover:underline">Browse all brands</Link>
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              {brand.logo_url && (
                <div className="h-12 w-12 rounded-xl bg-bg border border-border flex items-center justify-center overflow-hidden shrink-0">
                  <img src={resolveImageUrl(brand.logo_url)} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <h1 className="font-display font-bold text-2xl text-ink">{brand.name}</h1>
            </div>

            {products.length === 0 ? (
              <p className="text-sm text-ink-soft">No products from this brand yet for this channel.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} channel={channel} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer channel={channel} />
    </div>
  );
}
