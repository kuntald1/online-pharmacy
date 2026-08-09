import { resolveImageUrl } from "../utils/media";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const MAX_VISIBLE = 6;

export default function BrandStrip({ channel }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/brands?featured_only=true&channel=${channel}`).then(setBrands).finally(() => setLoading(false));
  }, [channel]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-card bg-bg animate-pulse" />
        ))}
      </div>
    );
  }

  if (brands.length === 0) {
    return <p className="text-sm text-ink-soft">No brands featured yet — toggle "Discover New Brands" for a brand in the admin panel.</p>;
  }

  const visible = brands.slice(0, MAX_VISIBLE);
  const hasMore = brands.length > MAX_VISIBLE;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {visible.map((brand) => (
          <Link
            key={brand.id}
            to={`/${channel}/brand/${brand.slug}`}
            className="h-28 rounded-card border border-border overflow-hidden hover:border-teal transition-colors flex flex-col"
          >
            {brand.logo_url ? (
              <img src={resolveImageUrl(brand.logo_url)} alt={brand.name} className="h-20 w-full object-cover" />
            ) : (
              <div className="h-20 w-full bg-bg flex items-center justify-center">
                <span className="font-display font-semibold text-sm text-ink-soft">{brand.name}</span>
              </div>
            )}
            <p className="text-xs text-center text-ink-soft py-1.5 truncate px-1">{brand.name}</p>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-end mt-3">
          <Link to={`/${channel}/brands`} className="text-sm font-medium text-[#02696B] hover:underline">
            View All →
          </Link>
        </div>
      )}
    </div>
  );
}
