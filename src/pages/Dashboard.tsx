import { useCallback, useEffect, useState } from "react";
import { motion, animate } from "framer-motion";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
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

/* ---------------- KPI CONFIG ---------------- */

type KpiConfig = {
  key: keyof Stats;
  label: string;
  icon: typeof Users;
  gradient: string;
  accent: string;
  currency?: boolean;
};

const kpiConfig: KpiConfig[] = [
  { key: "patients", label: "Patients", icon: Users, gradient: "from-teal-500 to-cyan-600", accent: "text-teal-600" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, gradient: "from-violet-500 to-purple-600", accent: "text-violet-600" },
  { key: "appointments", label: "Appointments", icon: CalendarDays, gradient: "from-sky-500 to-blue-600", accent: "text-sky-600" },
  { key: "revenue", label: "Revenue (KES)", icon: Wallet, gradient: "from-emerald-500 to-green-600", accent: "text-emerald-600", currency: true },
  { key: "labTests", label: "Pending Lab Tests", icon: FlaskConical, gradient: "from-amber-500 to-orange-600", accent: "text-amber-600" },
  { key: "medicinesLowStock", label: "Low Stock Medicines", icon: PackageX, gradient: "from-rose-500 to-pink-600", accent: "text-rose-600" },
  { key: "consultations", label: "Consultations", icon: ClipboardList, gradient: "from-indigo-500 to-blue-600", accent: "text-indigo-600" },
];

/* ---------------- HELPERS ---------------- */

const formatKES = (n: number) => "KES " + n.toLocaleString("en-KE");

/* ---------------- COMPONENT ---------------- */

