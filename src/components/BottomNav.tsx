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
  
  export default function BottomNav() {
    const { role } = useAuth();
  
    const items = [
      { name: "Home", path: "/dashboard", icon: LayoutDashboard },
      {
        name: "Patients",
        path: "/patients",
        icon: Users,
        roles: ["admin", "doctor", "reception"],
      },
      {
        name: "Appointments",
        path: "/appointments",
        icon: Calendar,
        roles: ["admin", "reception"],
      },
      {
        name: "Doctors",
        path: "/doctors",
        icon: Stethoscope,
        roles: ["admin", "doctor"],
      },
      {
        name: "Billing",
        path: "/billing",
        icon: Wallet,
        roles: ["admin", "reception"],
      },
      {
        name: "Lab",
        path: "/lab",
        icon: FlaskConical,
        roles: ["admin", "lab"],
      },
      {
        name: "Pharmacy",
        path: "/pharmacy",
        icon: Pill,
        roles: ["admin", "pharmacy"],
      },
    ];
  
    const allowedItems = items.filter(
      (item) => !item.roles || item.roles.includes(role || "")
    );
  
    // Show at most 5 items on the bottom nav to keep spacing comfortable.
    const visible = allowedItems.slice(0, 5);
  
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.2 }}
          className="pointer-events-auto flex max-w-[calc(100%-1.5rem)] items-center justify-between gap-1 rounded-2xl border border-white/60 bg-white/80 px-2 py-2 shadow-xl shadow-[#1E88E5]/10 backdrop-blur-xl"
        >
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative flex flex-1 flex-col items-center justify-center"
              >
                {({ isActive }) => (
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="flex h-11 w-11 flex-col items-center justify-center rounded-xl"
                  >
                    {/* Animated active pill that slides between items */}
                    {isActive && (
                      <motion.span
                        layoutId="bottomnav-active-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] shadow-md shadow-[#1E88E5]/30"
                      />
                    )}
                    <Icon
                      size={20}
                      className={`relative z-10 transition-colors ${
                        isActive ? "text-white" : "text-slate-500"
                      }`}
                    />
                    <span
                      className={`relative z-10 mt-0.5 text-[9px] font-semibold leading-none transition-colors ${
                        isActive ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {item.name}
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
  