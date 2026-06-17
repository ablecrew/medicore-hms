import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  ChevronRight,
  Activity,
  CheckCheck,
  CircleDot,
  Stethoscope,
  FlaskConical,
  Pill,
  Wallet,
  BedDouble,
  Users,
  CalendarClock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type Priority = "low" | "normal" | "high" | "critical";
type NStatus = "unread" | "read" | "dismissed";

interface Notification {
  id: number;
  title: string;
  message: string;
  role: string | null;
  staff_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: Priority;
  status: NStatus;
  created_at: string;
}

interface DerivedTask {
  title: string;
  count: number;
  icon: typeof Bell;
  tone: string;
  link: string;
  priority: Priority;
}

/* ============================ THEME ============================ */

const PRIORITY_META: Record<
  Priority,
  { chip: string; bar: string; dot: string; icon: typeof Clock }
> = {
  critical: {
    chip: "bg-[#E74C3C]/10 text-[#C0392B] ring-[#E74C3C]/30",
    bar: "bg-[#E74C3C]",
    dot: "#E74C3C",
    icon: Flame,
  },
  high: {
    chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40",
    bar: "bg-[#F1C40F]",
    dot: "#F1C40F",
    icon: AlertTriangle,
  },
  normal: {
    chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30",
    bar: "bg-[#1E88E5]",
    dot: "#1E88E5",
    icon: Bell,
  },
  low: {
    chip: "bg-slate-100 text-slate-500 ring-slate-200",
    bar: "bg-slate-300",
    dot: "#94a3b8",
    icon: CircleDot,
  },
};

const ENTITY_ICON: Record<string, typeof Bell> = {
  inventory: Pill,
  invoice: Wallet,
  prescription: Pill,
  lab_test: FlaskConical,
  appointment: CalendarClock,
  patient: Users,
  consultation: Stethoscope,
  admission: BedDouble,
  staff: Users,
};

/* ============================ HELPERS ============================ */

const fmtRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/* ============================ COMPONENT ============================ */

