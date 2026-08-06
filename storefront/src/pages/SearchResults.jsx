import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Search } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import { api } from "../api/client";

export default function SearchResults() {
  const { channelParam } = useParams();
  const channel = channelParam || "b2c";
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [products, setProducts] = useState(null);

  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      return;
    }
    setProducts(null);
    api
      .get(`/api/products?channel=${channel}&search=${encodeURIComponent(query.trim())}`)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [query, channel]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <h1 className="font-display font-bold text-2xl text-ink mb-1">
          {query ? <>Results for "{query}"</> : "Search"}
        </h1>
        {products && (
          <p className="text-sm text-ink-soft mb-6">{products.length} product{products.length !== 1 ? "s" : ""} found</p>
        )}

        {products === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-64 rounded-card bg-bg animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Search size={40} className="text-border mx-auto mb-3" />
            <p className="text-sm text-ink-soft mb-4">
              {query ? <>No products matched "{query}".</> : "Type something in the search box above to get started."}
            </p>
            <Link to={`/${channel}`} className="text-sm font-medium text-[#02696B] hover:underline">
              Back to home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} channel={channel} />
            ))}
          </div>
        )}
      </main>
      <Footer channel={channel} />
    </div>
  );
}
