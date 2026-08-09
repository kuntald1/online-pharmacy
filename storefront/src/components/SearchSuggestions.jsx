import { Link } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { resolveImageUrl } from "../utils/media";

export default function SearchSuggestions({ query, suggestions, loading, channel, onSelect, onViewAll }) {
  if (!query.trim()) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-card border border-border overflow-hidden z-30 text-left">
      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-ink-soft">Searching…</div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-ink-soft">No products matched "{query}"</div>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-border">
          {suggestions.map((p) => {
            const pricing = p.pricing?.find((pr) => pr.channel === channel) || p.pricing?.[0];
            return (
              <li key={p.id}>
                <Link
                  to={`/${channel}/product/${p.slug}`}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg transition-colors"
                >
                  <div className="h-9 w-9 rounded-md bg-bg overflow-hidden shrink-0">
                    {p.image_urls ? (
                      <img src={resolveImageUrl(p.image_urls.split(",")[0])} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Search size={14} className="text-ink-soft m-auto mt-2.5" />
                    )}
                  </div>
                  <span className="flex-1 min-w-0 text-sm text-ink truncate">{p.name}</span>
                  {pricing && <span className="text-xs font-medium text-ink-soft shrink-0">₹{pricing.price}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onViewAll}
        className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-teal-dark border-t border-border py-2.5 hover:bg-bg transition-colors"
      >
        View all results for "{query}"
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
