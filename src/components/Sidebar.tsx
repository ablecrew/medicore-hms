import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Wallet,
  Stethoscope,
  FlaskConical,
  Pill,
  UserCog,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const { role } = useAuth();

  const links = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    },

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

    {
      name: "Billing",
      path: "/billing",
      icon: Wallet,
      roles: ["admin", "reception"],
    },

    {
      name: "Consultations",
      path: "/consultations",
      icon: Calendar,
      roles: ["admin", "reception"],
    },

    {
      name: "Staff",
      path: "/staff",
      icon: UserCog,
      roles: ["admin"],
    },
  ];

  const allowedLinks = links.filter(
    (link) => !link.roles || link.roles.includes(role || "")
  );

  return (
    <div className="hidden md:flex flex-col h-full w-64 bg-white border-r p-4">
      {/* LOGO */}
      <h1 className="text-xl font-bold text-blue-600 mb-6">
        MediCore HMS
      </h1>

      {/* NAV */}
      <nav className="space-y-2">
        {allowedLinks.map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon size={18} />
              {link.name}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}