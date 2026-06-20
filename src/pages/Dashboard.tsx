import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, animate } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Stethoscope,
  CalendarDays,
  Wallet,
  FlaskConical,
  PackageX,
  ClipboardList,
  Activity,
  CalendarClock,
  Pill,
  RefreshCw,
  TrendingUp,
  HeartPulse,
  BedDouble,
  DollarSign,
  AlertTriangle,
  Building2,
  ArrowRight,
  Bell,
  UserPlus,
  Receipt,
  BarChart3,
  CheckCircle2,
  Clock,
  CircleDot,
  Layers,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ---------------- TYPES ---------------- */

type Stats = {
  patients?: number;
  doctors?: number;
  appointments?: number;
  revenue?: number;
  labTests?: number;
  medicinesLowStock?: number;
  consultations?: number;
};

type TodayStats = {
  todayAppointments: number;
  pendingLab: number;
  pendingPrescriptions: number;
};

type StatusSlice = { name: string; value: number; color: string };
type DayPoint = { day: string; appointments: number };
type RevenuePoint = { day: string; revenue: number };

interface AdminOverview {
  patients: number;
  doctors: number;
  doctorsOnDuty: number;
  appointments: number;
  appointmentsToday: number;
  revenue: number;
  outstanding: number;
  admitted: number;
  wardOccupancy: { ward: string; count: number }[];
  departmentLoad: { name: string; value: number }[];
  statusSlices: StatusSlice[];
  patientFlow: DayPoint[];
  revenueTrend: RevenuePoint[];
  staffOnDuty: StatusSlice[];
  alerts: AlertItem[];
  activity: ActivityItem[];
}

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  priority: "critical" | "high" | "normal";
  link: string;
}

interface ActivityItem {
  id: number | string;
  title: string;
  detail: string;
  time: string;
  icon: string;
  tone: string;
}

/* ---------------- HELPERS ---------------- */

const formatKES = (n: number) => "KES " + n.toLocaleString("en-KE");

/* ---------------- KPI CONFIG (non-admin) ---------------- */

type KpiConfig = {
  key: keyof Stats;
  label: string;
  icon: typeof Users;
  gradient: string;
  accent: string;
  currency?: boolean;
};

const kpiConfig: KpiConfig[] = [
  { key: "patients", label: "Patients", icon: Users, gradient: "from-[#1E88E5] to-[#64B5F6]", accent: "text-[#1E88E5]" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, gradient: "from-violet-500 to-purple-600", accent: "text-violet-600" },
  { key: "appointments", label: "Appointments", icon: CalendarDays, gradient: "from-sky-500 to-blue-600", accent: "text-sky-600" },
  { key: "revenue", label: "Revenue (KES)", icon: Wallet, gradient: "from-[#2ECC71] to-[#58D68D]", accent: "text-[#1E8C4A]", currency: true },
  { key: "labTests", label: "Pending Lab Tests", icon: FlaskConical, gradient: "from-[#F1C40F] to-[#F39C12]", accent: "text-[#B8860B]" },
  { key: "medicinesLowStock", label: "Low Stock Medicines", icon: PackageX, gradient: "from-rose-500 to-pink-600", accent: "text-rose-600" },
  { key: "consultations", label: "Consultations", icon: ClipboardList, gradient: "from-indigo-500 to-blue-600", accent: "text-indigo-600" },
];

/* ---------------- ADMIN CONFIG ---------------- */

const QUICK_ACTIONS = [
  { label: "Admit Patient", icon: BedDouble, link: "/admissions", gradient: "from-[#1E88E5] to-[#64B5F6]" },
  { label: "Generate Invoice", icon: Receipt, link: "/billing", gradient: "from-[#2ECC71] to-[#58D68D]" },
  { label: "Add Staff", icon: UserPlus, link: "/staff", gradient: "from-violet-500 to-purple-600" },
  { label: "Reports", icon: BarChart3, link: "/reports", gradient: "from-[#F1C40F] to-[#F39C12]" },
  { label: "Alerts", icon: Bell, link: "/notifications", gradient: "from-rose-500 to-pink-600" },
];

