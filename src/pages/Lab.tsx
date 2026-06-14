import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FlaskConical,
  TestTube,
  Droplet,
  Bug,
  Microscope,
  Search,
  X,
  Eye,
  Clock,
  CheckCircle2,
  Loader2,
  Upload,
  PlayCircle,
  FileText,
  Stethoscope,
  User,
  AlertTriangle,
  Activity,
  CalendarClock,
  Beaker,
  ListChecks,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type LabStatus = "Requested" | "In Progress" | "Completed";

interface LabTest {
  id: string;
  patient_id: string;
  doctor_id: string;
  test_type: string;
  status: LabStatus;
  result: string | null;
  requested_at: string;
  completed_at: string | null;
  patients?: { name: string }[] | null;
  staff?: { name: string }[] | null;
}

/* ============================ THEME ============================ */

const STATUS_META: Record<
  LabStatus,
  { chip: string; dot: string; hex: string; icon: typeof Clock }
> = {
  Requested: {
    chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40",
    dot: "#F1C40F",
    hex: "#F1C40F",
    icon: Clock,
  },
  "In Progress": {
    chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30",
    dot: "#1E88E5",
    hex: "#1E88E5",
    icon: Loader2,
  },
  Completed: {
    chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30",
    dot: "#2ECC71",
    hex: "#2ECC71",
    icon: CheckCircle2,
  },
};

const testIconFor = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("blood") || t.includes("cbc") || t.includes("hb") || t.includes("sugar")) return Droplet;
  if (t.includes("malaria")) return Bug;
  if (t.includes("covid")) return Bug;
  if (t.includes("urine")) return Beaker;
  return TestTube;
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

/* ============================ HELPERS ============================ */

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const patientName = (t: LabTest) => t.patients?.[0]?.name ?? "Unknown";
const doctorName = (t: LabTest) => t.staff?.[0]?.name ?? "—";

/* ============================ COMPONENT ============================ */

