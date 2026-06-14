import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Pill,
  Package,
  Search,
  X,
  Eye,
  PackageCheck,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Stethoscope,
  Boxes,
  Activity,
  PackageX,
  ArrowLeftRight,
  DollarSign,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type RxStatus = "Pending" | "Dispensed";

interface RxItem {
  id: number;
  medicine_id: string;
  medicine_name: string;
  dosage: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: RxStatus;
  prescribed_at: string;
  dispensed_at: string | null;
  patients?: { name: string }[] | null;
  staff?: { name: string }[] | null;
  prescription_items?: RxItem[] | null;
}

interface Medicine {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: number;
  reorder_level: number;
}

/* ============================ THEME ============================ */

const RX_STATUS: Record<RxStatus, { chip: string; dot: string; hex: string }> = {
  Pending: { chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40", dot: "#F1C40F", hex: "#F1C40F" },
  Dispensed: { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71", hex: "#2ECC71" },
};

const CAT_COLORS = ["#1E88E5", "#2ECC71", "#F1C40F", "#E74C3C", "#8E44AD", "#1ABC9C", "#3498DB"];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

/* ============================ HELPERS ============================ */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtKES = (n: number) => "KES " + n.toLocaleString("en-KE");

const patientName = (p: Prescription) => p.patients?.[0]?.name ?? "Unknown";
const doctorName = (p: Prescription) => p.staff?.[0]?.name ?? "—";
const rxTotal = (p: Prescription) =>
  (p.prescription_items ?? []).reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);

/* ============================ COMPONENT ============================ */

export default function Pharmacy() {
  const { profile } = useAuth();

  const [tab, setTab] = useState<"prescriptions" | "inventory">("prescriptions");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [rxFilter, setRxFilter] = useState<RxStatus | "All">("All");
  const [medFilter, setMedFilter] = useState<string>("All");

  const [viewing, setViewing] = useState<Prescription | null>(null);
  const [dispensing, setDispensing] = useState<Prescription | null>(null);
  const [restocking, setRestocking] = useState<Medicine | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const [rxRes, medRes] = await Promise.all([
        supabase
          .schema("medicore")
          .from("prescriptions")
          .select(
            "id, patient_id, doctor_id, status, prescribed_at, dispensed_at, patients(name), staff(name), prescription_items(id, medicine_id, medicine_name, dosage, quantity, unit, unit_price)"
          )
          .order("prescribed_at", { ascending: false }),
        supabase
          .schema("medicore")
          .from("medicines")
          .select("id, name, category, stock, unit, price, reorder_level")
          .order("name", { ascending: true }),
      ]);
      if (rxRes.error) throw rxRes.error;
      if (medRes.error) throw medRes.error;
      setPrescriptions((rxRes.data as Prescription[]) ?? []);
      setMedicines((medRes.data as Medicine[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Pharmacy] load error:", e);
      setError("Failed to load pharmacy data. Check schema exposure + RLS.");
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
      .channel("medicore-pharmacy")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "prescriptions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "prescription_items" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "medicines" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filteredRx = useMemo(() => {
    return prescriptions.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q || patientName(p).toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || doctorName(p).toLowerCase().includes(q);
      const matchesFilter = rxFilter === "All" || p.status === rxFilter;
      return matchesSearch && matchesFilter;
    });
  }, [prescriptions, search, rxFilter]);

  const filteredMeds = useMemo(() => {
    return medicines.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
      const matchesCat = medFilter === "All" || m.category === medFilter;
      return matchesSearch && matchesCat;
    });
  }, [medicines, search, medFilter]);

  const stats = useMemo(() => {
    const stockValue = medicines.reduce((s, m) => s + m.stock * Number(m.price), 0);
    return {
      pending: prescriptions.filter((p) => p.status === "Pending").length,
      dispensed: prescriptions.filter((p) => p.status === "Dispensed").length,
      lowStock: medicines.filter((m) => m.stock <= m.reorder_level).length,
      stockValue,
    };
  }, [prescriptions, medicines]);

  const rxStatusData = useMemo(
    () =>
      (["Pending", "Dispensed"] as RxStatus[])
        .map((k) => ({ name: k, value: prescriptions.filter((p) => p.status === k).length, color: RX_STATUS[k].hex }))
        .filter((d) => d.value > 0),
    [prescriptions]
  );

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    medicines.forEach((m) => {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [medicines]);

  const categories = useMemo(() => Array.from(new Set(medicines.map((m) => m.category))).sort(), [medicines]);

  /* ---------------- ACTIONS ---------------- */
  const dispense = async () => {
    if (!dispensing) return;
    setSaving(true);
    try {
      const { error: rxErr } = await supabase
        .schema("medicore")
        .from("prescriptions")
        .update({ status: "Dispensed", dispensed_at: new Date().toISOString() })
        .eq("id", dispensing.id);
      if (rxErr) throw rxErr;

      const items = dispensing.prescription_items ?? [];
      await Promise.all(
        items.map(async (it) => {
          const med = medicines.find((m) => m.id === it.medicine_id);
          if (!med) return;
          const newStock = Math.max(0, med.stock - it.quantity);
          const { error: mErr } = await supabase.schema("medicore").from("medicines").update({ stock: newStock }).eq("id", med.id);
          if (mErr) console.error("stock update failed for", med.id, mErr);
        })
      );

      showToast("success", `${dispensing.id} dispensed. Stock updated automatically.`);
      setDispensing(null);
      await load();
    } catch (e) {
      console.error("[Pharmacy] dispense error:", e);
      showToast("error", "Could not dispense prescription.");
    } finally {
      setSaving(false);
    }
  };

  const openRestock = (m: Medicine) => {
    setRestocking(m);
    setRestockQty("");
  };

  const submitRestock = async () => {
    if (!restocking) return;
    const add = Number(restockQty);
    if (!add || add <= 0) {
      showToast("error", "Enter a valid quantity.");
      return;
    }
    setSaving(true);
    try {
      const { error: e } = await supabase.schema("medicore").from("medicines").update({ stock: restocking.stock + add }).eq("id", restocking.id);
      if (e) throw e;
      showToast("success", `Restocked ${restocking.name} by +${add}.`);
      setRestocking(null);
      setRestockQty("");
      await load();
    } catch (e) {
      console.error("[Pharmacy] restock error:", e);
      showToast("error", "Could not restock.");
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
              <Pill className="h-3.5 w-3.5" /> Pharmacy Module
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dispensary &amp; Inventory</h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Dispense prescriptions &amp; manage medicine stock
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl bg-white/10 px-5 py-4 backdrop-blur">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold leading-none">{stats.pending}</p>
              <p className="text-xs text-blue-100">Awaiting dispense</p>
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
        <StatCard label="Pending" value={stats.pending} icon={Clock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Awaiting" />
        <StatCard label="Dispensed" value={stats.dispensed} icon={PackageCheck} gradient="from-[#2ECC71] to-[#58D68D]" delta="Completed" />
        <StatCard label="Low Stock" value={stats.lowStock} icon={PackageX} gradient="from-[#E74C3C] to-[#EC7063]" delta="Reorder" />
        <StatCard label="Stock Value" value={stats.stockValue} icon={DollarSign} gradient="from-[#1E88E5] to-[#64B5F6]" delta="KES" money />
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
              <Boxes className="h-4 w-4 text-[#1E88E5]" /> Inventory by Category
            </h3>
            <p className="text-sm text-slate-500">Medicine distribution</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={categoryData} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
              <Bar dataKey="value" name="Medicines" radius={[6, 6, 0, 0]} barSize={32}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Activity className="h-4 w-4 text-violet-600" /> Rx Status
          </h3>
          <p className="mb-2 text-sm text-slate-500">Distribution</p>
          {rxStatusData.length ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={rxStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                      {rxStatusData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{prescriptions.length}</span>
                  <span className="text-xs text-slate-400">total Rx</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {rxStatusData.map((d) => (
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

      {/* TABS + TOOLBAR */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1 rounded-xl bg-[#F4F6F8] p-1">
            <button
              onClick={() => { setTab("prescriptions"); setSearch(""); }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === "prescriptions" ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500"
              }`}
            >
              <FileText className="h-4 w-4" /> Prescriptions ({prescriptions.length})
            </button>
            <button
              onClick={() => { setTab("inventory"); setSearch(""); }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === "inventory" ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500"
              }`}
            >
              <Package className="h-4 w-4" /> Inventory ({medicines.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-3.5 py-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "prescriptions" ? "Search patient, ID, doctor..." : "Search medicine, category..."}
                className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-56"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {tab === "prescriptions" ? (
              <FilterPills options={["All", "Pending", "Dispensed"]} value={rxFilter} onChange={(v) => setRxFilter(v as RxStatus | "All")} />
            ) : (
              <select
                value={medFilter}
                onChange={(e) => setMedFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none transition focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/70 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : tab === "prescriptions" ? (
        filteredRx.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title="No prescriptions found" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRx.map((p, i) => {
              const meta = RX_STATUS[p.status];
              return (
                <motion.div
                  key={p.id}
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
                        <Pill className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{patientName(p)}</h3>
                        <p className="text-xs text-slate-400">{p.id}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}>
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl bg-[#F4F6F8] p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1E88E5]">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{doctorName(p)}</p>
                      <p className="truncate text-xs text-slate-500">{p.prescription_items?.length ?? 0} item(s) · {fmtDate(p.prescribed_at)}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {(p.prescription_items ?? []).slice(0, 2).map((it) => (
                      <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-xs">
                        <span className="truncate font-medium text-slate-700">{it.medicine_name}</span>
                        <span className="shrink-0 text-slate-500">{it.quantity} {it.unit}</span>
                      </div>
                    ))}
                    {(p.prescription_items?.length ?? 0) > 2 && (
                      <p className="px-1 text-[11px] text-slate-400">+{p.prescription_items!.length - 2} more...</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">Total</span>
                    <span className="text-sm font-bold text-[#1E88E5]">{fmtKES(rxTotal(p))}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setViewing(p)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    {p.status === "Pending" && (
                      <button
                        onClick={() => setDispensing(p)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71] py-2 text-xs font-semibold text-white transition hover:bg-[#27AE60]"
                      >
                        <PackageCheck className="h-3.5 w-3.5" /> Dispense
                      </button>
                    )}
                    {p.status === "Dispensed" && (
                      <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71]/10 py-2 text-xs font-semibold text-[#1E8C4A]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        filteredMeds.length === 0 ? (
          <EmptyState icon={<Package className="h-8 w-8" />} title="No medicines found" />
        ) : (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 font-medium">Medicine</th>
                      <th className="px-5 py-3 font-medium">Category</th>
                      <th className="px-5 py-3 font-medium">Stock</th>
                      <th className="px-5 py-3 font-medium">Level</th>
                      <th className="px-5 py-3 text-right font-medium">Unit Price</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMeds.map((m, i) => {
                      const isLow = m.stock <= m.reorder_level;
                      const pct = Math.min(100, Math.round((m.stock / (m.reorder_level * 2.5)) * 100));
                      return (
                        <motion.tr key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-50 transition hover:bg-[#F4F6F8]/60">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-slate-800">{m.name}</p>
                            <p className="text-xs text-slate-400">{m.id}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center rounded-lg bg-[#F4F6F8] px-2 py-0.5 text-xs font-medium text-slate-600">{m.category}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-semibold ${isLow ? "text-[#C0392B]" : "text-slate-700"}`}>{m.stock}</span>
                            <span className="text-slate-400"> {m.unit}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${isLow ? "bg-[#E74C3C]" : pct < 50 ? "bg-[#F1C40F]" : "bg-[#2ECC71]"}`} style={{ width: `${pct}%` }} />
                              </div>
                              {isLow && <AlertTriangle className="h-3.5 w-3.5 text-[#E74C3C]" />}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-slate-700">{fmtKES(Number(m.price))}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => openRestock(m)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E88E5]/10 px-3 py-1.5 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20">
                              <Plus className="h-3.5 w-3.5" /> Restock
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {filteredMeds.map((m, i) => {
                const isLow = m.stock <= m.reorder_level;
                const pct = Math.min(100, Math.round((m.stock / (m.reorder_level * 2.5)) * 100));
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.category}</p>
                      </div>
                      {isLow && <AlertTriangle className="h-4 w-4 text-[#E74C3C]" />}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${isLow ? "bg-[#E74C3C]" : pct < 50 ? "bg-[#F1C40F]" : "bg-[#2ECC71]"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-sm font-bold ${isLow ? "text-[#C0392B]" : "text-slate-700"}`}>{m.stock}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs font-medium text-slate-500">{fmtKES(Number(m.price))}/{m.unit}</span>
                      <button onClick={() => openRestock(m)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E88E5]/10 px-3 py-1.5 text-xs font-semibold text-[#1E88E5]">
                        <Plus className="h-3.5 w-3.5" /> Restock
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )
      )}

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Prescription Details" subtitle={viewing?.id} icon={<FileText className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white">
                  <Pill className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{patientName(viewing)}</h3>
                  <p className="text-sm text-slate-500">{viewing.id} · Prescribed by {doctorName(viewing)}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RX_STATUS[viewing.status].chip}`}>
                {viewing.status}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-3 py-2 font-medium">Medicine</th>
                    <th className="px-3 py-2 font-medium">Dosage</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.prescription_items ?? []).map((it) => (
                    <tr key={it.id} className="border-t border-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">{it.medicine_name}</td>
                      <td className="px-3 py-2 text-slate-500">{it.dosage || "—"}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{it.quantity} {it.unit}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtKES(it.quantity * Number(it.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-[#F4F6F8]">
                    <td colSpan={3} className="px-3 py-2 font-bold text-slate-900">Total</td>
                    <td className="px-3 py-2 text-right text-lg font-bold text-[#1E88E5]">{fmtKES(rxTotal(viewing))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {viewing.dispensed_at && (
              <p className="flex items-center gap-1.5 text-xs text-[#1E8C4A]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Dispensed on {fmtDateTime(viewing.dispensed_at)}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Close
              </button>
              {viewing.status === "Pending" && (
                <button onClick={() => { const p = viewing; setViewing(null); setDispensing(p); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]">
                  <PackageCheck className="h-4 w-4" /> Dispense Medication
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- DISPENSE MODAL ---------------- */}
      <Modal open={!!dispensing} onClose={() => setDispensing(null)} title="Dispense Medication" subtitle="Stock will be deducted automatically" icon={<PackageCheck className="h-5 w-5" />}>
        {dispensing && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#F4F6F8] p-4">
              <p className="text-sm font-semibold text-slate-800">{patientName(dispensing)}</p>
              <p className="text-xs text-slate-500">{dispensing.id} · Prescribed by {doctorName(dispensing)}</p>
            </div>

            <div className="space-y-2">
              {(dispensing.prescription_items ?? []).map((it) => {
                const med = medicines.find((m) => m.id === it.medicine_id);
                const insufficient = med ? med.stock < it.quantity : false;
                return (
                  <div key={it.id} className={`flex items-center justify-between rounded-xl border p-3 text-sm ${insufficient ? "border-[#E74C3C]/30 bg-[#E74C3C]/5" : "border-slate-100"}`}>
                    <div>
                      <p className="font-medium text-slate-700">{it.medicine_name}</p>
                      <p className="text-xs text-slate-400">{it.quantity} {it.unit} {med ? `· in stock: ${med.stock}` : ""}</p>
                    </div>
                    <span className={`text-xs font-semibold ${insufficient ? "text-[#C0392B]" : "text-slate-600"}`}>{fmtKES(it.quantity * Number(it.unit_price))}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="text-lg font-bold text-[#1E88E5]">{fmtKES(rxTotal(dispensing))}</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#F1C40F]/10 p-3 text-xs text-[#B8860B]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This action deducts {dispensing.prescription_items?.length ?? 0} medicine line(s) from inventory and cannot be undone.
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setDispensing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button disabled={saving} onClick={dispense} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2ECC71]/30 transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Confirm Dispense
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- RESTOCK MODAL ---------------- */}
      <Modal open={!!restocking} onClose={() => setRestocking(null)} title="Restock Medicine" subtitle={restocking?.name} icon={<Plus className="h-5 w-5" />}>
        {restocking && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-[#F4F6F8] py-3">
                <p className="text-xs text-slate-400">Current</p>
                <p className="text-xl font-bold text-slate-900">{restocking.stock}</p>
                <p className="text-[10px] text-slate-400">{restocking.unit}</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-slate-300" />
              </div>
              <div className="rounded-xl bg-[#2ECC71]/10 py-3">
                <p className="text-xs text-slate-400">After</p>
                <p className="text-xl font-bold text-[#1E8C4A]">{restocking.stock + (Number(restockQty) || 0)}</p>
                <p className="text-[10px] text-slate-400">{restocking.unit}</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Quantity to add <span className="text-[#E74C3C]">*</span>
              </label>
              <input type="number" className={inputCls} value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="e.g. 50" />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setRestocking(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button disabled={saving} onClick={submitRestock} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Stock
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
  icon: typeof Pill;
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

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white py-16 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
        {icon}
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">Try adjusting your search or filters.</p>
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
