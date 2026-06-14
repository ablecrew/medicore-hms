import {
    LayoutDashboard,
    Users,
    Calendar,
    Wallet,
    Stethoscope,
    FlaskConical,
    Pill,
  } from "lucide-react";
  import { NavLink } from "react-router-dom";
  import { motion } from "framer-motion";
  import { useAuth } from "@/context/AuthContext";
  
  type Role = "admin" | "doctor" | "nurse" | "pharmacy" | "lab" | "reception";
  
  interface NavItem {
    /** Full name — shown in the aria-label / tooltip */
    name: string;
    /** Compact label shown on the bar — kept short so 7 tabs fit on iPhones */
    short: string;
    path: string;
    icon: typeof LayoutDashboard;
    /** Roles allowed to see this tab. Omit = everyone. */
    roles?: Role[];
  }
  
  export default function BottomNav() {
    const { role } = useAuth();
  
    const items: NavItem[] = [
      { name: "Dashboard", short: "Home", path: "/dashboard", icon: LayoutDashboard },
      { name: "Patients", short: "Patients", path: "/patients", icon: Users, roles: ["admin", "doctor", "reception"] },
      { name: "Appointments", short: "Appts", path: "/appointments", icon: Calendar, roles: ["admin", "reception"] },
      { name: "Doctors", short: "Doctors", path: "/doctors", icon: Stethoscope, roles: ["admin", "doctor"] },
      { name: "Billing", short: "Bills", path: "/billing", icon: Wallet, roles: ["admin", "reception"] },
      { name: "Laboratory", short: "Lab", path: "/lab", icon: FlaskConical, roles: ["admin", "lab"] },
      { name: "Pharmacy", short: "Pharm", path: "/pharmacy", icon: Pill, roles: ["admin", "pharmacy"] },
    ];
  
    // Admin sees all 7; every other role sees its full allowed set.
    const allowed = items.filter(
      (item) => !item.roles || item.roles.includes((role as Role) ?? "reception")
    );
  
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.15 }}
          className="pointer-events-auto flex w-full max-w-md items-stretch justify-between gap-0 rounded-2xl border border-white/60 bg-white/80 px-1 py-1.5 shadow-xl shadow-[#1E88E5]/10 backdrop-blur-xl"
        >
          {allowed.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                aria-label={item.name}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center"
              >
                {({ isActive }) => (
                  <motion.div
                    whileTap={{ scale: 0.88 }}
                    className="relative flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-1"
                  >
                    {/* Animated sliding active pill */}
                    {isActive && (
                      <motion.span
                        layoutId="bottomnav-active-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] shadow-md shadow-[#1E88E5]/30"
                      />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={isActive ? 2.4 : 2}
                      className={`relative z-10 shrink-0 transition-colors ${
                        isActive ? "text-white" : "text-slate-500"
                      }`}
                    />
                    <span
                      className={`relative z-10 mt-1 w-full truncate text-center text-[8px] font-semibold leading-none transition-colors sm:text-[9px] ${
                        isActive ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {item.short}
                    </span>
                  </motion.div>
                )}
              </NavLink>
            );
          })}
        </motion.nav>
      </div>
    );
  }
  