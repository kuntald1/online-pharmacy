import { Truck, ShieldCheck, RotateCcw, Clock } from "lucide-react";

const BADGES = [
  { icon: Truck, title: "Super Fast Delivery", subtitle: "Lightning fast delivery at your doorstep" },
  { icon: ShieldCheck, title: "Secure Payments", subtitle: "100% safe & secure payment options" },
  { icon: RotateCcw, title: "Easy Returns", subtitle: "7 days easy return & refund policy" },
  { icon: Clock, title: "24/7 Support", subtitle: "We are here to help you anytime" },
];

export default function TrustBadges() {
  return (
    <div className="bg-bg/60 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {BADGES.map(({ icon: Icon, title, subtitle }) => (
          <div key={title} className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-full bg-teal-light flex items-center justify-center">
              <Icon size={22} className="text-teal-dark" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-ink">{title}</p>
              <p className="text-xs text-ink-soft">{subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
