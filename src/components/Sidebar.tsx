import {
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  Stethoscope,
  FlaskConical,
  Pill,
  UserCog,
  HeartPulse,
  LogOut,
  X,
  type LucideIcon,
  Bell,
  BellIcon,
  BarChart3,
  UserPlus,
  UserRoundCog,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Lab from "@/pages/Lab";

type Role = "admin" | "doctor" | "nurse" | "pharmacy" | "lab" | "reception";

interface LinkItem {
  name: string;
  path: string;
  icon: LucideIcon;
  roles?: Role[];
}

export default function Sidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { role, profile, logout } = useAuth();

  const links: LinkItem[] = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Patients", path: "/patients", icon: Users, roles: ["admin", "doctor", "reception"] },
    { name: "Appointments", path: "/appointments", icon: Calendar, roles: ["admin", "reception"] },
    { name: "Addmissions", path: "/addmissions", icon: UserPlus, roles: ["admin", "doctor"] },
    { name: "Lab", path: "/lab", icon: FlaskConical, roles: ["admin", "lab"] },
    { name: "Pharmacy", path: "/pharmacy", icon: Pill, roles: ["admin", "pharmacy"] },
    { name: "Billing", path: "/billing", icon: Wallet, roles: ["admin", "reception"] },
    { name: "Consultations", path: "/consultations", icon: Stethoscope, roles: ["admin", "reception"] },
    { name: "Staff", path: "/staff", icon: UserRoundCog, roles: ["admin"] },
    { name: "Notifications", path: "/notifications", icon: BellIcon, roles: ["admin", "doctor", "reception", "lab", "pharmacy", "reception"] },
    { name: "Reports", path: "/reports", icon: BarChart3, roles: ["admin"] },
  ];

  const allowedLinks = links.filter(
    (link) => !link.roles || link.roles.includes((role as Role) ?? "reception")
  );

  return (
    <div className="flex h-full w-64 flex-col border-r border-white/50 bg-white/70 backdrop-blur-xl">
      {/* LOGO */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] shadow-lg shadow-[#1E88E5]/30">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-lg font-extrabold leading-none tracking-tight text-slate-900">
              Medi<span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Core</span>
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
              Hospital Management
            </p>
          </div>
        </div>
        {/* Close button (mobile drawer only) */}
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* NAV */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {allowedLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={onNavigate}
              className="relative block"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {/* Animated sliding active pill */}
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] shadow-md shadow-[#1E88E5]/30"
                    />
                  )}
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2.4 : 2}
                    className="relative z-10 shrink-0"
                  />
                  <span className="relative z-10">{link.name}</span>
                </motion.div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* PROFILE + LOGOUT */}
      <div className="border-t border-white/60 p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-sm font-bold text-white">
            {profile?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {profile?.name ?? "User"}
            </p>
            <p className="truncate text-xs capitalize text-slate-500">{role}</p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E74C3C] to-[#EC7063] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#E74C3C]/30 transition hover:from-[#C0392B] hover:to-[#E74C3C] active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
