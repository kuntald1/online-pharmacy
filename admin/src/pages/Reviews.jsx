import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { inputClass } from "../components/Field";
import { api } from "../api/client";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | approved | hidden
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter === "approved") params.set("is_approved", "true");
    if (filter === "hidden") params.set("is_approved", "false");
    api.get(`/api/admin/reviews?${params.toString()}`).then(setReviews).finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function toggleApproved(review) {
    setBusyId(review.id);
    try {
      await api.patch(`/api/admin/reviews/${review.id}`, { is_approved: !review.is_approved });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(review) {
    if (!confirm(`Delete this review by ${review.reviewer_name}? This can't be undone.`)) return;
    setBusyId(review.id);
    try {
      await api.delete(`/api/admin/reviews/${review.id}`);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout title="Reviews" subtitle="Customer ratings and reviews across all products">
      <div className="mb-4">
        <select className={`${inputClass} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All reviews</option>
          <option value="approved">Visible on storefront</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={reviews}
          emptyMessage="No reviews yet."
          columns={[
            { key: "product_name", header: "Product" },
            { key: "reviewer_name", header: "Customer" },
            {
              key: "rating",
              header: "Rating",
              render: (row) => (
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className={n <= row.rating ? "fill-amber text-amber" : "text-border"} />
                  ))}
                </div>
              ),
            },
            {
              key: "comment",
              header: "Comment",
              render: (row) => <span className="text-sm text-ink-soft line-clamp-2 max-w-xs block">{row.comment || "—"}</span>,
            },
            {
              key: "created_at",
              header: "Date",
              render: (row) => new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            },
            {
              key: "is_approved",
              header: "Status",
              render: (row) => (
                <button
                  onClick={() => toggleApproved(row)}
                  disabled={busyId === row.id}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full disabled:opacity-50 ${
                    row.is_approved ? "bg-teal-light text-teal-dark" : "bg-bg text-ink-soft"
                  }`}
                >
                  {row.is_approved ? "Visible" : "Hidden"}
                </button>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <button
                  onClick={() => handleDelete(row)}
                  disabled={busyId === row.id}
                  className="text-xs font-medium text-red hover:underline disabled:opacity-50"
                >
                  {busyId === row.id ? "…" : "Delete"}
                </button>
              ),
            },
          ]}
        />
      )}
    </Layout>
  );
}
