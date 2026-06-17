import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
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
  BarChart3,
  Download,
  DollarSign,
  Users,
  Activity,
  Pill,
  FlaskConical,
  Stethoscope,
  Wallet,
  TrendingUp,
  CalendarClock,
  Loader2,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

interface ReportData {
  totalRevenue: number;
  outstanding: number;
  patientCount: number;
  appointmentCount: number;
  consultationCount: number;
  labCount: number;
  prescriptionCount: number;
  revenueByStatus: { name: string; value: number; color: string }[];
  appointmentsByDept: { name: string; value: number }[];
  doctorsByStatus: { name: string; value: number; color: string }[];
  patientsByStatus: { name: string; value: number; color: string }[];
  labByStatus: { name: string; value: number; color: string }[];
  revenueTrend: { day: string; value: number }[];
}

/* ============================ HELPERS ============================ */

const fmtKES = (n: number) => "KES " + n.toLocaleString("en-KE");

const downloadCSV = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/* ============================ COMPONENT ============================ */

export default function Reports() {
  const { profile } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [doctorPerf, setDoctorPerf] = useState<{ name: string; appointments: number; consultations: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7" | "30">("7");

  const load = useCallback(async () => {
    try {
      const schema = supabase.schema("medicore");
      const [invRes, patRes, aptRes, conRes, labRes, rxRes, staffRes] = await Promise.all([
        schema.from("invoices").select("total_amount, status, paid_at"),
        schema.from("patients").select("status, registered_at"),
        schema.from("appointments").select("department, status, doctor_id"),
        schema.from("consultations").select("id, doctor_id"),
        schema.from("lab_tests").select("status"),
        schema.from("prescriptions").select("status"),
        schema.from("staff").select("id, name, role, status").eq("role", "doctor"),
      ]);

      const invoices = (invRes.data as { total_amount: number; status: string; paid_at: string | null }[]) ?? [];
      const patients = (patRes.data as { status: string; registered_at: string }[]) ?? [];
      const appts = (aptRes.data as { department: string; status: string; doctor_id: string }[]) ?? [];
      const consults = (conRes.data as { id: string; doctor_id: string }[]) ?? [];
      const labs = (labRes.data as { status: string }[]) ?? [];
      const rx = (rxRes.data as { status: string }[]) ?? [];
      const staff = (staffRes.data as { id: string; name: string; role: string; status: string }[]) ?? [];

      const paid = invoices.filter((i) => i.status === "Paid");
      const pending = invoices.filter((i) => i.status === "Pending");
      const totalRevenue = paid.reduce((s, i) => s + Number(i.total_amount), 0);
      const outstanding = pending.reduce((s, i) => s + Number(i.total_amount), 0);

      // Revenue trend
      const days = Number(period);
      const trend: { day: string; value: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split("T")[0];
        const value = paid.filter((inv) => inv.paid_at?.slice(0, 10) === iso).reduce((s, inv) => s + Number(inv.total_amount), 0);
        trend.push({ day: days <= 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.toLocaleDateString("en-US", { day: "numeric", month: "short" }), value });
      }

      const group = <T,>(arr: T[], key: (x: T) => string) => {
        const counts: Record<string, number> = {};
        arr.forEach((x) => { const k = key(x); counts[k] = (counts[k] ?? 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      };

      const deptCounts = group(appts, (a) => a.department);

      const docOn = staff.filter((s) => s.status === "On Duty").length;
      const docOff = staff.length - docOn;

      setData({
        totalRevenue,
        outstanding,
        patientCount: patients.length,
        appointmentCount: appts.length,
        consultationCount: consults.length,
        labCount: labs.length,
        prescriptionCount: rx.length,
        revenueByStatus: [
          { name: "Collected", value: totalRevenue, color: "#2ECC71" },
          { name: "Outstanding", value: outstanding, color: "#F1C40F" },
        ],
        appointmentsByDept: deptCounts.sort((a, b) => b.value - a.value).slice(0, 6),
        doctorsByStatus: [
          { name: "On Duty", value: docOn, color: "#2ECC71" },
          { name: "Off Duty", value: docOff, color: "#94a3b8" },
        ].filter((d) => d.value > 0),
        patientsByStatus: [
          { name: "Active", value: patients.filter((p) => p.status === "Active").length, color: "#2ECC71" },
          { name: "Admitted", value: patients.filter((p) => p.status === "Admitted").length, color: "#1E88E5" },
          { name: "Discharged", value: patients.filter((p) => p.status === "Discharged").length, color: "#F1C40F" },
          { name: "Inactive", value: patients.filter((p) => p.status === "Inactive").length, color: "#94a3b8" },
        ].filter((d) => d.value > 0),
        labByStatus: [
          { name: "Requested", value: labs.filter((l) => l.status === "Requested").length, color: "#F1C40F" },
          { name: "In Progress", value: labs.filter((l) => l.status === "In Progress").length, color: "#1E88E5" },
          { name: "Completed", value: labs.filter((l) => l.status === "Completed").length, color: "#2ECC71" },
        ].filter((d) => d.value > 0),
        revenueTrend: trend,
      });

      // Doctor performance
      const perf = staff.map((s) => ({
        name: s.name,
        appointments: appts.filter((a) => a.doctor_id === s.id).length,
        consultations: consults.filter((c) => c.doctor_id === s.id).length,
      })).filter((p) => p.appointments > 0 || p.consultations > 0).sort((a, b) => (b.appointments + b.consultations) - (a.appointments + a.consultations));
      setDoctorPerf(perf);

      setError(null);
    } catch (e) {
      console.error("[Reports] load error:", e);
      setError("Failed to load report data. Check schema exposure + RLS.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const exports = useMemo(
    () => [
      { label: "Export Revenue (CSV)", icon: DollarSign, onClick: () => data && downloadCSV("medicore-revenue.csv", [{ totalRevenue: data.totalRevenue, outstanding: data.outstanding, appointments: data.appointmentCount }]), tone: "green" },
      { label: "Export Appointments (CSV)", icon: CalendarClock, onClick: () => data && downloadCSV("medicore-appointments.csv", data.appointmentsByDept), tone: "blue" },
      { label: "Export Doctor Perf (CSV)", icon: Stethoscope, onClick: () => downloadCSV("medicore-doctors.csv", doctorPerf), tone: "violet" },
    ],
    [data, doctorPerf]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#EAF4FE]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-gradient-to-b from-white via-[#EAF4FE] to-[#F4F6F8] p-4 md:p-6">
      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"><BarChart3 className="h-3.5 w-3.5" /> Analytics &amp; Reports</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hospital Performance</h1>
            <p className="mt-1 text-sm text-blue-50/90">{period === "7" ? "Last 7 days" : "Last 30 days"} overview{profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-white/15 p-1 backdrop-blur">
              {(["7", "30"] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${period === p ? "bg-white text-[#1E88E5]" : "text-white"}`}>{p}D</button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}

      {/* EXPORT BAR */}
      <div className="flex flex-wrap gap-2">
        {exports.map((ex) => (
          <button key={ex.label} onClick={ex.onClick} className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:bg-white">
            <ex.icon className="h-4 w-4 text-[#1E88E5]" /> {ex.label} <Download className="h-3.5 w-3.5 text-slate-400" />
          </button>
        ))}
      </div>

      {data && (
        <>
          {/* KPI ROW */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total Revenue" value={fmtKES(data.totalRevenue)} icon={DollarSign} gradient="from-[#2ECC71] to-[#58D68D]" />
            <Kpi label="Outstanding" value={fmtKES(data.outstanding)} icon={Wallet} gradient="from-[#F1C40F] to-[#F39C12]" />
            <Kpi label="Patients" value={String(data.patientCount)} icon={Users} gradient="from-[#1E88E5] to-[#64B5F6]" />
            <Kpi label="Consultations" value={String(data.consultationCount)} icon={Stethoscope} gradient="from-violet-500 to-purple-600" />
          </div>

          {/* REVENUE TREND */}
          <ChartCard title="Revenue Trend" subtitle={`Collected · last ${period} days`} icon={<TrendingUp className="h-4 w-4 text-[#2ECC71]" />}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.revenueTrend} margin={{ left: 6, right: 8, top: 8 }}>
                <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2ECC71" stopOpacity={0.35} /><stop offset="95%" stopColor="#2ECC71" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(v) => fmtKES(Number(v))} />
                <Area type="monotone" dataKey="value" name="Revenue" stroke="#2ECC71" strokeWidth={2.5} fill="url(#rev)" dot={{ r: 3, fill: "#2ECC71" }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* DONUTS ROW */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <DonutCard title="Revenue Status" data={data.revenueByStatus} total={`KES ${(data.totalRevenue + data.outstanding).toLocaleString()}`} totalLabel="total billed" formatter={(v) => fmtKES(Number(v))} />
            <DonutCard title="Patients" data={data.patientsByStatus} total={String(data.patientCount)} totalLabel="records" />
            <DonutCard title="Lab Tests" data={data.labByStatus} total={String(data.labCount)} totalLabel="tests" />
          </div>

          {/* DEPT BAR + DOCTOR PERF */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Appointments by Department" subtitle="Top departments" icon={<Activity className="h-4 w-4 text-[#1E88E5]" />}>
              {data.appointmentsByDept.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.appointmentsByDept} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
                    <Bar dataKey="value" name="Appointments" radius={[6, 6, 0, 0]} barSize={28}>
                      {data.appointmentsByDept.map((_, i) => <Cell key={i} fill={["#1E88E5", "#2ECC71", "#F1C40F", "#E74C3C", "#8E44AD", "#1ABC9C"][i % 6]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>

            <ChartCard title="Doctor Performance" subtitle="Appointments vs consultations" icon={<Stethoscope className="h-4 w-4 text-violet-600" />}>
              {doctorPerf.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={doctorPerf} margin={{ left: -20, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
                    <Bar dataKey="appointments" name="Appointments" fill="#1E88E5" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="consultations" name="Consultations" fill="#2ECC71" radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
          </div>

          {/* SUMMARY TABLE */}
          <ChartCard title="Operational Summary" subtitle="Quick snapshot" icon={<ClipboardList className="h-4 w-4 text-[#1E88E5]" />}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryItem icon={Users} label="Patients" value={data.patientCount} tone="text-[#1E88E5]" />
              <SummaryItem icon={CalendarClock} label="Appointments" value={data.appointmentCount} tone="text-violet-600" />
              <SummaryItem icon={Stethoscope} label="Consultations" value={data.consultationCount} tone="text-[#2ECC71]" />
              <SummaryItem icon={FlaskConical} label="Lab Tests" value={data.labCount} tone="text-[#F1C40F]" />
              <SummaryItem icon={Pill} label="Prescriptions" value={data.prescriptionCount} tone="text-[#E74C3C]" />
              <SummaryItem icon={DollarSign} label="Revenue" value={data.totalRevenue} tone="text-[#1E88E5]" money />
              <SummaryItem icon={Wallet} label="Outstanding" value={data.outstanding} tone="text-[#B8860B]" money />
              <SummaryItem icon={Activity} label="Avg Revenue/Day" value={Math.round(data.totalRevenue / (Number(period) || 1))} tone="text-[#2ECC71]" money />
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function Kpi({ label, value, icon: Icon, gradient }: { label: string; value: string; icon: typeof DollarSign; gradient: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl`}>{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
      </div>
    </motion.div>
  );
}

function ChartCard({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <div className="mb-4 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F6F8]">{icon}</div><div><h3 className="text-base font-semibold text-slate-800">{title}</h3>{subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}</div></div>
      {children}
    </div>
  );
}

function DonutCard({ title, data, total, totalLabel, formatter }: { title: string; data: { name: string; value: number; color: string }[]; total: string; totalLabel: string; formatter?: (v: number) => string }) {
  return (
    <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mb-2 text-xs text-slate-500">Distribution</p>
      {data.length ? (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                  {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={formatter ? (v) => formatter(Number(v)) : undefined} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-bold text-slate-900">{total}</span><span className="text-[10px] text-slate-400">{totalLabel}</span></div>
          </div>
          <div className="mt-3 space-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                <span className="font-semibold text-slate-700">{formatter ? formatter(Number(d.value)) : d.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : <Empty />}
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, tone, money }: { icon: typeof DollarSign; label: string; value: number; tone: string; money?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/50 p-3">
      <Icon className={`h-5 w-5 ${tone}`} />
      <div><p className="text-xs text-slate-400">{label}</p><p className={`text-sm font-bold ${tone}`}>{money ? fmtKES(value) : value.toLocaleString()}</p></div>
    </div>
  );
}

function Empty() {
  return <div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>;
}
