import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from "../api/client";

export default function AllOffers() {
  const { channelParam } = useParams();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/banners?channel=${channelParam}&position=promo_strip`)
      .then(setBanners)
      .finally(() => setLoading(false));
  }, [channelParam]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="font-display font-bold text-2xl text-ink mb-6">All Offers</h1>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-card bg-bg animate-pulse" />
            ))}
          </div>
        ) : banners.length === 0 ? (
          <p className="text-sm text-ink-soft">No offers live right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {banners.map((banner) => (
              <a
                key={banner.id}
                href={banner.link_url || "#"}
                className="block rounded-card overflow-hidden border border-border hover:shadow-card transition-shadow h-40"
              >
                <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </main>
      <Footer channel={channelParam} />
    </div>
  );
}