const ACTIVITY_ICONS: Record<string, typeof Bell> = {
  patient: Users,
  appointment: CalendarDays,
  invoice: Receipt,
  lab_test: FlaskConical,
  prescription: Pill,
  consultation: Stethoscope,
  admission: BedDouble,
  staff: Users,
};

/* ============================ COMPONENT ============================ */

export default function Dashboard() {
  const { role, profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const [stats, setStats] = useState<Stats>({});
  const [todayStats, setTodayStats] = useState<TodayStats>({
    todayAppointments: 0,
    pendingLab: 0,
    pendingPrescriptions: 0,
  });
  const [statusSlices, setStatusSlices] = useState<StatusSlice[]>([]);
  const [weekly, setWeekly] = useState<DayPoint[]>([]);
  const [admin, setAdmin] = useState<AdminOverview | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const countOf = async (table: string, filter?: { column: string; value: string }) => {
    let query = supabase.schema("medicore").from(table).select("*", { count: "exact", head: true });
    if (filter) query = query.eq(filter.column, filter.value);
    const { count, error: err } = await query;
    if (err) throw err;
    return count ?? 0;
  };

  /* ---------------- ADMIN OVERVIEW ---------------- */
  const fetchAdminOverview = useCallback(async (): Promise<AdminOverview> => {
    const schema = supabase.schema("medicore");
    const today = new Date().toISOString().split("T")[0];

    const [patients, appointments, staffRes, invRes, admRes, apptsRes, notifRes] = await Promise.all([
      countOf("patients"),
      countOf("appointments"),
      schema.from("staff").select("id, role, status"),
      schema.from("invoices").select("total_amount, status, paid_at"),
      schema.from("admissions").select("id, ward, status, admitted_at"),
      schema.from("appointments").select("status, appointment_date, department"),
      schema.from("notifications").select("id, title, message, priority, status, created_at, entity_type").order("created_at", { ascending: false }).limit(12),
    ]);

    const staff = (staffRes.data as { role: string; status: string }[]) ?? [];
    const invoices = (invRes.data as { total_amount: number; status: string; paid_at: string | null }[]) ?? [];
    const admissions = (admRes.data as { ward: string; status: string }[]) ?? [];
    const appts = (apptsRes.data as { status: string; appointment_date: string; department: string }[]) ?? [];
    const notifs = (notifRes.data as { id: number; title: string; message: string; priority: string; status: string; created_at: string; entity_type: string | null }[]) ?? [];

    const doctors = staff.filter((s) => s.role === "doctor").length;
    const doctorsOnDuty = staff.filter((s) => s.role === "doctor" && s.status === "On Duty").length;
    const paid = invoices.filter((i) => i.status === "Paid");
    const pending = invoices.filter((i) => i.status === "Pending");
    const revenue = paid.reduce((s, i) => s + Number(i.total_amount), 0);
    const outstanding = pending.reduce((s, i) => s + Number(i.total_amount), 0);
    const admitted = admissions.filter((a) => a.status === "Admitted").length;
    const appointmentsToday = appts.filter((a) => a.appointment_date === today).length;

    // ward occupancy
    const wardMap: Record<string, number> = {};
    admissions.filter((a) => a.status === "Admitted").forEach((a) => {
      wardMap[a.ward] = (wardMap[a.ward] ?? 0) + 1;
    });
    const wardOccupancy = Object.entries(wardMap).map(([ward, count]) => ({ ward, count }));

    // department load
    const deptMap: Record<string, number> = {};
    appts.forEach((a) => { deptMap[a.department] = (deptMap[a.department] ?? 0) + 1; });
    const departmentLoad = Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    // status slices
    const palette: Record<string, string> = {
      Scheduled: "#F1C40F", "Checked In": "#1E88E5", Completed: "#2ECC71", Cancelled: "#E74C3C",
    };
    const statusMap: Record<string, number> = {};
    appts.forEach((a) => { statusMap[a.status] = (statusMap[a.status] ?? 0) + 1; });
    const statusSlices = Object.entries(statusMap).map(([name, value]) => ({ name, value, color: palette[name] ?? "#94a3b8" }));

    // patient flow (7 days)
    const patientFlow: DayPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      patientFlow.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        appointments: appts.filter((a) => a.appointment_date === iso).length,
      });
    }

    // revenue trend (7 days, paid)
    const revenueTrend: RevenuePoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      revenueTrend.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: paid.filter((inv) => inv.paid_at?.slice(0, 10) === iso).reduce((s, inv) => s + Number(inv.total_amount), 0),
      });
    }

    // staff on duty by role
    const onDuty = staff.filter((s) => s.status === "On Duty");
    const roleColors: Record<string, string> = { doctor: "#1E88E5", nurse: "#2ECC71", pharmacy: "#F1C40F", lab: "#8E44AD", reception: "#1ABC9C", admin: "#475569" };
    const roleMap: Record<string, number> = {};
    onDuty.forEach((s) => { roleMap[s.role] = (roleMap[s.role] ?? 0) + 1; });
    const staffOnDuty = Object.entries(roleMap).map(([name, value]) => ({ name, value, color: roleColors[name] ?? "#94a3b8" }));

    // alerts (derived)
    const alerts: AlertItem[] = [];
    const pendingInvCount = pending.length;
    if (pendingInvCount > 0) alerts.push({ id: "unpaid", title: `${pendingInvCount} unpaid invoice${pendingInvCount !== 1 ? "s" : ""}`, detail: `${formatKES(outstanding)} outstanding`, priority: "high", link: "/billing" });
    const pendingLabs = await countOf("lab_tests", { column: "status", value: "Requested" });
    if (pendingLabs > 0) alerts.push({ id: "labs", title: `${pendingLabs} lab test${pendingLabs !== 1 ? "s" : ""} requested`, detail: "Awaiting processing", priority: "high", link: "/lab" });
    const pendingRx = await countOf("prescriptions", { column: "status", value: "Pending" });
    if (pendingRx > 0) alerts.push({ id: "rx", title: `${pendingRx} prescription${pendingRx !== 1 ? "s" : ""} pending`, detail: "Awaiting dispense", priority: "normal", link: "/pharmacy" });
    const { data: lowMeds } = await schema.from("medicines").select("stock, reorder_level");
    const lowCount = (lowMeds as { stock: number; reorder_level: number }[] | null)?.filter((m) => m.stock <= (m.reorder_level ?? 10)).length ?? 0;
    if (lowCount > 0) alerts.push({ id: "lowstock", title: `${lowCount} medicine${lowCount !== 1 ? "s" : ""} low on stock`, detail: "Below reorder level", priority: "critical", link: "/pharmacy" });
    if (admitted > 0) alerts.push({ id: "admit", title: `${admitted} patient${admitted !== 1 ? "s" : ""} admitted`, detail: "In ward care", priority: "normal", link: "/admissions" });

    // activity feed (from notifications)
    const activity: ActivityItem[] = notifs.slice(0, 6).map((n) => ({
      id: n.id,
      title: n.title,
      detail: n.message,
      time: fmtRelative(n.created_at),
      icon: n.entity_type ?? "bell",
      tone: n.priority === "critical" ? "#E74C3C" : n.priority === "high" ? "#F1C40F" : "#1E88E5",
    }));

    return {
      patients, doctors, doctorsOnDuty, appointments, appointmentsToday, revenue, outstanding, admitted,
      wardOccupancy, departmentLoad, statusSlices, patientFlow, revenueTrend, staffOnDuty, alerts, activity,
    };
  }, []);

  /* ---------------- MAIN STATS (non-admin) ---------------- */
  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      if (role === "doctor" || role === "nurse") {
        const [consultations, appointments] = await Promise.all([
          countOf("consultations"),
          countOf("appointments", { column: "status", value: "Scheduled" }),
        ]);
        setStats({ consultations, appointments });
      } else if (role === "lab") {
        setStats({ labTests: await countOf("lab_tests", { column: "status", value: "Requested" }) });
      } else if (role === "pharmacy") {
        const { data: meds } = await supabase.schema("medicore").from("medicines").select("stock,reorder_level");
        const medicinesLowStock = (meds as { stock: number; reorder_level: number }[] | null)?.filter((m) => m.stock <= (m.reorder_level ?? 10)).length ?? 0;
        setStats({ medicinesLowStock });
      } else if (role === "reception") {
        const [patients, appointments] = await Promise.all([
          countOf("patients"),
          countOf("appointments", { column: "status", value: "Scheduled" }),
        ]);
        setStats({ patients, appointments });
      }
    } catch (e) {
      console.error("[Dashboard] fetchStats error:", e);
      setError("Could not load some stats. Check RLS policies / schema exposure.");
    }
  }, [role]);

  /* ---------------- TODAY + CHARTS (non-admin) ---------------- */
  const fetchTodayStats = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const [todayAppointments, pendingLab, pendingRx] = await Promise.all([
        countOf("appointments", { column: "appointment_date", value: today }),
        countOf("lab_tests", { column: "status", value: "Requested" }),
        countOf("prescriptions", { column: "status", value: "Pending" }),
      ]);
      setTodayStats({ todayAppointments, pendingLab, pendingPrescriptions: pendingRx });
    } catch (e) {
      console.error("[Dashboard] fetchTodayStats error:", e);
    }
  }, []);

  const fetchCharts = useCallback(async () => {
    try {
      const { data: appts } = await supabase.schema("medicore").from("appointments").select("status,appointment_date");
      const palette: Record<string, string> = { Scheduled: "#F1C40F", "Checked In": "#1E88E5", Completed: "#2ECC71", Cancelled: "#E74C3C" };
      const grouped: Record<string, number> = {};
      (appts as { status: string; appointment_date: string }[] | null)?.forEach((a) => { grouped[a.status] = (grouped[a.status] ?? 0) + 1; });
      setStatusSlices(Object.entries(grouped).map(([name, value]) => ({ name, value, color: palette[name] ?? "#94a3b8" })));
      const days: DayPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = d.toISOString().split("T")[0];
        days.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), appointments: (appts as { appointment_date: string }[] | null)?.filter((a) => a.appointment_date === iso).length ?? 0 });
      }
      setWeekly(days);
    } catch (e) {
      console.error("[Dashboard] fetchCharts error:", e);
    }
  }, []);

  /* ---------------- LOAD ---------------- */
  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isAdmin) {
        const overview = await fetchAdminOverview();
        setAdmin(overview);
      } else {
        await Promise.all([fetchStats(), fetchTodayStats(), fetchCharts()]);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error("[Dashboard] load error:", e);
      setError("Could not load dashboard data. Check schema exposure + RLS.");
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }, [isAdmin, fetchAdminOverview, fetchStats, fetchTodayStats, fetchCharts]);

  useEffect(() => {
    if (role) void loadAll();
    else setStats({});
  }, [role, loadAll]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    if (!role) return;
    const tables = ["patients", "appointments", "invoices", "lab_tests", "prescriptions", "medicines", "consultations", "staff", "admissions", "notifications"];
    let channel = supabase.channel("medicore-live-dashboard");
    tables.forEach((table) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "medicore", table }, () => { void loadAll(); });
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role, loadAll]);

  /* ---------------- DERIVED ---------------- */
  const activeKpis = kpiConfig.filter((k) => stats[k.key] !== undefined);
  const totalAppts = statusSlices.reduce((s, x) => s + x.value, 0);
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-gradient-to-b from-white via-[#EAF4FE] to-[#F4F6F8] p-4 sm:p-6 lg:p-8">
      {/* ---------- HEADER ---------- */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[#2ECC71]/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2ECC71] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2ECC71]" />
              </span>
              {isAdmin ? "Executive Command Center" : "Live data"}
              {role && <span className="capitalize text-blue-50">· {role}</span>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting}, {profile?.name?.split(" ")[0] ?? "there"} 👋
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-50">
              <CalendarClock className="h-4 w-4" /> {todayLabel}
            </p>
          </div>
          <button
            onClick={() => void loadAll()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ============================ ADMIN VIEW ============================ */}
      {isAdmin && admin ? (
        <>
          {/* ---------- EXECUTIVE KPI STRIP ---------- */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <ExecKpi label="Patients" value={admin.patients} icon={Users} gradient="from-[#1E88E5] to-[#64B5F6]" onClick={() => navigate("/patients")} />
            <ExecKpi label="Revenue" value={admin.revenue} icon={DollarSign} gradient="from-[#2ECC71] to-[#58D68D]" money onClick={() => navigate("/billing")} />
            <ExecKpi label="Appointments" value={admin.appointments} icon={CalendarDays} gradient="from-sky-500 to-blue-600" onClick={() => navigate("/appointments")} />
            <ExecKpi label="Doctors On Duty" value={admin.doctorsOnDuty} icon={Stethoscope} gradient="from-violet-500 to-purple-600" onClick={() => navigate("/staff")} />
            <ExecKpi label="Bed Occupancy" value={admin.admitted} icon={BedDouble} gradient="from-[#F1C40F] to-[#F39C12]" onClick={() => navigate("/admissions")} />
            <ExecKpi label="Outstanding" value={admin.outstanding} icon={Wallet} gradient="from-rose-500 to-pink-600" money onClick={() => navigate("/billing")} />
          </div>

          {/* ---------- QUICK ACTIONS ---------- */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_ACTIONS.map((a, i) => (
              <motion.button
                key={a.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => navigate(a.link)}
                className={`group flex items-center gap-3 rounded-2xl bg-gradient-to-r ${a.gradient} p-4 text-left text-white shadow-lg shadow-slate-200/50 transition`}
              >
                <a.icon className="h-5 w-5" />
                <span className="text-sm font-semibold">{a.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </motion.button>
            ))}
          </div>

          {/* ---------- NEEDS ATTENTION + WARD OCCUPANCY ---------- */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Needs Attention */}
            <Panel title="Needs Attention" subtitle="Items requiring action" icon={<AlertTriangle className="h-4 w-4 text-[#E74C3C]" />}>
              {admin.alerts.length ? (
                <div className="space-y-2">
                  {admin.alerts.map((a, i) => {
                    const tone = a.priority === "critical" ? { chip: "bg-[#E74C3C]/10 text-[#C0392B]", bar: "bg-[#E74C3C]", Icon: AlertTriangle } : a.priority === "high" ? { chip: "bg-[#F1C40F]/15 text-[#B8860B]", bar: "bg-[#F1C40F]", Icon: Clock } : { chip: "bg-[#1E88E5]/10 text-[#1E88E5]", bar: "bg-[#1E88E5]", Icon: CircleDot };
                    return (
                      <motion.button
                        key={a.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => navigate(a.link)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white/50 p-3 text-left transition hover:bg-white"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}><tone.Icon className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{a.title}</p>
                          <p className="truncate text-xs text-slate-500">{a.detail}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#1E88E5]" />
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="mb-2 h-10 w-10 text-[#2ECC71]" />
                  <p className="text-sm font-semibold text-slate-700">All clear</p>
                  <p className="text-xs text-slate-400">No critical items right now.</p>
                </div>
              )}
            </Panel>

            {/* Ward Occupancy */}
            <Panel title="Ward Occupancy" subtitle="Live bed status" icon={<Building2 className="h-4 w-4 text-[#1E88E5]" />}>
              {admin.wardOccupancy.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {admin.wardOccupancy.map((w, i) => (
                    <motion.div key={w.ward} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-slate-100 bg-white/50 p-4 text-center">
                      <Building2 className="mx-auto h-5 w-5 text-[#1E88E5]" />
                      <p className="mt-1.5 text-2xl font-bold text-slate-900">{w.count}</p>
                      <p className="truncate text-xs text-slate-500">{w.ward}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <BedDouble className="mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-400">No admissions currently</p>
                </div>
              )}
            </Panel>
          </div>

          {/* ---------- PATIENT FLOW + REVENUE TREND ---------- */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Patient Flow" subtitle="Appointments · last 7 days" icon={<TrendingUp className="h-4 w-4 text-[#1E88E5]" />}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={admin.patientFlow} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs><linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} /><stop offset="95%" stopColor="#1E88E5" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  <Area type="monotone" dataKey="appointments" stroke="#1E88E5" strokeWidth={2.5} fill="url(#pfGrad)" dot={{ r: 3, fill: "#1E88E5" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Revenue Trend" subtitle="Collected · last 7 days" icon={<DollarSign className="h-4 w-4 text-[#2ECC71]" />}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={admin.revenueTrend} margin={{ left: 6, right: 8, top: 8 }}>
                  <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2ECC71" stopOpacity={0.35} /><stop offset="95%" stopColor="#2ECC71" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(v) => formatKES(Number(v))} />
                  <Area type="monotone" dataKey="revenue" stroke="#2ECC71" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: "#2ECC71" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* ---------- DEPT LOAD + STATUS DONUT + STAFF ON DUTY ---------- */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Panel title="Department Load" subtitle="Top departments" icon={<Layers className="h-4 w-4 text-[#1E88E5]" />} className="lg:col-span-2">
              {admin.departmentLoad.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={admin.departmentLoad} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
                    <Bar dataKey="value" name="Appointments" radius={[6, 6, 0, 0]} barSize={28}>
                      {admin.departmentLoad.map((_, i) => <Cell key={i} fill={["#1E88E5", "#2ECC71", "#F1C40F", "#E74C3C", "#8E44AD", "#1ABC9C"][i % 6]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </Panel>

            <Panel title="Staff On Duty" subtitle="By role" icon={<CircleDot className="h-4 w-4 text-[#2ECC71]" />}>
              {admin.staffOnDuty.length ? (
                <>
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={admin.staffOnDuty} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} stroke="none">
                          {admin.staffOnDuty.map((d) => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-slate-900">{admin.staffOnDuty.reduce((s, d) => s + d.value, 0)}</span>
                      <span className="text-[10px] text-slate-400">on duty</span>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {admin.staffOnDuty.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 capitalize text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</span>
                        <span className="font-semibold text-slate-700">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <Empty />}
            </Panel>
          </div>

          {/* ---------- RECENT ACTIVITY ---------- */}
          <Panel title="Recent Activity" subtitle="Live event feed" icon={<Activity className="h-4 w-4 text-[#1E88E5]" />}>
            {admin.activity.length ? (
              <div className="space-y-3">
                {admin.activity.map((a, i) => {
                  const Icon = ACTIVITY_ICONS[a.icon] ?? Bell;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60 shadow-sm" style={{ color: a.tone }}><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0">
                        <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                        <p className="truncate text-xs text-slate-500">{a.detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{a.time}</span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-400">No recent activity</p>
              </div>
            )}
          </Panel>
        </>
      ) : (
        /* ============================ NON-ADMIN VIEW ============================ */
        <>
          {/* KPI CARDS */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {activeKpis.map((k) => {
              const Icon = k.icon;
              const value = stats[k.key] ?? 0;
              return (
                <motion.div
                  key={k.key}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md"
                >
                  <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${k.gradient} opacity-10 transition group-hover:scale-150`} />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{k.label}</p>
                      <p className={`mt-2 bg-gradient-to-r ${k.gradient} bg-clip-text text-2xl font-bold tracking-tight text-transparent`}>
                        {k.currency ? formatKES(value) : <AnimatedNumber value={value} />}
                      </p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${k.gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* CHARTS */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <TrendingUp className="h-4 w-4 text-[#1E88E5]" />
                    <span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Appointment Flow</span>
                  </h3>
                  <p className="text-sm text-slate-500">Last 7 days</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1E88E5]/10 px-2.5 py-1 text-xs font-semibold text-[#1E88E5]">
                  <HeartPulse className="h-3.5 w-3.5" /> {weekly.reduce((s, d) => s + d.appointments, 0)} total
                </span>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weekly} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs><linearGradient id="aptGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} /><stop offset="95%" stopColor="#1E88E5" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  <Area type="monotone" dataKey="appointments" stroke="#1E88E5" strokeWidth={2.5} fill="url(#aptGrad)" dot={{ r: 3, fill: "#1E88E5" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
              <h3 className="text-base font-semibold text-slate-800">Appointment Status</h3>
              <p className="mb-2 text-sm text-slate-500">Live distribution</p>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} stroke="none">
                      {statusSlices.map((s) => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{totalAppts}</span>
                  <span className="text-xs text-slate-400">total</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {statusSlices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                    <span className="font-semibold text-slate-700">{s.value}</span>
                  </div>
                ))}
                {statusSlices.length === 0 && <p className="text-center text-xs text-slate-400">No data yet</p>}
              </div>
            </motion.div>
          </div>

          {/* TODAY'S OPERATIONS */}
          <div>
            <h2 className="mb-3 mt-2 flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Activity className="h-5 w-5 text-[#1E88E5]" /> Today's Operations
            </h2>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
              className="grid grid-cols-1 gap-4 md:grid-cols-3"
            >
              {[
                { label: "Today's Appointments", value: todayStats.todayAppointments, icon: CalendarDays, gradient: "from-sky-500 to-blue-600" },
                { label: "Pending Lab Tests", value: todayStats.pendingLab, icon: FlaskConical, gradient: "from-[#F1C40F] to-[#F39C12]" },
                { label: "Pending Prescriptions", value: todayStats.pendingPrescriptions, icon: Pill, gradient: "from-violet-500 to-purple-600" },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <motion.div
                    key={c.label}
                    variants={{ hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1 } }}
                    whileHover={{ y: -3 }}
                    className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.gradient} text-white shadow-lg`}><Icon className="h-6 w-6" /></div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900"><AnimatedNumber value={c.value} /></p>
                      <p className="text-sm text-slate-500">{c.label}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </>
      )}

      {/* ---------- FOOTER ---------- */}
      {lastUpdated && (
        <p className="text-center text-xs text-slate-400">
          Last updated {lastUpdated.toLocaleTimeString()} · Auto-refreshing in real time
        </p>
      )}
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function ExecKpi({ label, value, icon: Icon, gradient, money, onClick }: { label: string; value: number; icon: typeof Users; gradient: string; money?: boolean; onClick: () => void }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-4 text-left shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:shadow-xl"
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
      <p className={`mt-3 bg-gradient-to-r ${gradient} bg-clip-text text-2xl font-bold tracking-tight text-transparent`}>{money ? formatKES(display) : display.toLocaleString()}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </motion.button>
  );
}

function Panel({ title, subtitle, icon, className, children }: { title: string; subtitle?: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={`rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md ${className ?? ""}`}>
      <div className="mb-4 flex items-center gap-2">
        {icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F6F8]">{icon}</div>}
        <div>
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function Empty() {
  return <div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
