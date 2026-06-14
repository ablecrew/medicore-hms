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

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { profile, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const meta = roleLabels[role ?? "reception"];

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
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3">
        {/* Hamburger only when a drawer handler is provided */}
        {onMenu && (
          <button
            onClick={onMenu}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {/* Compact logo on mobile when there's no drawer (BottomNav handles nav) */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
        </div>
        <h1 className="hidden text-lg font-semibold text-slate-800 sm:block">
          {title}
        </h1>
      </div>

      {/* Center: search */}
      <div className="hidden flex-1 justify-center px-4 md:flex">
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            placeholder="Search patients, appointments, IDs..."
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right: role badge + notifications + profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 sm:inline-flex">
          {meta.title}
        </span>

        <button className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-slate-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white">
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
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {profile?.name ?? "User"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {profile?.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
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
