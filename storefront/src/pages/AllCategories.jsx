import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Package } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from "../api/client";

export default function AllCategories() {
  const { channelParam } = useParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/categories?channel=${channelParam}`).then(setCategories).finally(() => setLoading(false));
  }, [channelParam]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="font-display font-bold text-2xl text-ink mb-6">All Categories</h1>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 rounded-card bg-bg animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-ink-soft">No categories added yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-5">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/${channelParam}/category/${cat.slug}`}
                className="flex flex-col items-center gap-2 text-center group"
              >
                <div className="h-20 w-20 rounded-2xl bg-bg border border-border flex items-center justify-center overflow-hidden group-hover:border-teal transition-colors">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={26} className="text-teal" />
                  )}
                </div>
                <span className="text-sm font-medium text-ink-soft group-hover:text-ink transition-colors">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer channel={channelParam} />
    </div>
  );
}
