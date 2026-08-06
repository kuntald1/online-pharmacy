import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Package, FolderTree, Tags, Image as ImageIcon,
  ClipboardList, ShieldCheck, Send, ChevronRight, LogOut,
  Users, Boxes, Ticket, Megaphone, BarChart3, FileText, Settings as SettingsIcon, Star, Stethoscope, MapPin, RotateCcw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/brands", label: "Brands", icon: Tags },
      { to: "/banners", label: "Banners", icon: ImageIcon },
      { to: "/health-packages", label: "Health Packages", icon: Stethoscope },
      { to: "/delivery-zones", label: "Delivery Zones", icon: MapPin },
      { to: "/inventory", label: "Inventory", icon: Boxes },
      { to: "/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Channels",
    items: [
      {
        label: "Orders",
        icon: ClipboardList,
        children: [
          { to: "/orders/b2c", label: "B2C Orders" },
          { to: "/orders/b2b", label: "B2B Orders" },
          { to: "/orders/cnf", label: "CNF Orders" },
        ],
      },
      { to: "/b2b-applications", label: "B2B Applications", icon: ShieldCheck },
      { to: "/cnf-leads", label: "CNF Requests", icon: Send },
      { to: "/prescriptions", label: "Prescriptions", icon: FileText },
      { to: "/returns", label: "Returns", icon: RotateCcw },
      { to: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Grow",
    items: [
      { to: "/coupons", label: "Offers & Coupons", icon: Ticket },
      { to: "/marketing", label: "Marketing", icon: Megaphone },
      { to: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Site",
    items: [
      { to: "/cms", label: "CMS", icon: FileText },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

function OrdersGroup({ item }) {
  const location = useLocation();
  const isActiveGroup = item.children.some((c) => location.pathname === c.to);
  const [open, setOpen] = useState(isActiveGroup);
  const Icon = item.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActiveGroup ? "bg-teal text-white shadow-sm" : "text-ink-soft hover:bg-bg hover:text-ink"
        }`}
      >
        <Icon size={17} strokeWidth={2} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-teal text-white font-medium shadow-sm" : "text-ink-soft hover:bg-bg hover:text-ink"
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-border flex flex-col h-screen sticky top-0">
      <div
        className="px-6 h-[106px] flex flex-col items-start justify-center gap-1.5"
        style={{ background: "linear-gradient(135deg, #1FAFE8 0%, #02A694 100%)" }}
      >
        <Logo size="md" chip />
        <p className="text-xs text-white/80">Admin console</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="px-6 text-[11px] uppercase tracking-wider text-ink-soft/70 font-medium mb-2">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5 px-3">
              {section.items.map((item) =>
                item.children ? (
                  <OrdersGroup key={item.label} item={item} />
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-teal text-white shadow-sm"
                          : "text-ink-soft hover:bg-bg hover:text-ink"
                      }`
                    }
                  >
                    <item.icon size={17} strokeWidth={2} />
                    {item.label}
                  </NavLink>
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-teal-light text-teal-dark flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase() || "A"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
            <p className="text-xs text-ink-soft">Administrator</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-ink-soft hover:bg-bg hover:text-ink transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