export default function Dashboard() {
  const { role, profile } = useAuth();

  const [stats, setStats] = useState<Stats>({});
  const [todayStats, setTodayStats] = useState<TodayStats>({
    todayAppointments: 0,
    pendingLab: 0,
    pendingPrescriptions: 0,
  });
  const [statusSlices, setStatusSlices] = useState<StatusSlice[]>([]);
  const [weekly, setWeekly] = useState<DayPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Count helper — returns a safe number.
  const countOf = async (
    table: string,
    filter?: { column: string; value: string }
  ) => {
    let query = supabase
      .schema("medicore")
      .from(table)
      .select("*", { count: "exact", head: true });
    if (filter) query = query.eq(filter.column, filter.value);
    const { count, error: err } = await query;
    if (err) throw err;
    return count ?? 0;
  };

  /* ---------------- MAIN STATS ---------------- */

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      if (role === "admin") {
        const [patients, appointments, { data: staff }, { data: invoices }] =
          await Promise.all([
            countOf("patients"),
            countOf("appointments"),
            supabase.schema("medicore").from("staff").select("role"),
            supabase
              .schema("medicore")
              .from("invoices")
              .select("total_amount,status"),
          ]);

        const doctors = staff?.filter((s) => s.role === "doctor").length ?? 0;
        const revenue =
          invoices
            ?.filter((i) => i.status === "Paid")
            .reduce((sum, i) => sum + Number(i.total_amount), 0) ?? 0;

        setStats({ patients, appointments, doctors, revenue });
      } else if (role === "doctor" || role === "nurse") {
        const [consultations, appointments] = await Promise.all([
          countOf("consultations"),
          countOf("appointments", { column: "status", value: "Scheduled" }),
        ]);
        setStats({ consultations, appointments });
      } else if (role === "lab") {
        setStats({
          labTests: await countOf("lab_tests", {
            column: "status",
            value: "Requested",
          }),
        });
      } else if (role === "pharmacy") {
        const { data: meds, error: mErr } = await supabase
          .schema("medicore")
          .from("medicines")
          .select("stock,reorder_level");
        if (mErr) throw mErr;
        const medicinesLowStock =
          meds?.filter((m) => m.stock <= (m.reorder_level ?? 10)).length ?? 0;
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

  /* ---------------- TODAY OPERATIONS ---------------- */

  const fetchTodayStats = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const [todayAppointments, pendingLab, pendingRx] = await Promise.all([
        countOf("appointments", { column: "appointment_date", value: today }),
        countOf("lab_tests", { column: "status", value: "Requested" }),
        countOf("prescriptions", { column: "status", value: "Pending" }),
      ]);
      setTodayStats({
        todayAppointments,
        pendingLab,
        pendingPrescriptions: pendingRx,
      });
    } catch (e) {
      console.error("[Dashboard] fetchTodayStats error:", e);
    }
  }, []);

  /* ---------------- CHART DATA ---------------- */

  const fetchCharts = useCallback(async () => {
    try {
      // Appointment status distribution (donut).
      const { data: appts } = await supabase
        .schema("medicore")
        .from("appointments")
        .select("status,appointment_date");

      const palette: Record<string, string> = {
        Scheduled: "#0d9488",
        "Checked In": "#0ea5e9",
        Completed: "#10b981",
        Cancelled: "#f43f5e",
      };
      const grouped: Record<string, number> = {};
      appts?.forEach((a) => {
        const s = a.status ?? "Scheduled";
        grouped[s] = (grouped[s] ?? 0) + 1;
      });
      setStatusSlices(
        Object.entries(grouped).map(([name, value]) => ({
          name,
          value,
          color: palette[name] ?? "#94a3b8",
        }))
      );

      // 7-day appointment trend.
      const days: DayPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-US", { weekday: "short" });
        const count =
          appts?.filter((a) => a.appointment_date === iso).length ?? 0;
        days.push({ day: label, appointments: count });
      }
      setWeekly(days);
    } catch (e) {
      console.error("[Dashboard] fetchCharts error:", e);
    }
  }, []);

  /* ---------------- LOAD ALL ---------------- */

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchTodayStats(), fetchCharts()]);
    setLastUpdated(new Date());
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchStats, fetchTodayStats, fetchCharts]);

  useEffect(() => {
    if (role) {
      void loadAll();
    } else {
      setStats({});
    }
  }, [role, loadAll]);

  /* ---------------- REALTIME ---------------- */
  // schema must be "medicore"; tables must be in the supabase_realtime publication.
  useEffect(() => {
    const onChange = () => {
      void fetchStats();
      void fetchTodayStats();
      void fetchCharts();
      setLastUpdated(new Date());
    };

    const tables = [
      "patients",
      "appointments",
      "invoices",
      "lab_tests",
      "prescriptions",
      "medicines",
      "consultations",
      "staff",
    ];

    let channel = supabase.channel("medicore-live-dashboard");
    tables.forEach((table) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "medicore", table },
        onChange
      );
    });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats, fetchTodayStats, fetchCharts]);

  /* ---------------- DERIVED ---------------- */

  const activeKpis = kpiConfig.filter((k) => stats[k.key] !== undefined);
  const totalAppts = statusSlices.reduce((s, x) => s + x.value, 0);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen space-y-6 rounded-2xl bg-slate-50 p-4 sm:p-6 lg:p-8">
      {/* ---------- HEADER ---------- */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-cyan-600 to-teal-700 p-6 text-white shadow-lg shadow-teal-600/20 sm:p-8"
      >
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              Live data
              {role && (
                <span className="capitalize text-teal-50">· {role}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting}, {profile?.name?.split(" ")[0] ?? "there"} 👋
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-teal-50">
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
        >
          <Activity className="h-4 w-4 shrink-0" /> {error}
        </motion.div>
      )}

      {/* ---------- KPI CARDS ---------- */}
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
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0 },
              }}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
            >
              <div
                className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${k.gradient} opacity-10 transition group-hover:scale-150`}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{k.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {k.currency ? formatKES(value) : <AnimatedNumber value={value} />}
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${k.gradient} text-white shadow-lg`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ---------- CHARTS ---------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Weekly trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <TrendingUp className="h-4 w-4 text-teal-600" /> Appointment Flow
              </h3>
              <p className="text-sm text-slate-500">Last 7 days</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              <HeartPulse className="h-3.5 w-3.5" />
              {weekly.reduce((s, d) => s + d.appointments, 0)} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={weekly} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="aptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="appointments"
                stroke="#0d9488"
                strokeWidth={2.5}
                fill="url(#aptGrad)"
                dot={{ r: 3, fill: "#0d9488" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status donut */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
          className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-1 text-base font-semibold text-slate-800">
            Appointment Status
          </h3>
          <p className="mb-2 text-sm text-slate-500">Live distribution</p>
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  stroke="none"
                >
                  {statusSlices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                  }}
                />
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
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </span>
                <span className="font-semibold text-slate-700">{s.value}</span>
              </div>
            ))}
            {statusSlices.length === 0 && (
              <p className="text-center text-xs text-slate-400">No data yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* ---------- TODAY'S OPERATIONS ---------- */}
      <div>
        <h2 className="mb-3 mt-2 flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Activity className="h-5 w-5 text-teal-600" /> Today's Operations
        </h2>
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {[
            {
              label: "Today's Appointments",
              value: todayStats.todayAppointments,
              icon: CalendarDays,
              gradient: "from-sky-500 to-blue-600",
            },
            {
              label: "Pending Lab Tests",
              value: todayStats.pendingLab,
              icon: FlaskConical,
              gradient: "from-amber-500 to-orange-600",
            },
            {
              label: "Pending Prescriptions",
              value: todayStats.pendingPrescriptions,
              icon: Pill,
              gradient: "from-violet-500 to-purple-600",
            },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.label}
                variants={{
                  hidden: { opacity: 0, scale: 0.96 },
                  show: { opacity: 1, scale: 1 },
                }}
                whileHover={{ y: -3 }}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.gradient} text-white shadow-lg`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    <AnimatedNumber value={c.value} />
                  </p>
                  <p className="text-sm text-slate-500">{c.label}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ---------- FOOTER ---------- */}
      {lastUpdated && (
        <p className="text-center text-xs text-slate-400">
          Last updated {lastUpdated.toLocaleTimeString()} · Auto-refreshing in real time
        </p>
      )}
    </div>
  );
}

/* ---------------- ANIMATED NUMBER ---------------- */

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);

  return <>{display.toLocaleString()}</>;
}
