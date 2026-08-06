import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import DataTable from "../components/DataTable";
import { ClickableThumbnail } from "../components/ClickableThumbnail";
import { api } from "../api/client";

export default function Prescriptions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/admin/prescriptions").then(setRows).finally(() => setLoading(false));
  }, []);

  return (
    <Layout
      title="Prescriptions"
      subtitle="Every prescription customers have uploaded, for pharmacist cross-reference — not tied to a specific order"
    >
      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : (
        <DataTable
          rows={rows}
          emptyMessage="No prescriptions uploaded yet."
          columns={[
            {
              key: "file_url",
              header: "",
              render: (row) => (
                <ClickableThumbnail
                  src={row.file_url.toLowerCase().endsWith(".pdf") ? null : `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${row.file_url}`}
                  alt="Prescription"
                  className="h-16 w-16 rounded-lg object-cover bg-bg"
                />
              ),
            },
            { key: "customer_name", header: "Customer" },
            { key: "customer_phone", header: "Phone" },
            {
              key: "created_at",
              header: "Uploaded",
              render: (row) => new Date(row.created_at).toLocaleString(),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <a
                  href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${row.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-teal-dark hover:underline"
                >
                  Open original
                </a>
              ),
            },
          ]}
        />
      )}
    </Layout>
  );
}
