import { Bell, Calendar } from "lucide-react";
import Sidebar from "./Sidebar";

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Layout({ title, subtitle, action, children }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header
          className="flex items-center justify-between px-8 h-[106px] sticky top-0 z-10"
          style={{ background: "linear-gradient(135deg, #1FAFE8 0%, #02A694 100%)" }}
        >
          <div>
            <h1 className="font-display font-semibold text-2xl text-white">{title}</h1>
            {subtitle && <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white bg-white/15 rounded-lg px-3 py-2 border border-white/25">
              <Calendar size={14} />
              Today: {todayLabel()}
            </div>
            <button
              className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-white/25 text-white hover:bg-white/15 transition-colors"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>
            {action}
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
