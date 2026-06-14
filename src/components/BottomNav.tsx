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
  import { useAuth } from "@/context/AuthContext";
  
  export default function BottomNav() {
    const { role } = useAuth();
  
    const items = [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  
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
  
    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 z-50">
        {allowedItems.map((item) => {
          const Icon = item.icon;
  
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center text-xs ${
                  isActive ? "text-blue-600 font-semibold" : "text-slate-500"
                }`
              }
            >
              <Icon size={18} />
              {item.name}
            </NavLink>
          );
        })}
      </div>
    );
  }