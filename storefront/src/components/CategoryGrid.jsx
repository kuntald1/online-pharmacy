import { resolveImageUrl } from "../utils/media";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { api } from "../api/client";

const MAX_VISIBLE = 11;

export default function CategoryGrid({ channel }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/categories?channel=${channel}`).then(setCategories).finally(() => setLoading(false));
  }, [channel]);

  if (loading) {
    // A fixed count is fine here — this is a loading skeleton, not real
    // data, so there's no "leftover track" problem to worry about.
    return (
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-24 w-20 sm:w-24 rounded-card bg-bg animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return <p className="text-sm text-ink-soft">No categories added yet — set these up from the admin panel.</p>;
  }

  const visible = categories.slice(0, MAX_VISIBLE);

  return (
    <div>
      {/* flex-wrap instead of a fixed-column grid — a grid sized for exactly
          11 columns leaves a visible empty track the moment any channel has
          fewer than 11 visible categories (e.g. one marked B2C-only doesn't
          show on the B2B page). Flex items just wrap to the next row
          naturally, whatever the count. */}
      <div className="flex flex-wrap gap-4">
        {visible.map((cat) => (
          <Link
            key={cat.id}
            to={`/${channel}/category/${cat.slug}`}
            className="flex flex-col items-center gap-2 text-center group w-20 sm:w-24"
          >
            <div className="h-16 w-16 rounded-2xl bg-bg border border-border flex items-center justify-center overflow-hidden group-hover:border-teal transition-colors">
              {cat.image_url ? (
                <img src={resolveImageUrl(cat.image_url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package size={22} className="text-teal" />
              )}
            </div>
            <span className="text-xs font-medium text-ink-soft group-hover:text-ink transition-colors line-clamp-2">{cat.name}</span>
          </Link>
        ))}
      </div>
      <div className="flex justify-end mt-2">
        <Link to={`/${channel}/categories`} className="text-sm font-medium text-[#02696B] hover:underline">
          View All →
        </Link>
      </div>
    </div>
  );
}
