import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import LoginModal from "./LoginModal";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

function StarRow({ value, size = 16, onRate }) {
  // onRate present => interactive picker; absent => static display
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          onClick={onRate ? () => onRate(n) : undefined}
          className={`${n <= value ? "fill-amber text-amber" : "text-border"} ${onRate ? "cursor-pointer" : ""}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsSection({ slug }) {
  const { user, isLoggedIn } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api.get(`/api/products/${slug}/reviews`).then(setSummary).finally(() => setLoading(false));
  }

  useEffect(load, [slug]);

  const ownReview = summary?.reviews.find((r) => r.is_own);

  function openForm() {
    if (!isLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
    setRatingInput(ownReview?.rating || 0);
    setCommentInput(ownReview?.comment || "");
    setFormOpen(true);
  }

  async function submit() {
    if (ratingInput < 1) {
      setError("Pick a star rating first");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/api/products/${slug}/reviews`, { rating: ratingInput, comment: commentInput.trim() || null });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeOwnReview() {
    if (!confirm("Delete your review?")) return;
    try {
      await api.delete(`/api/products/${slug}/reviews/me`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return <div className="h-32 rounded-card bg-bg animate-pulse mt-10" />;
  }

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-semibold text-base text-ink">Ratings and reviews</h2>
        <button
          onClick={openForm}
          className="text-sm font-medium text-[#02696B] hover:underline"
        >
          {ownReview ? "Edit your review" : "Write a review"}
        </button>
      </div>

      {summary.count > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 mb-6">
          <div className="flex flex-col items-center justify-center px-4">
            <p className="font-display font-bold text-3xl text-ink">{summary.average.toFixed(1)}</p>
            <StarRow value={Math.round(summary.average)} />
            <p className="text-xs text-ink-soft mt-1">{summary.count} rating{summary.count !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex flex-col gap-1.5 justify-center">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.breakdown[star] || 0;
              const pct = summary.count > 0 ? Math.round((n / summary.count) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-ink-soft">
                  <span className="w-3">{star}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-bg overflow-hidden">
                    <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-9 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-soft mb-6">No ratings yet — be the first to review this product.</p>
      )}

      {formOpen && (
        <div className="border border-border rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-ink mb-2">Your rating</p>
          <StarRow value={ratingInput} size={22} onRate={setRatingInput} />
          <textarea
            className="w-full mt-3 border border-border rounded-lg px-3 py-2 text-sm"
            rows={3}
            placeholder="Share what you liked or didn't (optional)"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          {error && <p className="text-red text-xs mt-2">{error}</p>}
          <div className="flex gap-3 mt-3">
            <button
              onClick={submit}
              disabled={submitting}
              className="bg-teal text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Submit review"}
            </button>
            <button onClick={() => setFormOpen(false)} className="text-sm text-ink-soft hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {summary.reviews.length > 0 && (
        <div className="space-y-4">
          {summary.reviews.map((r) => (
            <div key={r.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StarRow value={r.rating} size={14} />
                  <span className="text-sm font-medium text-ink">{r.reviewer_name}</span>
                  {r.is_own && <span className="text-[10px] text-ink-soft border border-border rounded px-1.5 py-0.5">You</span>}
                </div>
                {r.is_own && (
                  <button onClick={removeOwnReview} className="text-xs text-red hover:underline">
                    Delete
                  </button>
                )}
              </div>
              {r.comment && <p className="text-sm text-ink-soft mt-1">{r.comment}</p>}
              <p className="text-[11px] text-ink-soft mt-1">
                {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => {
            setLoginModalOpen(false);
            openForm();
          }}
        />
      )}
    </div>
  );
}
