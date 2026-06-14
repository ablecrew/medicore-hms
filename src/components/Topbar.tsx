import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  HeartPulse,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "./nav";

const ROLE_BADGE: Record<string, string> = {
  admin: "from-slate-700 to-slate-900",
  doctor: "from-[#1E88E5] to-[#64B5F6]",
  nurse: "from-[#2ECC71] to-[#58D68D]",
  pharmacy: "from-[#F1C40F] to-[#F39C12]",
  lab: "from-violet-500 to-purple-600",
  reception: "from-[#1ABC9C] to-teal-600",
};

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { profile, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const meta = roleLabels[role ?? "reception"];
  const badgeGrad = ROLE_BADGE[role ?? "reception"] ?? ROLE_BADGE.reception;

  // Derive a friendly page title from the current path.
  const title =
    location.pathname === "/dashboard"
      ? "Dashboard"
      : location.pathname
          .replace("/", "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) || "Dashboard";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/50 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6">
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3">
        {/* Hamburger only when a drawer handler is provided */}
        {onMenu && (
          <button
            onClick={onMenu}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-white/60 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* Compact logo on mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] shadow-md shadow-[#1E88E5]/30">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
        </div>
        <h1 className="hidden bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-lg font-bold text-transparent sm:block">
          {title}
        </h1>
      </div>

      {/* Center: glass search */}
      <div className="hidden flex-1 justify-center px-4 md:flex">
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2 backdrop-blur-md transition focus-within:border-[#1E88E5]/40 focus-within:bg-white/70">
          <Search className="h-4 w-4 text-[#1E88E5]" />
          <input
            placeholder="Search patients, appointments, IDs..."
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right: role badge + notifications + profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role badge */}
        <span
          className={`hidden items-center gap-1.5 rounded-full bg-gradient-to-r ${badgeGrad} px-3 py-1.5 text-xs font-semibold text-white shadow-md sm:inline-flex`}
        >
          {meta.title}
        </span>

        {/* Notifications */}
        <button className="relative rounded-xl border border-white/60 bg-white/50 p-2.5 text-slate-600 backdrop-blur-md transition hover:bg-white/70">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E74C3C] ring-2 ring-white" />
        </button>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 py-1 pl-1 pr-2 backdrop-blur-md transition hover:bg-white/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-sm font-bold text-white">
              {profile?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-none text-slate-800">
                {profile?.name?.split(" ")[0] ?? "User"}
              </p>
              <p className="mt-0.5 text-xs capitalize text-slate-500">{role}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-xl shadow-[#1E88E5]/10 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3 border-b border-white/60 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] font-bold text-white">
                      {profile?.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {profile?.name ?? "User"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[#C0392B] transition hover:bg-[#E74C3C]/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
