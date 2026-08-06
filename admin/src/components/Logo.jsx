import { useEffect, useState } from "react";
import defaultLogo from "../assets/healthycian_logo.png";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Logo({ size = "md" }) {
  const [customLogoUrl, setCustomLogoUrl] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings/public`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setCustomLogoUrl(data.site_logo_url || null))
      .catch(() => {});
  }, []);

  // Height-based sizing — the logo is a fixed-aspect-ratio lockup (icon + wordmark),
  // so width follows automatically rather than being set separately.
  const heights = { sm: 30, md: 40, lg: 54 };
  const height = heights[size];

  const src = customLogoUrl || defaultLogo;

  return (
    <img
      src={src}
      alt="Healthycian"
      style={{ height, width: "auto" }}
      className="object-contain rounded-2xl"
    />
  );
}
