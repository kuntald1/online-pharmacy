import { resolveImageUrl } from "../utils/media";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function PromoStrip({ channel }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/banners?channel=${channel}&position=promo_strip`)
      .then(setBanners)
      .finally(() => setLoading(false));
  }, [channel]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-card bg-bg animate-pulse" />
        ))}
      </div>
    );
  }

  if (banners.length === 0) {
    return null; // no fabricated placeholder cards — just omit the section when there's nothing to show
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {banners.slice(-3).map((banner) =>
          banner.link_url ? (
            <a
              key={banner.id}
              href={banner.link_url}
              className="block rounded-card overflow-hidden border border-border hover:shadow-card transition-shadow h-40"
            >
              <img src={resolveImageUrl(banner.image_url)} alt={banner.title} className="h-full w-full object-cover" />
            </a>
          ) : (
            <div key={banner.id} className="rounded-card overflow-hidden border border-border h-40">
              <img src={resolveImageUrl(banner.image_url)} alt={banner.title} className="h-full w-full object-cover" />
            </div>
          )
        )}
      </div>
      <div className="flex justify-end mt-3">
        <Link to={`/${channel}/offers`} className="text-sm font-medium text-[#02696B] hover:underline">
          View All →
        </Link>
      </div>
    </div>
  );
}
