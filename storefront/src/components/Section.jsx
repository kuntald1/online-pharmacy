import { Link } from "react-router-dom";

export default function Section({ title, viewAllTo, children }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg sm:text-xl text-ink">{title}</h2>
          {viewAllTo && (
            <Link to={viewAllTo} className="text-sm font-medium text-[#02696B] hover:underline">
              View All →
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