export default function Lab() {
  const { profile } = useAuth();

  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LabStatus | "All">("All");

  const [viewing, setViewing] = useState<LabTest | null>(null);
  const [uploading, setUploading] = useState<LabTest | null>(null);
  const [resultText, setResultText] = useState("");
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .schema("medicore")
        .from("lab_tests")
        .select(
          "id, patient_id, doctor_id, test_type, status, result, requested_at, completed_at, patients(name), staff(name)"
        )
        .order("requested_at", { ascending: false });
      if (err) throw err;
      setTests((data as LabTest[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Lab] load error:", e);
      setError("Failed to load lab tests. Check schema exposure + RLS + foreign-key relations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel("medicore-lab")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "lab_tests" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return tests.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        patientName(t).toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.test_type.toLowerCase().includes(q) ||
        doctorName(t).toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tests, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: tests.length,
      requested: tests.filter((t) => t.status === "Requested").length,
      inProgress: tests.filter((t) => t.status === "In Progress").length,
      completed: tests.filter((t) => t.status === "Completed").length,
    }),
    [tests]
  );

  const statusData = useMemo(
    () =>
      (["Requested", "In Progress", "Completed"] as LabStatus[])
        .map((k) => ({
          name: k,
          value: tests.filter((t) => t.status === k).length,
          color: STATUS_META[k].hex,
        }))
        .filter((d) => d.value > 0),
    [tests]
  );

  const trendData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: tests.filter((t) => t.requested_at?.slice(0, 10) === iso).length,
      });
    }
    return days;
  }, [tests]);

  /* ---------------- ACTIONS ---------------- */
  const advance = async (t: LabTest) => {
    try {
      const { error: e } = await supabase
        .schema("medicore")
        .from("lab_tests")
        .update({ status: "In Progress" })
        .eq("id", t.id);
      if (e) throw e;
      showToast("info", `${t.id} is now In Progress.`);
      await load();
    } catch (e) {
      console.error("[Lab] advance error:", e);
      showToast("error", "Could not update status.");
    }
  };

  const openUpload = (t: LabTest) => {
    setUploading(t);
    setResultText(t.result ?? "");
  };

  const submitResult = async () => {
    if (!uploading || !resultText.trim()) {
      showToast("error", "Please enter the result/findings.");
      return;
    }
    setSaving(true);
    try {
      const { error: e } = await supabase
        .schema("medicore")
        .from("lab_tests")
        .update({
          status: "Completed",
          result: resultText.trim(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", uploading.id);
      if (e) throw e;
      showToast("success", `Result uploaded for ${uploading.id}. Doctor & patient notified.`);
      setUploading(null);
      setResultText("");
      await load();
    } catch (e) {
      console.error("[Lab] result error:", e);
      showToast("error", "Could not save result.");
    } finally {
      setSaving(false);
    }
  };

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
              <FlaskConical className="h-3.5 w-3.5" /> Laboratory Module
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lab Test Requests</h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Process test requests, run diagnostics & upload results
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl bg-white/10 px-5 py-4 backdrop-blur">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Microscope className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold leading-none">{stats.requested + stats.inProgress}</p>
              <p className="text-xs text-blue-100">Pending tests</p>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tests" value={stats.total} icon={TestTube} gradient="from-[#1E88E5] to-[#64B5F6]" delta="All requests" />
        <StatCard label="Requested" value={stats.requested} icon={Clock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Awaiting" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Loader2} gradient="from-[#1E88E5] to-[#42A5F5]" delta="Running" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} gradient="from-[#2ECC71] to-[#58D68D]" delta="Done" />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Activity className="h-4 w-4 text-[#1E88E5]" /> Test Requests Trend
            </h3>
            <p className="text-sm text-slate-500">Last 7 days</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="labGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#1E88E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Area type="monotone" dataKey="count" name="Tests" stroke="#1E88E5" strokeWidth={2.5} fill="url(#labGrad)" dot={{ r: 3, fill: "#1E88E5" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <ListChecks className="h-4 w-4 text-violet-600" /> Status Split
          </h3>
          <p className="mb-2 text-sm text-slate-500">Distribution</p>
          {statusData.length ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                      {statusData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                  <span className="text-xs text-slate-400">tests</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-slate-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>
          )}
        </motion.div>
      </div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-3.5 py-2.5 lg:w-80">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, ID, test type..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <FilterPills options={["All", "Requested", "In Progress", "Completed"]} value={statusFilter} onChange={(v) => setStatusFilter(v as LabStatus | "All")} />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {tests.length} tests
        </p>
      </div>

      {/* TEST CARDS */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/70 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white py-16 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
            <FlaskConical className="h-8 w-8" />
          </div>
          <p className="font-semibold text-slate-700">No lab tests found</p>
          <p className="mt-1 text-sm text-slate-400">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, i) => {
            const Icon = testIconFor(t.test_type);
            const meta = STATUS_META[t.status];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -5 }}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:shadow-lg"
              >
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: meta.hex }} />
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white shadow-lg">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{t.test_type}</h3>
                      <p className="text-xs text-slate-400">{t.id}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}>
                    <meta.icon className="h-3 w-3" /> {t.status}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl bg-[#F4F6F8] p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1E88E5]">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{patientName(t)}</p>
                    <p className="truncate text-xs text-slate-500">Req. by {doctorName(t)}</p>
                  </div>
                </div>

                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarClock className="h-3.5 w-3.5" /> {fmtDateTime(t.requested_at)}
                </p>

                {t.result && (
                  <div className="mt-3 rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/5 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1E8C4A]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Result
                    </p>
                    <p className="mt-1 text-xs text-[#1E8C4A]/80">{t.result}</p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setViewing(t)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  {t.status === "Requested" && (
                    <button
                      onClick={() => advance(t)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5] py-2 text-xs font-semibold text-white transition hover:bg-[#1976D2]"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Start
                    </button>
                  )}
                  {t.status === "In Progress" && (
                    <button
                      onClick={() => openUpload(t)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71] py-2 text-xs font-semibold text-white transition hover:bg-[#27AE60]"
                    >
                      <Upload className="h-3.5 w-3.5" /> Result
                    </button>
                  )}
                  {t.status === "Completed" && (
                    <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71]/10 py-2 text-xs font-semibold text-[#1E8C4A]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Done
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Lab Test Details" subtitle={viewing?.id} icon={<FlaskConical className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white">
                  {(() => {
                    const Icon = testIconFor(viewing.test_type);
                    return <Icon className="h-6 w-6" />;
                  })()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{viewing.test_type}</h3>
                  <p className="text-sm text-slate-500">{viewing.id}</p>
                </div>
              </div>
              <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_META[viewing.status].chip}`}>
                {viewing.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={User} label="Patient" value={patientName(viewing)} />
              <InfoRow icon={Stethoscope} label="Requested By" value={doctorName(viewing)} />
              <InfoRow icon={CalendarClock} label="Requested At" value={fmtDateTime(viewing.requested_at)} />
              <InfoRow icon={CheckCircle2} label="Completed At" value={viewing.completed_at ? fmtDateTime(viewing.completed_at) : "—"} />
            </div>

            {viewing.result && (
              <div className="rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/5 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1E8C4A]">
                  <FileText className="h-4 w-4" /> Result / Findings
                </p>
                <p className="mt-2 text-sm text-[#1E8C4A]/80">{viewing.result}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Close
              </button>
              {viewing.status !== "Completed" && (
                <>
                  {viewing.status === "Requested" && (
                    <button onClick={() => advance(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]">
                      <PlayCircle className="h-4 w-4" /> Start Test
                    </button>
                  )}
                  <button onClick={() => { const t = viewing; setViewing(null); openUpload(t); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]">
                    <Upload className="h-4 w-4" /> Upload Result
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- UPLOAD RESULT MODAL ---------------- */}
      <Modal open={!!uploading} onClose={() => setUploading(null)} title="Upload Lab Result" subtitle={uploading?.test_type} icon={<Upload className="h-5 w-5" />}>
        {uploading && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#F4F6F8] p-4">
              <p className="text-sm font-semibold text-slate-800">{patientName(uploading)}</p>
              <p className="text-xs text-slate-500">
                {uploading.id} · Requested by {doctorName(uploading)}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Result / Findings <span className="text-[#E74C3C]">*</span>
              </label>
              <textarea
                className={`${inputCls} min-h-[100px] resize-y`}
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                placeholder="e.g. Positive — Plasmodium falciparum (+2)"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#1E88E5]/5 p-3 text-xs text-[#1E88E5]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              On submit, status becomes Completed and the requesting doctor + patient are notified.
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setUploading(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={submitResult}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2ECC71]/30 transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Submit Result
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- TOAST ---------------- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            className={`fixed bottom-24 left-1/2 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl lg:bottom-6 ${
              toast.type === "success" ? "bg-[#2ECC71]" : toast.type === "error" ? "bg-[#E74C3C]" : "bg-[#1E88E5]"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : toast.type === "error" ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  delta,
}: {
  label: string;
  value: number;
  icon: typeof TestTube;
  gradient: string;
  delta: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{display.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">{delta}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof TestTube; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F6F8] text-[#1E88E5]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function FilterPills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === o ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${size === "lg" ? "max-w-2xl" : "max-w-xl"}`}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
                    {icon}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                  {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
