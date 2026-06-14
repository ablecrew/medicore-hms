import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
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
  Receipt,
  Plus,
  Search,
  X,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  CreditCard,
  DollarSign,
  Banknote,
  AlertTriangle,
  Activity,
  TrendingUp,
  FileText,
  Printer,
  Wallet,
  ArrowRight,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type InvoiceStatus = "Paid" | "Pending" | "Cancelled";

interface InvoiceItem {
  id: number;
  invoice_id: string;
  service: string;
  amount: number;
}

interface Invoice {
  id: string;
  patient_id: string;
  total_amount: number;
  status: InvoiceStatus;
  payment_method: string | null;
  invoice_date: string;
  paid_at: string | null;
  patients?: { name: string }[] | null;
  invoice_items?: InvoiceItem[] | null;
}

interface PatientOption {
  id: string;
  name: string;
}

/* ============================ THEME ============================ */

const STATUS_META: Record<
  InvoiceStatus,
  { chip: string; dot: string; hex: string; icon: typeof Clock }
> = {
  Paid: { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71", hex: "#2ECC71", icon: CheckCircle2 },
  Pending: { chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40", dot: "#F1C40F", hex: "#F1C40F", icon: Clock },
  Cancelled: { chip: "bg-[#E74C3C]/10 text-[#C0392B] ring-[#E74C3C]/30", dot: "#E74C3C", hex: "#E74C3C", icon: X },
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

const SERVICE_PRESETS = [
  "Consultation",
  "Lab Test",
  "Pharmacy",
  "X-Ray",
  "ECG",
  "Ultrasound",
  "Procedure",
  "Ward (per day)",
];

/* ============================ HELPERS ============================ */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtKES = (n: number) => "KES " + Number(n).toLocaleString("en-KE");

const patientName = (inv: Invoice) => inv.patients?.[0]?.name ?? "Unknown";
const itemCount = (inv: Invoice) => inv.invoice_items?.length ?? 0;

/* ============================ COMPONENT ============================ */

export default function Billing() {
  const { profile } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");

  // modals
  const [genOpen, setGenOpen] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  // generate form
  const [formPatient, setFormPatient] = useState("");
  const [lineItems, setLineItems] = useState<{ service: string; amount: string }[]>([
    { service: "Consultation", amount: "1500" },
  ]);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const [invRes, patRes] = await Promise.all([
        supabase
          .schema("medicore")
          .from("invoices")
          .select("id, patient_id, total_amount, status, payment_method, invoice_date, paid_at, patients(name), invoice_items(id, invoice_id, service, amount)")
          .order("invoice_date", { ascending: false }),
        supabase.schema("medicore").from("patients").select("id, name").order("name"),
      ]);
      if (invRes.error) throw invRes.error;
      if (patRes.error) throw patRes.error;
      setInvoices((invRes.data as Invoice[]) ?? []);
      setPatients((patRes.data as PatientOption[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Billing] load error:", e);
      setError("Failed to load invoices. Check schema exposure + RLS.");
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
      .channel("medicore-billing")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "invoices" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "invoice_items" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q || patientName(inv).toLowerCase().includes(q) || inv.id.toLowerCase().includes(q) || inv.status.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "Paid");
    const pending = invoices.filter((i) => i.status === "Pending");
    return {
      totalRevenue: paid.reduce((s, i) => s + Number(i.total_amount), 0),
      outstanding: pending.reduce((s, i) => s + Number(i.total_amount), 0),
      count: invoices.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      avg: paid.length ? paid.reduce((s, i) => s + Number(i.total_amount), 0) / paid.length : 0,
    };
  }, [invoices]);

  const statusData = useMemo(
    () =>
      (["Paid", "Pending", "Cancelled"] as InvoiceStatus[])
        .map((k) => ({ name: k, value: invoices.filter((i) => i.status === k).length, color: STATUS_META[k].hex }))
        .filter((d) => d.value > 0),
    [invoices]
  );

  const revenueTrend = useMemo(() => {
    const days: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: invoices
          .filter((i) => i.status === "Paid" && i.paid_at?.slice(0, 10) === iso)
          .reduce((s, i) => s + Number(i.total_amount), 0),
      });
    }
    return days;
  }, [invoices]);

  /* ---------------- LINE ITEM HANDLERS ---------------- */
  const addLine = () => setLineItems([...lineItems, { service: "", amount: "" }]);
  const updateLine = (i: number, patch: Partial<{ service: string; amount: string }>) =>
    setLineItems(lineItems.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));

  const lineTotal = lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  /* ---------------- GENERATE INVOICE ---------------- */
  const openGenerate = () => {
    setFormPatient("");
    setLineItems([{ service: "Consultation", amount: "1500" }]);
    setGenOpen(true);
  };

  const submitGenerate = async () => {
    if (!formPatient) {
      showToast("error", "Please select a patient.");
      return;
    }
    const validLines = lineItems.filter((l) => l.service.trim() && Number(l.amount) > 0);
    if (validLines.length === 0) {
      showToast("error", "Add at least one valid line item.");
      return;
    }
    setSaving(true);
    try {
      const id = `INV-${String(stats.count + 1).padStart(4, "0")}`;
      // 1. Create the invoice (Pending). total_amount is recalculated by the DB trigger.
      const { error: invErr } = await supabase
        .schema("medicore")
        .from("invoices")
        .insert({ id, patient_id: formPatient, status: "Pending", total_amount: 0 });
      if (invErr) throw invErr;

      // 2. Insert line items -> trigger updates total_amount automatically.
      const { error: itemErr } = await supabase
        .schema("medicore")
        .from("invoice_items")
        .insert(validLines.map((l) => ({ invoice_id: id, service: l.service.trim(), amount: Number(l.amount) })));
      if (itemErr) throw itemErr;

      showToast("success", `Invoice ${id} generated for ${fmtKES(lineTotal)}.`);
      setGenOpen(false);
      await load();
    } catch (e) {
      console.error("[Billing] generate error:", e);
      showToast("error", "Could not generate invoice.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- MARK PAID ---------------- */
  const markPaid = async (inv: Invoice) => {
    setSaving(true);
    try {
      const { error: e } = await supabase
        .schema("medicore")
        .from("invoices")
        .update({ status: "Paid", payment_method: "M-Pesa", paid_at: new Date().toISOString() })
        .eq("id", inv.id);
      if (e) throw e;
      showToast("success", `${inv.id} marked as Paid.`);
      setPaying(null);
      setViewing(null);
      await load();
    } catch (e) {
      console.error("[Billing] paid error:", e);
      showToast("error", "Could not update invoice.");
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
              <Receipt className="h-3.5 w-3.5" /> Billing &amp; Invoicing
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financial Operations</h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Generate invoices &amp; track revenue
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={openGenerate}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> Generate Invoice
          </motion.button>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={stats.totalRevenue} icon={DollarSign} gradient="from-[#2ECC71] to-[#58D68D]" delta="Paid invoices" money />
        <StatCard label="Outstanding" value={stats.outstanding} icon={Clock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Pending" money />
        <StatCard label="Total Invoices" value={stats.count} icon={FileText} gradient="from-[#1E88E5] to-[#64B5F6]" delta={`${stats.paidCount} paid`} />
        <StatCard label="Avg. Invoice" value={stats.avg} icon={TrendingUp} gradient="from-violet-500 to-purple-600" delta="Per payment" money />
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
              <Activity className="h-4 w-4 text-[#2ECC71]" /> Revenue Trend
            </h3>
            <p className="text-sm text-slate-500">Collected (paid) · last 7 days</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={revenueTrend} margin={{ left: 6, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2ECC71" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2ECC71" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(v) => fmtKES(Number(v))} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2ECC71" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: "#2ECC71" }} activeDot={{ r: 5 }} />
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
            <Wallet className="h-4 w-4 text-[#1E88E5]" /> Invoice Status
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
                  <span className="text-2xl font-bold text-slate-900">{stats.count}</span>
                  <span className="text-xs text-slate-400">invoices</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
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
              placeholder="Search patient, invoice ID, status..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <FilterPills options={["All", "Paid", "Pending", "Cancelled"]} value={statusFilter} onChange={(v) => setStatusFilter(v as InvoiceStatus | "All")} />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {invoices.length} invoices
        </p>
      </div>

      {/* INVOICES */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/70 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No invoices found"
          cta={{ label: "Generate Invoice", onClick: openGenerate }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 font-medium">Invoice</th>
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, i) => {
                    const meta = STATUS_META[inv.status];
                    return (
                      <motion.tr key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-50 transition hover:bg-[#F4F6F8]/60">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-800">{inv.id}</p>
                          <p className="text-xs text-slate-400">{itemCount(inv)} item(s)</p>
                        </td>
                        <td className="px-5 py-3 text-slate-700">{patientName(inv)}</td>
                        <td className="px-5 py-3 text-slate-500">{fmtDate(inv.invoice_date)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmtKES(inv.total_amount)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}>
                            <meta.icon className="h-3 w-3" /> {inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton tone="blue" title="View" onClick={() => setViewing(inv)}>
                              <Eye className="h-4 w-4" />
                            </IconButton>
                            {inv.status === "Pending" && (
                              <IconButton tone="green" title="Mark Paid" onClick={() => setPaying(inv)}>
                                <CheckCircle2 className="h-4 w-4" />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((inv, i) => {
              const meta = STATUS_META[inv.status];
              return (
                <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{inv.id}</p>
                      <p className="text-xs text-slate-400">{patientName(inv)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}>
                      <meta.icon className="h-3 w-3" /> {inv.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{fmtDate(inv.invoice_date)}</span>
                    <span className="text-lg font-bold text-slate-900">{fmtKES(inv.total_amount)}</span>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => setViewing(inv)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5]">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    {inv.status === "Pending" && (
                      <button onClick={() => setPaying(inv)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2ECC71]/10 py-2 text-xs font-semibold text-[#1E8C4A]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pay
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------- GENERATE MODAL ---------------- */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Invoice" subtitle="Line items auto-calculate the total" icon={<Plus className="h-5 w-5" />} size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Patient <span className="text-[#E74C3C]">*</span>
            </label>
            <select className={inputCls} value={formPatient} onChange={(e) => setFormPatient(e.target.value)}>
              <option value="">Select patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Line Items</label>
              <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {lineItems.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className={`${inputCls} flex-1`} value={l.service} onChange={(e) => updateLine(i, { service: e.target.value })}>
                    <option value="">Select service...</option>
                    {SERVICE_PRESETS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <div className="relative w-36">
                    <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="number" className={`${inputCls} pl-9`} value={l.amount} onChange={(e) => updateLine(i, { amount: e.target.value })} placeholder="0" />
                  </div>
                  <button onClick={() => lineItems.length > 1 && removeLine(i)} disabled={lineItems.length === 1} className="rounded-lg p-2.5 text-slate-400 transition hover:bg-[#E74C3C]/10 hover:text-[#C0392B] disabled:opacity-30">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl bg-[#F4F6F8] px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Invoice Total</span>
            <span className="text-xl font-bold text-[#1E88E5]">{fmtKES(lineTotal)}</span>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setGenOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
              Cancel
            </button>
            <button disabled={saving} onClick={submitGenerate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Invoice
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------------- VIEW / PRINT MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Invoice Details" subtitle={viewing?.id} icon={<Receipt className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            {/* Invoice head */}
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{viewing.id}</h3>
                  <p className="text-sm text-blue-50">{patientName(viewing)}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className={`inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold`}>
                  {viewing.status}
                </span>
                <p className="mt-1 text-xs text-blue-50">{fmtDate(viewing.invoice_date)}</p>
              </div>
            </div>

            {/* Itemized table */}
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2 font-medium">Service</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.invoice_items ?? []).map((it) => (
                    <tr key={it.id} className="border-t border-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">{it.service}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtKES(it.amount)}</td>
                    </tr>
                  ))}
                  {(viewing.invoice_items?.length ?? 0) === 0 && (
                    <tr><td colSpan={2} className="px-3 py-3 text-center text-slate-400">No items</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-[#F4F6F8]">
                    <td className="px-3 py-2 font-bold text-slate-900">Total</td>
                    <td className="px-3 py-2 text-right text-lg font-bold text-[#1E88E5]">{fmtKES(viewing.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment info */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={User} label="Patient" value={patientName(viewing)} />
              <InfoRow icon={CreditCard} label="Payment Method" value={viewing.payment_method || "Not paid yet"} />
              <InfoRow icon={Clock} label="Issued" value={fmtDateTime(viewing.invoice_date)} />
              <InfoRow icon={CheckCircle2} label="Paid At" value={viewing.paid_at ? fmtDateTime(viewing.paid_at) : "—"} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Close
              </button>
              {viewing.status === "Pending" && (
                <button onClick={() => { const v = viewing; setViewing(null); setPaying(v); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]">
                  <CheckCircle2 className="h-4 w-4" /> Mark as Paid
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- PAY MODAL ---------------- */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Confirm Payment" subtitle={paying?.id} icon={<CreditCard className="h-5 w-5" />}>
        {paying && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-[#F4F6F8] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2ECC71]/10 text-[#1E8C4A]">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Collect payment from</p>
                <p className="font-semibold text-slate-800">{patientName(paying)}</p>
              </div>
              <span className="ml-auto text-xl font-bold text-slate-900">{fmtKES(paying.total_amount)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#2ECC71]/5 p-3 text-xs text-[#1E8C4A]">
              <ArrowRight className="h-4 w-4 shrink-0" />
              Payment method will be recorded as <span className="font-semibold">M-Pesa</span> and the invoice marked Paid.
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setPaying(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button disabled={saving} onClick={() => markPaid(paying)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2ECC71]/30 transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm Payment
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
  money,
}: {
  label: string;
  value: number;
  icon: typeof DollarSign;
  gradient: string;
  delta: string;
  money?: boolean;
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
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {money ? fmtKES(display) : display.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">{delta}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
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

function IconButton({ children, onClick, tone, title }: { children: React.ReactNode; onClick: () => void; tone: "blue" | "green"; title: string }) {
  const tones = {
    blue: "text-[#1E88E5] hover:bg-[#1E88E5]/10",
    green: "text-[#1E8C4A] hover:bg-[#2ECC71]/10",
  };
  return (
    <button title={title} onClick={onClick} className={`rounded-lg p-2 transition ${tones[tone]}`}>
      {children}
    </button>
  );
}

function EmptyState({ icon, title, cta }: { icon: React.ReactNode; title: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white py-16 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
        {icon}
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">Try adjusting your search or generate a new invoice.</p>
      {cta && (
        <button onClick={cta.onClick} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]">
          <Plus className="h-4 w-4" /> {cta.label}
        </button>
      )}
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
