import {
  LayoutDashboard,
  Users,
  CalendarDays,
  MessageSquare,
  ListChecks,
  Stethoscope,
  FlaskConical,
  FolderOpen,
  FileText,
  Package,
  Receipt,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { StaffRole } from "@/context/AuthContext";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Role-aware navigation. Each role only sees the pages it can access.
export const navItems: Record<StaffRole, NavItem[]> = {
  admin: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/billing", label: "Billing", icon: Receipt },
    { to: "/reports", label: "Reports", icon: BarChart3 },
  ],
  doctor: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/queue", label: "Patient Queue", icon: ListChecks },
    { to: "/consultations", label: "Consultations", icon: Stethoscope },
    { to: "/laboratory", label: "Laboratory", icon: FlaskConical },
    { to: "/patients", label: "Records", icon: FolderOpen },
  ],
  nurse: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/appointments", label: "Appointments", icon: CalendarDays },
  ],
  pharmacy: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/prescriptions", label: "Prescriptions", icon: FileText },
    { to: "/inventory", label: "Inventory", icon: Package },
  ],
  lab: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/laboratory", label: "Lab Tests", icon: FlaskConical },
  ],
  reception: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/sms", label: "SMS Log", icon: MessageSquare },
  ],
};

export const roleLabels: Record<StaffRole, { title: string; sub: string }> = {
  admin: { title: "Administrator", sub: "System Control" },
  doctor: { title: "Doctor", sub: "Medical Officer" },
  nurse: { title: "Nurse", sub: "Ward Care" },
  pharmacy: { title: "Pharmacist", sub: "Dispensary" },
  lab: { title: "Lab Technician", sub: "Laboratory" },
  reception: { title: "Receptionist", sub: "Front Desk" },
};
