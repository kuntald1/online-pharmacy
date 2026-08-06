import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from "../api/client";

export default function AllBrands() {
  const { channelParam } = useParams();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/brands?featured_only=true&channel=${channelParam}`).then(setBrands).finally(() => setLoading(false));
  }, [channelParam]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="font-display font-bold text-2xl text-ink mb-6">All Brands</h1>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 rounded-card bg-bg animate-pulse" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <p className="text-sm text-ink-soft">No brands featured yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {brands.map((brand) => (
              <Link key={brand.id} to={`/${channelParam}/brand/${brand.slug}`} className="h-28 rounded-card border border-border overflow-hidden flex flex-col hover:border-teal transition-colors">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name} className="h-20 w-full object-cover" />
                ) : (
                  <div className="h-20 w-full bg-bg flex items-center justify-center">
                    <span className="font-display font-semibold text-sm text-ink-soft">{brand.name}</span>
                  </div>
                )}
                <p className="text-xs text-center text-ink-soft py-1.5 truncate px-1">{brand.name}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer channel={channelParam} />
    </div>
  );
}