export default function Notifications() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [derived, setDerived] = useState<DerivedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"attention" | "today" | "critical" | "read">("attention");
  const [acting, setActing] = useState<number | null>(null);

  /* ---------------- LOAD NOTIFICATIONS ---------------- */
  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .schema("medicore")
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (err) throw err;
      setNotifications((data as Notification[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Notifications] load error:", e);
      setError("Failed to load notifications. Check RLS + schema exposure.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------------- DERIVE LIVE TASKS PER ROLE ---------------- */
  const loadDerived = useCallback(async () => {
    if (!role) {
      setDerived([]);
      return;
    }
    try {
      const tasks: DerivedTask[] = [];
      const today = new Date().toISOString().split("T")[0];
      const schema = supabase.schema("medicore");

      if (role === "pharmacy" || role === "admin") {
        const { count: rx } = await schema.from("prescriptions").select("*", { count: "exact", head: true }).eq("status", "Pending");
        tasks.push({ title: "Pending prescriptions", count: rx ?? 0, icon: Pill, tone: "amber", link: "/pharmacy", priority: "high" });
        const { count: low } = await schema.from("medicines").select("*", { count: "exact", head: true }).lte("stock", 10);
        tasks.push({ title: "Low-stock medicines", count: low ?? 0, icon: AlertTriangle, tone: "red", link: "/pharmacy", priority: "critical" });
      }

      if (role === "lab" || role === "admin") {
        const { count: req } = await schema.from("lab_tests").select("*", { count: "exact", head: true }).eq("status", "Requested");
        tasks.push({ title: "Requested tests", count: req ?? 0, icon: FlaskConical, tone: "amber", link: "/lab", priority: "high" });
      }

      if (role === "admin") {
        const { count: unpaid } = await schema.from("invoices").select("*", { count: "exact", head: true }).eq("status", "Pending");
        tasks.push({ title: "Unpaid invoices", count: unpaid ?? 0, icon: Wallet, tone: "red", link: "/billing", priority: "high" });
        const { count: off } = await schema.from("staff").select("*", { count: "exact", head: true }).eq("status", "Off Duty");
        tasks.push({ title: "Staff off duty", count: off ?? 0, icon: Users, tone: "blue", link: "/staff", priority: "low" });
      }

      if (role === "reception" || role === "admin") {
        const { count: appt } = await schema.from("appointments").select("*", { count: "exact", head: true }).eq("appointment_date", today).eq("status", "Scheduled");
        tasks.push({ title: "Today's appointments", count: appt ?? 0, icon: CalendarClock, tone: "blue", link: "/appointments", priority: "normal" });
        const { count: admitted } = await schema.from("patients").select("*", { count: "exact", head: true }).eq("status", "Admitted");
        tasks.push({ title: "Admitted patients", count: admitted ?? 0, icon: BedDouble, tone: "red", link: "/admissions", priority: "high" });
      }

      if (role === "doctor" || role === "admin") {
        const { count: con } = await schema.from("consultations").select("*", { count: "exact", head: true });
        tasks.push({ title: "Total consultations", count: con ?? 0, icon: Stethoscope, tone: "blue", link: "/consultations", priority: "low" });
        const { count: pendLab } = await schema.from("lab_tests").select("*", { count: "exact", head: true }).eq("status", "Requested");
        tasks.push({ title: "Pending lab results", count: pendLab ?? 0, icon: FlaskConical, tone: "amber", link: "/lab", priority: "high" });
      }

      if (role === "nurse" || role === "admin") {
        const { count: admitted } = await schema.from("patients").select("*", { count: "exact", head: true }).eq("status", "Admitted");
        tasks.push({ title: "Admitted patients", count: admitted ?? 0, icon: BedDouble, tone: "red", link: "/admissions", priority: "high" });
      }

      setDerived(tasks.filter((t) => t.count > 0));
    } catch (e) {
      console.error("[Notifications] derive error:", e);
    }
  }, [role]);

  useEffect(() => {
    void load();
    void loadDerived();
  }, [load, loadDerived]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel("medicore-notifications")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "notifications" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- ACTIONS ---------------- */
  const markRead = async (id: number) => {
    setActing(id);
    try {
      await supabase.schema("medicore").from("notifications").update({ status: "read" }).eq("id", id);
      await load();
    } catch (e) {
      console.error("[Notifications] markRead error:", e);
    } finally {
      setActing(null);
    }
  };

  const markAllRead = async () => {
    setActing(-1);
    try {
      await supabase
        .schema("medicore")
        .from("notifications")
        .update({ status: "read" })
        .in("status", ["unread"]);
      await load();
    } catch (e) {
      console.error("[Notifications] markAllRead error:", e);
    } finally {
      setActing(null);
    }
  };

  const dismiss = async (id: number) => {
    setActing(id);
    try {
      await supabase.schema("medicore").from("notifications").update({ status: "dismissed" }).eq("id", id);
      await load();
    } catch (e) {
      console.error("[Notifications] dismiss error:", e);
    } finally {
      setActing(null);
    }
  };

  const openEntity = (n: Notification) => {
    markRead(n.id);
    const route: Record<string, string> = {
      inventory: "/pharmacy",
      prescription: "/pharmacy",
      lab_test: "/lab",
      invoice: "/billing",
      appointment: "/appointments",
      patient: "/patients",
      consultation: "/consultations",
      admission: "/admissions",
      staff: "/staff",
    };
    const to = route[n.entity_type ?? ""] ?? "/dashboard";
    navigate(to);
  };

  /* ---------------- DERIVED UI ---------------- */
  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const sectioned = useMemo(() => {
    const q = search.toLowerCase();
    const matches = (n: Notification) =>
      !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);

    const pool = notifications.filter(matches);
    return {
      attention: pool.filter((n) => n.status === "unread" && (n.priority === "high" || n.priority === "critical")),
      today: pool.filter((n) => n.status === "unread" && isToday(n.created_at)),
      critical: pool.filter((n) => n.priority === "critical" && n.status !== "dismissed"),
      read: pool.filter((n) => n.status === "read" || n.status === "dismissed"),
    };
  }, [notifications, search]);

  const currentList = sectioned[section];

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-gradient-to-b from-white via-[#EAF4FE] to-[#F4F6F8] p-4 md:p-6">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Bell className="h-3.5 w-3.5" /> Work Queue &amp; Alerts
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks &amp; Notifications</h1>
            <p className="mt-1 text-sm text-blue-50/90 capitalize">
              {role} workspace · {unreadCount} item{unreadCount !== 1 ? "s" : ""} need your attention
            </p>
          </div>
          {unreadCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={markAllRead}
              disabled={acting === -1}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50 disabled:opacity-60"
            >
              {acting === -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all read
            </motion.button>
          )}
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* DERIVED TASK CARDS */}
      {derived.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <Activity className="h-4 w-4 text-[#1E88E5]" />
            <span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Live Workload</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {derived.map((t, i) => (
              <motion.button
                key={t.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(t.link)}
                className="group flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 text-left shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:shadow-xl"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[${t.tone}]/10 ${toneText(t.tone)}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-slate-900">{t.count}</p>
                  <p className="truncate text-xs text-slate-500">{t.title}</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#1E88E5]" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md lg:w-80">
            <Search className="h-4 w-4 text-[#1E88E5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">
            {([
              ["attention", "Needs Attention"],
              ["today", "Today"],
              ["critical", "Critical"],
              ["read", "Completed"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  section === key ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                {key === "attention" && sectioned.attention.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#E74C3C]/15 px-1.5 py-0.5 text-[10px] text-[#C0392B]">
                    {sectioned.attention.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-white/50 bg-white/70 backdrop-blur-md">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/50 bg-white/70 py-16 text-center backdrop-blur-md">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2ECC71]/10 text-[#1E8C4A]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="font-semibold text-slate-700">You're all caught up</p>
          <p className="mt-1 text-sm text-slate-400">Nothing in this section right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {currentList.map((n, i) => {
              const meta = PRIORITY_META[n.priority];
              const EntIcon = ENTITY_ICON[n.entity_type ?? ""] ?? Bell;
              const PIcon = meta.icon;
              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -2 }}
                  className={`group relative flex items-start gap-4 overflow-hidden rounded-2xl border bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:shadow-xl ${
                    n.status === "unread" ? "border-white/60" : "border-white/40 opacity-70"
                  }`}
                >
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${meta.bar}`} />
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.chip}`}>
                    {n.status === "unread" ? <PIcon className="h-5 w-5" /> : <EntIcon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-sm ${n.status === "unread" ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                        {n.title}
                      </h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${meta.chip}`}>
                        {n.priority}
                      </span>
                      {n.status === "unread" && <span className="h-2 w-2 rounded-full bg-[#1E88E5]" />}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" /> {fmtRelative(n.created_at)}
                      {n.role && <span className="capitalize">· {n.role}</span>}
                    </p>
                  </div>
                  {/* actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    {n.entity_type && (
                      <button
                        onClick={() => openEntity(n)}
                        title="Open"
                        className="rounded-lg p-2 text-[#1E88E5] transition hover:bg-[#1E88E5]/10"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    {n.status === "unread" && (
                      <button
                        onClick={() => markRead(n.id)}
                        disabled={acting === n.id}
                        title="Mark read"
                        className="rounded-lg p-2 text-[#1E8C4A] transition hover:bg-[#2ECC71]/10"
                      >
                        {acting === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(n.id)}
                      title="Dismiss"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-[#E74C3C]/10 hover:text-[#C0392B]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ---- helper for dynamic tailwind tone text ---- */
function toneText(tone: string) {
  return tone === "red" ? "text-[#C0392B]" : tone === "amber" ? "text-[#B8860B]" : tone === "blue" ? "text-[#1E88E5]" : "text-[#1E8C4A]";
}
