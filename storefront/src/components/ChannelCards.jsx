import { resolveImageUrl } from "../utils/media";
import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function ChannelCards({ channel }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/banners?channel=${channel}&position=channel_cards`)
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {banners.slice(0, 3).map((banner) => (
        <a
          key={banner.id}
          href={banner.link_url || "#"}
          className="block rounded-card overflow-hidden border border-border hover:shadow-card transition-shadow h-40"
        >
          <img src={resolveImageUrl(banner.image_url)} alt={banner.title} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
