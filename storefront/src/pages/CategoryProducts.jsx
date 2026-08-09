import { resolveImageUrl } from "../utils/media";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import { api } from "../api/client";

export default function CategoryProducts() {
  const { channelParam, slug } = useParams();
  const channel = channelParam || "b2c";
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // No single-category-by-slug endpoint exists yet, so resolve it from the
    // list — the category count is small enough that this is cheap, and it
    // matches how AllCategories already works.
    api.get(`/api/categories?channel=${channel}`).then((categories) => {
      const match = categories.find((c) => c.slug === slug);
      setCategory(match || null);
      if (!match) {
        setLoading(false);
        return;
      }
      api
        .get(`/api/products?channel=${channel}&category_id=${match.id}`)
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
        ) : !category ? (
          <p className="text-sm text-ink-soft">
            Couldn't find that category. <Link to={`/${channel}/categories`} className="text-[#02696B] hover:underline">Browse all categories</Link>
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-bg border border-border flex items-center justify-center overflow-hidden shrink-0">
                {category.image_url ? (
                  <img src={resolveImageUrl(category.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package size={20} className="text-teal" />
                )}
              </div>
              <h1 className="font-display font-bold text-2xl text-ink">{category.name}</h1>
            </div>

            {products.length === 0 ? (
              <p className="text-sm text-ink-soft">No products in this category yet for this channel.</p>
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
