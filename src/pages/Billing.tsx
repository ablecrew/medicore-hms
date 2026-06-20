import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Receipt, Plus, Search, X, Eye, CheckCircle2, Clock, Loader2, Trash2, CreditCard, DollarSign,
  Banknote, AlertTriangle, Activity, TrendingUp, FileText, Printer, Wallet, User,
  Smartphone, CalendarClock, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type InvoiceStatus = "Paid" | "Pending" | "Cancelled";

interface ServiceItem { id: number; code: string; name: string; category: string; price: number; nhif_rate: number; }

interface InvoiceItem { id: number; invoice_id: string; service: string; amount: number; }

interface Payment {
  id: number; invoice_id: string; receipt_number: string | null; amount: number; method: string;
  reference: string | null; phone: string | null; status: string; received_at: string;
}

interface Invoice {
  id: string; patient_id: string; total_amount: number; status: InvoiceStatus;
  payment_method: string | null; invoice_date: string; paid_at: string | null; due_date: string | null;
  // Supabase returns a single object for to-one relations, not an array
  patients?: { name: string } | null; invoice_items?: InvoiceItem[] | null;
}

interface PatientOption { id: string; name: string; }

/* ============================ CONFIG ============================ */

const STATUS_META: Record<InvoiceStatus, { chip: string; dot: string; hex: string; icon: typeof Clock }> = {
  Paid: { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71", hex: "#2ECC71", icon: CheckCircle2 },
  Pending: { chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40", dot: "#F1C40F", hex: "#F1C40F", icon: Clock },
  Cancelled: { chip: "bg-[#E74C3C]/10 text-[#C0392B] ring-[#E74C3C]/30", dot: "#E74C3C", hex: "#E74C3C", icon: X },
};

const PAYMENT_METHODS = [
  { key: "M-Pesa", icon: Smartphone, color: "#2ECC71", desc: "STK Push to patient phone" },
  { key: "Cash", icon: Banknote, color: "#1E88E5", desc: "Physical cash received" },
  { key: "Card", icon: CreditCard, color: "#8E44AD", desc: "Credit / Debit card" },
  { key: "Insurance", icon: ShieldCheck, color: "#F1C40F", desc: "NHIF / Private claim" },
];

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtKES = (n: number) => "KES " + Number(n).toLocaleString("en-KE");
const patientName = (inv: Invoice) => inv.patients?.name ?? "Unknown";
const itemCount = (inv: Invoice) => inv.invoice_items?.length ?? 0;

interface LineItem { catalogId: number; service: string; amount: string; }

/* ============================ COMPONENT ============================ */

export default function Billing() {
  const { profile } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");

  const [genOpen, setGenOpen] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const [formPatient, setFormPatient] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Payment form
  const [payMethod, setPayMethod] = useState("M-Pesa");
  const [payAmount, setPayAmount] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [payRef, setPayRef] = useState("");
  const [stkStatus, setStkStatus] = useState<"idle" | "sending" | "sent" | "success">("idle");

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3200); };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const [invRes, patRes, svcRes, payRes] = await Promise.all([
        supabase.schema("medicore").from("invoices").select("id, patient_id, total_amount, status, payment_method, invoice_date, paid_at, due_date, patients(name), invoice_items(id, invoice_id, service, amount)").order("invoice_date", { ascending: false }),
        supabase.schema("medicore").from("patients").select("id, name").order("name"),
        supabase.schema("medicore").from("services_catalog").select("id, code, name, category, price, nhif_rate").eq("is_active", true).order("category, name"),
        supabase.schema("medicore").from("payments").select("id, invoice_id, receipt_number, amount, method, reference, phone, status, received_at").order("received_at", { ascending: false }),
      ]);
      if (invRes.error) throw invRes.error;
      if (patRes.error) throw patRes.error;
      
      // Gracefully handle missing catalog/payments tables
      const catalogMissing = svcRes.error && svcRes.error.message.includes("Does not exist");
      const paymentsMissing = payRes.error && payRes.error.message.includes("Does not exist");
      
      if (svcRes.error && !catalogMissing) throw svcRes.error;
      if (payRes.error && !paymentsMissing) throw payRes.error;

      setInvoices((invRes.data as unknown as Invoice[]) ?? []);
      setPatients((patRes.data as PatientOption[]) ?? []);
      setServices((svcRes.data as ServiceItem[]) ?? []);
      setPayments((payRes.data as Payment[]) ?? []);
      
      if (catalogMissing || paymentsMissing) {
        setError("⚠ Missing Database Tables: Please run 'billing-upgrade.sql' in Supabase to enable the Service Catalog and Payment Methods.");
      } else {
        setError(null);
      }
    } catch (e) {
      console.error("[Billing] load error:", e);
      setError("Failed to load billing data. Run billing-upgrade.sql + check RLS.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase.channel("medicore-billing")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "invoices" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "invoice_items" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "payments" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const paymentsByInvoice = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((p) => map.set(p.invoice_id, [...(map.get(p.invoice_id) ?? []), p]));
    return map;
  }, [payments]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || patientName(inv).toLowerCase().includes(q) || inv.id.toLowerCase().includes(q) || inv.status.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "Paid");
    const pending = invoices.filter((i) => i.status === "Pending");
    const totalPaid = paid.reduce((s, i) => s + Number(i.total_amount), 0);
    const totalPending = pending.reduce((s, i) => s + Number(i.total_amount), 0);
    return {
      totalRevenue: totalPaid,
      outstanding: totalPending,
      count: invoices.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      avg: paid.length ? totalPaid / paid.length : 0,
    };
  }, [invoices]);

  const aging = useMemo(() => {
    const now = Date.now();
    const pending = invoices.filter((i) => i.status === "Pending");
    return {
      "0-30": pending.filter((i) => (now - new Date(i.invoice_date).getTime()) / 86400000 <= 30).reduce((s, i) => s + Number(i.total_amount), 0),
      "31-60": pending.filter((i) => { const d = (now - new Date(i.invoice_date).getTime()) / 86400000; return d > 30 && d <= 60; }).reduce((s, i) => s + Number(i.total_amount), 0),
      "60+": pending.filter((i) => (now - new Date(i.invoice_date).getTime()) / 86400000 > 60).reduce((s, i) => s + Number(i.total_amount), 0),
    };
  }, [invoices]);

  const revenueTrend = useMemo(() => {
    const days: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const iso = d.toISOString().split("T")[0];
      days.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), revenue: invoices.filter((i) => i.status === "Paid" && i.paid_at?.slice(0, 10) === iso).reduce((s, i) => s + Number(i.total_amount), 0) });
    }
    return days;
  }, [invoices]);

  /* ---------------- INVOICE GENERATION ---------------- */
  const openGenerate = () => {
    setFormPatient("");
    setLineItems([{ catalogId: 0, service: "Consultation", amount: "1500" }]);
    setGenOpen(true);
  };

  const addLine = () => setLineItems([...lineItems, { catalogId: 0, service: "", amount: "" }]);

  const onServiceSelect = (index: number, svcId: number) => {
    const svc = services.find((s) => s.id === svcId);
    if (svc) {
      setLineItems(lineItems.map((l, i) => i === index ? { catalogId: svc.id, service: svc.name, amount: String(svc.price) } : l));
    }
  };

  const updateLine = (i: number, patch: Partial<LineItem>) => setLineItems(lineItems.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));

  const lineTotal = lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const submitGenerate = async () => {
    if (!formPatient) { showToast("error", "Please select a patient."); return; }
    const validLines = lineItems.filter((l) => l.service.trim() && Number(l.amount) > 0);
    if (validLines.length === 0) { showToast("error", "Add at least one valid line item."); return; }
    setSaving(true);
    try {
      const id = `INV-${String(stats.count + 1).padStart(4, "0")}`;
      const { error: invErr } = await supabase.schema("medicore").from("invoices").insert({ id, patient_id: formPatient, status: "Pending", total_amount: 0, due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] });
      if (invErr) throw invErr;
      const { error: itemErr } = await supabase.schema("medicore").from("invoice_items").insert(validLines.map((l) => ({ invoice_id: id, service: l.service.trim(), amount: Number(l.amount) })));
      if (itemErr) throw itemErr;
      showToast("success", `Invoice ${id} generated for ${fmtKES(lineTotal)}.`);
      setGenOpen(false);
      await load();
    } catch (e) {
      console.error("[Billing] generate error:", e);
      showToast("error", "Could not generate invoice.");
    } finally { setSaving(false); }
  };

  /* ---------------- PAYMENT RECORDING ---------------- */
  const openPay = (inv: Invoice) => {
    setPaying(inv);
    setPayMethod("M-Pesa");
    setPayAmount(String(inv.total_amount));
    setPayPhone("");
    setPayRef("");
    setStkStatus("idle");
  };

  const amountPaid = paying ? (paymentsByInvoice.get(paying.id) ?? []).filter(p => p.status === "Completed").reduce((s, p) => s + Number(p.amount), 0) : 0;
  const balance = paying ? Number(paying.total_amount) - amountPaid : 0;

  const recordPayment = async (simulatedMpesa = false) => {
    if (!paying) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { showToast("error", "Enter a valid amount."); return; }
    if (payMethod === "M-Pesa" && !payPhone.trim()) { showToast("error", "Enter patient's M-Pesa phone number."); return; }

    // For M-Pesa, trigger STK Push first
    if (payMethod === "M-Pesa" && !simulatedMpesa) {
      setStkStatus("sending");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const receipt = `RCT-${String(payments.length + 1).padStart(4, "0")}`;
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mpesa-stk-push`;
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ phone: payPhone, amount: amt, invoiceId: paying.id, receiptNumber: receipt }),
        });
        const data = await res.json();
        if (data.success) {
          setStkStatus(data.simulated ? "success" : "sent");
          showToast("info", data.message || "STK push sent.");
          if (data.simulated) {
            // Auto-refresh after 3s (simulated callback)
            setTimeout(() => { void load(); showToast("success", "M-Pesa payment received!"); setPaying(null); }, 3500);
          }
        } else {
          setStkStatus("idle");
          showToast("error", data.error || "STK push failed.");
        }
      } catch (e) {
        console.error("[Billing] STK error:", e);
        setStkStatus("idle");
        showToast("error", "Could not initiate M-Pesa payment.");
      }
      return;
    }

    // For Cash / Card / Insurance — record directly
    setSaving(true);
    try {
      const receipt = `RCT-${String(payments.length + 1).padStart(4, "0")}`;
      const { error: payErr } = await supabase.schema("medicore").from("payments").insert({
        invoice_id: paying.id, receipt_number: receipt, amount: amt, method: payMethod,
        reference: payRef.trim() || null, status: "Completed",
      });
      if (payErr) throw payErr;

      // Check if fully paid
      const newTotal = amountPaid + amt;
      if (newTotal >= Number(paying.total_amount)) {
        await supabase.schema("medicore").from("invoices").update({ status: "Paid", paid_at: new Date().toISOString(), payment_method: payMethod }).eq("id", paying.id);
      } else {
        showToast("info", `Partial payment recorded. Balance: ${fmtKES(Number(paying.total_amount) - newTotal)}`);
      }
      showToast("success", `Payment of ${fmtKES(amt)} recorded. Receipt: ${receipt}`);
      setPaying(null);
      await load();
    } catch (e) {
      console.error("[Billing] payment error:", e);
      showToast("error", "Could not record payment.");
    } finally { setSaving(false); }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-gradient-to-b from-white via-[#EAF4FE] to-[#F4F6F8] p-4 md:p-6">
      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"><Receipt className="h-3.5 w-3.5" /> Revenue Cycle Management</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financial Operations</h1>
            <p className="mt-1 text-sm text-blue-50/90">Service catalog · Multi-method paya STK · Aging analysis{profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCatalogOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/25"><FileText className="h-4 w-4" /> Price List</button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openGenerate} className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"><Plus className="h-4 w-4" /> Generate Invoice</motion.button>
          </div>
        </div>
      </motion.div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={stats.totalRevenue} icon={DollarSign} gradient="from-[#2ECC71] to-[#58D68D]" delta="Collected" money />
        <StatCard label="Outstanding" value={stats.outstanding} icon={Clock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Pending" money />
        <StatCard label="Total Invoices" value={stats.count} icon={FileText} gradient="from-[#1E88E5] to-[#64B5F6]" delta={`${stats.paidCount} paid`} />
        <StatCard label="Avg. Invoice" value={stats.avg} icon={TrendingUp} gradient="from-violet-500 to-purple-600" delta="Per payment" money />
      </div>

      {/* AGING + CHARTS */}
      <div className="grid gap-5 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
          <h3 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4 text-[#E74C3C]" /><span className="text-slate-800">Aging Analysis</span></h3>
          <p className="mb-4 text-sm text-slate-500">Outstanding by age</p>
          <div className="space-y-3">
            <AgingBar label="0–30 days" amount={aging["0-30"]} pct={stats.outstanding ? (aging["0-30"] / stats.outstanding) * 100 : 0} color="bg-[#2ECC71]" />
            <AgingBar label="31–60 days" amount={aging["31-60"]} pct={stats.outstanding ? (aging["31-60"] / stats.outstanding) * 100 : 0} color="bg-[#F1C40F]" />
            <AgingBar label="60+ days" amount={aging["60+"]} pct={stats.outstanding ? (aging["60+"] / stats.outstanding) * 100 : 0} color="bg-[#E74C3C]" />
          </div>
          <div className="mt-4 rounded-xl bg-[#F4F6F8] p-3 text-center"><p className="text-xs text-slate-400">Total Outstanding</p><p className="text-xl font-bold text-[#1E88E5]">{fmtKES(stats.outstanding)}</p></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:col-span-2">
          <div className="mb-4"><h3 className="flex items-center gap-2 text-base font-semibold"><Activity className="h-4 w-4 text-[#2ECC71]" /><span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Revenue Trend</span></h3><p className="text-sm text-slate-500">Collected · last 7 days</p></div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={revenueTrend} margin={{ left: 6, right: 8, top: 8 }}>
              <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2ECC71" stopOpacity={0.35} /><stop offset="95%" stopColor="#2ECC71" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} formatter={(v) => fmtKES(Number(v))} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2ECC71" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 3, fill: "#2ECC71" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md lg:w-80"><Search className="h-4 w-4 text-[#1E88E5]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, ID, status..." className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />{search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}</div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">{(["All", "Pending", "Paid", "Cancelled"] as const).map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${statusFilter === s ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{s}</button>)}</div>
        </div>
      </div>

      {/* INVOICES */}
      {loading ? <div className="flex h-64 items-center justify-center rounded-3xl border border-white/60 bg-white/70 backdrop-blur-md"><Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" /></div>
      : filtered.length === 0 ? <EmptyState icon={<Receipt className="h-8 w-8" />} title="No invoices found" cta={{ label: "Generate Invoice", onClick: openGenerate }} />
      : (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-medium">Invoice</th><th className="px-5 py-3 font-medium">Patient</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3 font-medium">Paid</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map((inv, i) => {
                    const meta = STATUS_META[inv.status];
                    const paid = (paymentsByInvoice.get(inv.id) ?? []).filter(p => p.status === "Completed").reduce((s, p) => s + Number(p.amount), 0);
                    return (
                      <motion.tr key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-50 transition hover:bg-[#F4F6F8]/60">
                        <td className="px-5 py-3"><p className="font-semibold text-slate-800">{inv.id}</p><p className="text-xs text-slate-400">{itemCount(inv)} item(s)</p></td>
                        <td className="px-5 py-3 text-slate-700">{patientName(inv)}</td>
                        <td className="px-5 py-3 text-slate-500">{fmtDate(inv.invoice_date)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmtKES(Number(inv.total_amount))}</td>
                        <td className="px-5 py-3 text-right text-slate-500">{paid > 0 ? fmtKES(paid) : "—"}</td>
                        <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}><meta.icon className="h-3 w-3" />{inv.status}</span></td>
                        <td className="px-5 py-3"><div className="flex items-center justify-end gap-1">
                          <IconButton tone="blue" title="View" onClick={() => setViewing(inv)}><Eye className="h-4 w-4" /></IconButton>
                          {inv.status !== "Paid" && inv.status !== "Cancelled" && <IconButton tone="green" title="Record Payment" onClick={() => openPay(inv)}><Wallet className="h-4 w-4" /></IconButton>}
                        </div></td>
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
              const paid = (paymentsByInvoice.get(inv.id) ?? []).filter(p => p.status === "Completed").reduce((s, p) => s + Number(p.amount), 0);
              return (
                <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
                  <div className="flex items-start justify-between"><div><p className="font-semibold text-slate-800">{inv.id}</p><p className="text-xs text-slate-400">{patientName(inv)}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}><meta.icon className="h-3 w-3" />{inv.status}</span></div>
                  <div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">{fmtDate(inv.invoice_date)}</span><span className="text-lg font-bold text-slate-900">{fmtKES(Number(inv.total_amount))}</span></div>
                  {paid > 0 && paid < Number(inv.total_amount) && <p className="mt-1 text-xs font-semibold text-[#1E8C4A]">Paid: {fmtKES(paid)} · Balance: {fmtKES(Number(inv.total_amount) - paid)}</p>}
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <button onClick={() => setViewing(inv)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5]"><Eye className="h-3.5 w-3.5" /> View</button>
                    {inv.status !== "Paid" && inv.status !== "Cancelled" && <button onClick={() => openPay(inv)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2ECC71]/10 py-2 text-xs font-semibold text-[#1E8C4A]"><Wallet className="h-3.5 w-3.5" /> Pay</button>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------- GENERATE MODAL ---------------- */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Invoice" subtitle="Select services from the price catalog" icon={<Plus className="h-5 w-5" />} size="lg">
        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600">Patient <span className="text-[#E74C3C]">*</span></span><select className={inputCls} value={formPatient} onChange={(e) => setFormPatient(e.target.value)}><option value="">Select patient...</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}</select></label>

          <div>
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-slate-600">Line Items</span><button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:underline"><Plus className="h-3.5 w-3.5" /> Add item</button></div>
            <div className="space-y-2">
              {lineItems.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className={`${inputCls} flex-1`} value={l.catalogId} onChange={(e) => onServiceSelect(i, Number(e.target.value))}>
                    <option value={0}>Select service...</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {fmtKES(s.price)}</option>)}
                  </select>
                  <div className="relative w-32"><Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="number" className={`${inputCls} pl-9`} value={l.amount} onChange={(e) => updateLine(i, { amount: e.target.value })} /></div>
                  <button onClick={() => lineItems.length > 1 && removeLine(i)} disabled={lineItems.length === 1} className="rounded-lg p-2.5 text-slate-400 transition hover:bg-[#E74C3C]/10 hover:text-[#C0392B] disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#F4F6F8] px-4 py-3"><span className="text-sm font-semibold text-slate-700">Invoice Total</span><span className="text-xl font-bold text-[#1E88E5]">{fmtKES(lineTotal)}</span></div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setGenOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
            <button disabled={saving} onClick={submitGenerate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Generate Invoice</button>
          </div>
        </div>
      </Modal>

      {/* ---------------- PAYMENT MODAL ---------------- */}
      <Modal open={!!paying} onClose={() => { setPaying(null); setStkStatus("idle"); }} title="Record Payment" subtitle={paying?.id} icon={<Wallet className="h-5 w-5" />} size="lg">
        {paying && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-4">
              <div className="flex items-center justify-between">
                <div><h3 className="text-lg font-bold text-slate-900">{patientName(paying)}</h3><p className="text-sm text-slate-500">{paying.id} · {itemCount(paying)} item(s)</p></div>
                <div className="text-right"><p className="text-xs text-slate-400">Total</p><p className="text-xl font-bold text-slate-900">{fmtKES(Number(paying.total_amount))}</p></div>
              </div>
              {amountPaid > 0 && <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs"><span className="text-[#1E8C4A]">Paid: {fmtKES(amountPaid)}</span><span className={balance > 0 ? "text-[#C0392B]" : "text-[#1E8C4A]"}>Balance: {fmtKES(balance)}</span></div>}
            </div>

            {/* METHOD SELECTOR */}
            <div>
              <span className="mb-2 block text-xs font-medium text-slate-600">Payment Method</span>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const MIcon = m.icon;
                  const active = payMethod === m.key;
                  return <button key={m.key} onClick={() => setPayMethod(m.key)} className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition ${active ? "border-transparent text-white shadow-md" : "border-slate-200 text-slate-600 hover:border-[#1E88E5]/40"}`} style={active ? { background: m.color } : {}}><MIcon className="h-5 w-5" /><span className="text-[11px] font-semibold">{m.key}</span></button>;
                })}
              </div>
            </div>

            {/* AMOUNT */}
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600">Amount (KES) <span className="text-[#E74C3C]">*</span></span><input type="number" className={`${inputCls} text-lg font-bold`} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>

            {/* CONDITIONAL FIELDS */}
            {payMethod === "M-Pesa" && (
              <div className="rounded-2xl border-2 border-[#2ECC71]/30 bg-[#2ECC71]/5 p-4 space-y-3">
                <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-[#2ECC71]" /><p className="text-sm font-semibold text-[#1E8C4A]">M-Pesa STK Push</p></div>
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Patient Phone (Safaricom) <span className="text-[#E74C3C]">*</span></span><input className={inputCls} value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="07XX XXX XXX or 2547XX..." /></label>
                {stkStatus === "sent" && <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin text-[#2ECC71]" /> STK push sent. Waiting for patient to enter PIN...</div>}
                {stkStatus === "success" && <div className="flex items-center gap-2 rounded-xl bg-[#2ECC71]/10 p-3 text-sm text-[#1E8C4A]"><CheckCircle2 className="h-4 w-4" /> Payment received successfully!</div>}
                <p className="text-[11px] text-slate-400">💡 Without Daraja API credentials, this simulates an auto-completing payment after 3 seconds. Configure MPESA_* secrets for live STK push.</p>
              </div>
            )}

            {(payMethod === "Cash" || payMethod === "Card" || payMethod === "Insurance") && (
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600">Reference / Receipt No.</span><input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={payMethod === "Cash" ? "Cash receipt number" : payMethod === "Card" ? "Card transaction ID" : "Claim reference"} /></label>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => { setPaying(null); setStkStatus("idle"); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
              {payMethod === "M-Pesa" ? (
                <button disabled={stkStatus === "sending" || saving || stkStatus === "sent"} onClick={() => recordPayment(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60">{stkStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}{stkStatus === "sending" ? "Sending..." : stkStatus === "sent" ? "Waiting..." : "Send STK Push"}</button>
              ) : (
                <button disabled={saving} onClick={() => recordPayment(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Record Payment</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Invoice Details" subtitle={viewing?.id} icon={<Receipt className="h-5 w-5" />} size="lg">
        {viewing && (() => {
          const invPayments = paymentsByInvoice.get(viewing.id) ?? [];
          const paid = invPayments.filter(p => p.status === "Completed").reduce((s, p) => s + Number(p.amount), 0);
          const bal = Number(viewing.total_amount) - paid;
          return (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20"><Receipt className="h-6 w-6" /></div><div><h3 className="text-lg font-bold">{viewing.id}</h3><p className="text-sm text-blue-50">{patientName(viewing)}</p></div></div>
                <div className="text-left sm:text-right"><span className={`inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold`}>{viewing.status}</span><p className="mt-1 text-xs text-blue-50">{fmtDate(viewing.invoice_date)}</p></div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400"><th className="px-3 py-2 font-medium">Service</th><th className="px-3 py-2 text-right font-medium">Amount</th></tr></thead>
                  <tbody>{(viewing.invoice_items ?? []).map((it) => <tr key={it.id} className="border-t border-slate-50"><td className="px-3 py-2 font-medium text-slate-700">{it.service}</td><td className="px-3 py-2 text-right text-slate-700">{fmtKES(it.amount)}</td></tr>)}</tbody>
                  <tfoot><tr className="border-t-2 border-slate-200 bg-[#F4F6F8]"><td className="px-3 py-2 font-bold text-slate-900">Total</td><td className="px-3 py-2 text-right text-lg font-bold text-[#1E88E5]">{fmtKES(Number(viewing.total_amount))}</td></tr></tfoot>
                </table>
              </div>

              {/* PAYMENTS HISTORY */}
              {invPayments.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><Wallet className="h-4 w-4 text-[#2ECC71]" /> Payment History ({invPayments.length})</p>
                  <div className="space-y-2">
                    {invPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${p.method === "M-Pesa" ? "bg-[#2ECC71]/10 text-[#2ECC71]" : p.method === "Cash" ? "bg-[#1E88E5]/10 text-[#1E88E5]" : "bg-violet-100 text-violet-600"}`}>{p.method.slice(0, 2).toUpperCase()}</div>
                          <div><p className="text-sm font-semibold text-slate-700">{p.receipt_number ?? "No receipt"}</p><p className="text-xs text-slate-400">{p.method} · {fmtDateTime(p.received_at)}</p></div>
                        </div>
                        <div className="text-right"><p className="text-sm font-bold text-slate-800">{fmtKES(Number(p.amount))}</p><span className={`text-[10px] font-semibold ${p.status === "Completed" ? "text-[#1E8C4A]" : "text-[#B8860B]"}`}>{p.status}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow icon={User} label="Patient" value={patientName(viewing)} />
                <InfoRow icon={CreditCard} label="Payment Method" value={viewing.payment_method || "Multiple / Not paid"} />
                <InfoRow icon={Clock} label="Issued" value={fmtDateTime(viewing.invoice_date)} />
                <InfoRow icon={CheckCircle2} label="Paid At" value={viewing.paid_at ? fmtDateTime(viewing.paid_at) : "—"} />
              </div>

              {bal > 0 && <div className="rounded-xl bg-[#F1C40F]/10 p-3 text-sm font-semibold text-[#B8860B]">Outstanding Balance: {fmtKES(bal)}</div>}

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"><Printer className="h-4 w-4" /> Print</button>
                <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Close</button>
                {viewing.status !== "Paid" && viewing.status !== "Cancelled" && <button onClick={() => { const v = viewing; setViewing(null); openPay(v); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]"><Wallet className="h-4 w-4" /> Record Payment</button>}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ---------------- CATALOG MODAL ---------------- */}
      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Service Price Catalog" subtitle={`${services.length} services`} icon={<FileText className="h-5 w-5" />} size="lg">
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400"><th className="px-3 py-2 font-medium">Code</th><th className="px-3 py-2 font-medium">Service</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 text-right font-medium">Price</th><th className="px-3 py-2 text-right font-medium">NHIF</th></tr></thead>
            <tbody>{services.map((s) => <tr key={s.id} className="border-t border-slate-50"><td className="px-3 py-2 font-mono text-xs text-slate-500">{s.code}</td><td className="px-3 py-2 font-medium text-slate-700">{s.name}</td><td className="px-3 py-2 text-slate-500">{s.category}</td><td className="px-3 py-2 text-right font-semibold text-slate-700">{fmtKES(s.price)}</td><td className="px-3 py-2 text-right text-slate-500">{s.nhif_rate > 0 ? fmtKES(s.nhif_rate) : "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </Modal>

      {/* ---------------- TOAST ---------------- */}
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 30, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 30, x: "-50%" }} className={`fixed bottom-24 left-1/2 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl lg:bottom-6 ${toast.type === "success" ? "bg-[#2ECC71]" : toast.type === "error" ? "bg-[#E74C3C]" : "bg-[#1E88E5]"}`}>{toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : toast.type === "error" ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}{toast.message}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function StatCard({ label, value, icon: Icon, gradient, delta, money }: { label: string; value: number; icon: typeof DollarSign; gradient: string; delta: string; money?: boolean }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => { const c = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) }); return () => c.stop(); }, [value]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className="relative flex items-start justify-between">
        <div><p className="text-sm font-medium text-slate-500">{label}</p><p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-2xl font-bold tracking-tight text-transparent`}>{money ? fmtKES(display) : display.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{delta}</p></div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
      </div>
    </motion.div>
  );
}

function AgingBar({ label, amount, pct, color }: { label: string; amount: number; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-bold text-slate-800">{fmtKES(amount)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full ${color}`} /></div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F6F8] text-[#1E88E5]"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs text-slate-400">{label}</p><p className="truncate text-sm font-medium text-slate-700">{value}</p></div></div>;
}

function IconButton({ children, onClick, tone, title }: { children: React.ReactNode; onClick: () => void; tone: "blue" | "green"; title: string }) {
  const tones = { blue: "text-[#1E88E5] hover:bg-[#1E88E5]/10", green: "text-[#1E8C4A] hover:bg-[#2ECC71]/10" };
  return <button title={title} onClick={onClick} className={`rounded-lg p-2 transition ${tones[tone]}`}>{children}</button>;
}

function EmptyState({ icon, title, cta }: { icon: React.ReactNode; title: string; cta?: { label: string; onClick: () => void } }) {
  return <div className="flex flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/70 py-16 text-center backdrop-blur-md"><div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">{icon}</div><p className="font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-400">Try adjusting your search or generate a new invoice.</p>{cta && <button onClick={cta.onClick} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:opacity-90"><Plus className="h-4 w-4" /> {cta.label}</button>}</div>;
}

function Modal({ open, onClose, title, subtitle, icon, size = "md", children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: React.ReactNode; size?: "md" | "lg"; children: React.ReactNode }) {
  return <AnimatePresence>{open && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.25 }} className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${size === "lg" ? "max-w-2xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">{icon && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">{icon}</div>}<div><h3 className="text-lg font-semibold text-slate-900">{title}</h3>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </div>
  )}</AnimatePresence>;
}
