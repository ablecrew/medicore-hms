import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  PackagePlus,
  Pill,
  Plus,
  ReceiptText,
  Search,
  TrendingDown,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";

type PrescriptionStatus = "Pending" | "Dispensed";

type MedicineRow = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: number | string;
  reorder_level: number;
  expiry_date: string | null;
  batch_number?: string | null;
  supplier?: string | null;
  cost_price?: number | string | null;
  is_active?: boolean | null;
  location?: string | null;
  last_restocked_at?: string | null;
  created_at: string;
};

type PrescriptionRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  consultation_id: string | null;
  status: PrescriptionStatus;
  prescribed_at: string;
  dispensed_at: string | null;
};

type PrescriptionItemRow = {
  id: number;
  prescription_id: string;
  medicine_id: string;
  medicine_name: string;
  dosage: string | null;
  quantity: number;
  unit: string;
  unit_price: number | string;
};

type PatientRow = {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  allergies?: string | null;
  conditions?: string | null;
  blood_type?: string | null;
  status: string;
};

type DoctorRow = {
  id: string;
  name: string;
  specialization: string | null;
  department: string | null;
  status: string;
  role: string;
};

type MedicineForm = {
  id: string;
  name: string;
  category: string;
  stock: string;
  unit: string;
  price: string;
  reorder_level: string;
  expiry_date: string;
  batch_number: string;
  supplier: string;
  location: string;
  is_active: boolean;
};

type PrescriptionForm = {
  id: string;
  patient_id: string;
  doctor_id: string;
  medicine_id: string;
  dosage: string;
  quantity: string;
  status: PrescriptionStatus;
};

type StockForm = {
  medicine_id: string;
  quantity: string;
  reason: string;
  batch_number: string;
  supplier: string;
  expiry_date: string;
  location: string;
};

const schema = () => supabase.schema("medicore");

const emptyMedicineForm: MedicineForm = {
  id: "",
  name: "",
  category: "General",
  stock: "0",
  unit: "Tablets",
  price: "0",
  reorder_level: "10",
  expiry_date: "",
  batch_number: "",
  supplier: "",
  location: "Main Pharmacy",
  is_active: true,
};

const emptyPrescriptionForm: PrescriptionForm = {
  id: "",
  patient_id: "",
  doctor_id: "",
  medicine_id: "",
  dosage: "1 tab twice daily",
  quantity: "1",
  status: "Pending",
};

const emptyStockForm: StockForm = {
  medicine_id: "",
  quantity: "1",
  reason: "Stock received",
  batch_number: "",
  supplier: "",
  expiry_date: "",
  location: "Main Pharmacy",
};

const categories = ["General", "Antimalarial", "Pain relief", "Antibiotic", "Diabetes", "Respiratory", "Emergency"];
const units = ["Tablets", "Capsules", "Pack", "Vials", "Bottles", "Sachets", "Unit"];
const prescriptionStatuses: Array<"All" | PrescriptionStatus> = ["All", "Pending", "Dispensed"];
const statusColors = ["#F1C40F", "#2ECC71"];

export default function Pharmacy() {
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | PrescriptionStatus>("All");
  const [stockFilter, setStockFilter] = useState<"All" | "Low Stock" | "In Stock" | "Expired">("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [medicineForm, setMedicineForm] = useState<MedicineForm>(emptyMedicineForm);
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionForm>(emptyPrescriptionForm);
  const [stockForm, setStockForm] = useState<StockForm>(emptyStockForm);
  const [medicineModalMode, setMedicineModalMode] = useState<"create" | "edit" | null>(null);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionRow | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [medicineResult, prescriptionResult, itemResult, patientResult, doctorResult] = await Promise.all([
        schema().from("medicines").select("id,name,category,stock,unit,price,reorder_level,expiry_date,batch_number,supplier,cost_price,is_active,location,last_restocked_at,created_at").order("name", { ascending: true }),
        schema().from("prescriptions").select("id,patient_id,doctor_id,consultation_id,status,prescribed_at,dispensed_at").order("prescribed_at", { ascending: false }),
        schema().from("prescription_items").select("id,prescription_id,medicine_id,medicine_name,dosage,quantity,unit,unit_price"),
        schema().from("patients").select("id,name,age,gender,phone,allergies,conditions,blood_type,status").order("name", { ascending: true }),
        schema().from("staff").select("id,name,specialization,department,status,role").eq("role", "doctor").order("name", { ascending: true }),
      ]);

      if (medicineResult.error) throw medicineResult.error;
      if (prescriptionResult.error) throw prescriptionResult.error;
      if (itemResult.error) throw itemResult.error;
      if (patientResult.error) throw patientResult.error;
      if (doctorResult.error) throw doctorResult.error;

      setMedicines((medicineResult.data ?? []) as MedicineRow[]);
      setPrescriptions((prescriptionResult.data ?? []) as PrescriptionRow[]);
      setPrescriptionItems((itemResult.data ?? []) as PrescriptionItemRow[]);
      setPatients((patientResult.data ?? []) as PatientRow[]);
      setDoctors((doctorResult.data ?? []) as DoctorRow[]);
    } catch (e) {
      console.error("[Pharmacy] load error:", e);
      setError("Could not load pharmacy data. Run pharmacy-full-columns.sql and check RLS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("medicore-pharmacy-live")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "medicines" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "prescriptions" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "prescription_items" }, () => void loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const medicineMap = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);

  const itemsByPrescription = useMemo(() => {
    const map = new Map<string, PrescriptionItemRow[]>();
    prescriptionItems.forEach((item) => {
      map.set(item.prescription_id, [...(map.get(item.prescription_id) ?? []), item]);
    });
    return map;
  }, [prescriptionItems]);

  const nextMedicineId = useMemo(() => {
    const highest = medicines.reduce((max, m) => {
      const v = Number(m.id.replace(/\D/g, ""));
      return Number.isFinite(v) ? Math.max(max, v) : max;
    }, 0);
    return `MED-${String(highest + 1 || medicines.length + 1).padStart(3, "0")}`;
  }, [medicines]);

  const nextPrescriptionId = useMemo(() => {
    const highest = prescriptions.reduce((max, p) => {
      const v = Number(p.id.replace(/\D/g, ""));
      return Number.isFinite(v) ? Math.max(max, v) : max;
    }, 0);
    return `RX-${String(highest + 1 || prescriptions.length + 1).padStart(4, "0")}`;
  }, [prescriptions]);

  const filteredPrescriptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return prescriptions.filter((p) => {
      const patient = patientMap.get(p.patient_id);
      const doctor = doctorMap.get(p.doctor_id);
      const items = itemsByPrescription.get(p.id) ?? [];
      const searchable = [p.id, patient?.name ?? "", patient?.phone ?? "", doctor?.name ?? "", ...items.map((i) => i.medicine_name)].join(" ").toLowerCase();
      return (!q || searchable.includes(q)) && (statusFilter === "All" || p.status === statusFilter);
    });
  }, [doctorMap, itemsByPrescription, patientMap, prescriptions, searchTerm, statusFilter]);

  const filteredMedicines = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const today = new Date().toLocaleDateString("en-CA");
    return medicines.filter((m) => {
      const matchesSearch = !q || [m.id, m.name, m.category, m.unit].join(" ").toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "All" || m.category === categoryFilter;
      const isLow = m.stock <= m.reorder_level;
      const isExpired = m.expiry_date ? m.expiry_date < today : false;
      const matchesStock = stockFilter === "All" || (stockFilter === "Low Stock" && isLow) || (stockFilter === "In Stock" && !isLow && !isExpired) || (stockFilter === "Expired" && isExpired);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [categoryFilter, inventorySearch, medicines, stockFilter]);

  const kpis = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return {
      medicines: medicines.length,
      pending: prescriptions.filter((p) => p.status === "Pending").length,
      dispensedToday: prescriptions.filter((p) => p.dispensed_at && new Date(p.dispensed_at).toLocaleDateString("en-CA") === today).length,
      lowStock: medicines.filter((m) => m.stock <= m.reorder_level).length,
      stockValue: medicines.reduce((s, m) => s + m.stock * Number(m.price), 0),
    };
  }, [medicines, prescriptions]);

  const statusData = useMemo(() => [
    { label: "Pending", value: prescriptions.filter((p) => p.status === "Pending").length },
    { label: "Dispensed", value: prescriptions.filter((p) => p.status === "Dispensed").length },
  ], [prescriptions]);

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    medicines.forEach((m) => counts.set(m.category, (counts.get(m.category) ?? 0) + m.stock));
    return Array.from(counts.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [medicines]);

  const weeklyDispenseData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const iso = date.toLocaleDateString("en-CA");
      return { label: date.toLocaleDateString("en-US", { weekday: "short" }), value: prescriptions.filter((p) => p.dispensed_at && new Date(p.dispensed_at).toLocaleDateString("en-CA") === iso).length };
    });
  }, [prescriptions]);

  const selectedItems = selectedPrescription ? itemsByPrescription.get(selectedPrescription.id) ?? [] : [];

  /* ---------- MODALS ---------- */
  const openCreateMedicineModal = () => { setMedicineForm({ ...emptyMedicineForm, id: nextMedicineId }); setMedicineModalMode("create"); };
  const openEditMedicineModal = (m: MedicineRow) => {
    setMedicineForm({
      id: m.id, name: m.name, category: m.category, stock: String(m.stock), unit: m.unit, price: String(m.price),
      reorder_level: String(m.reorder_level), expiry_date: m.expiry_date ?? "", batch_number: m.batch_number ?? "",
      supplier: m.supplier ?? "", location: m.location ?? "Main Pharmacy", is_active: m.is_active ?? true,
    });
    setMedicineModalMode("edit");
  };
  const openStockModal = (m?: MedicineRow) => { setStockForm({ ...emptyStockForm, medicine_id: m?.id ?? medicines[0]?.id ?? "" }); setStockModalOpen(true); };
  const openPrescriptionModal = () => {
    setPrescriptionForm({ ...emptyPrescriptionForm, id: nextPrescriptionId, patient_id: patients[0]?.id ?? "", doctor_id: doctors[0]?.id ?? "", medicine_id: medicines[0]?.id ?? "" });
    setPrescriptionModalOpen(true);
  };

  /* ---------- SUBMIT HANDLERS ---------- */
  const handleMedicineSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = {
      id: medicineForm.id.trim(), name: medicineForm.name.trim(), category: medicineForm.category.trim(),
      stock: Number(medicineForm.stock), unit: medicineForm.unit.trim(), price: Number(medicineForm.price),
      reorder_level: Number(medicineForm.reorder_level), expiry_date: medicineForm.expiry_date || null,
      batch_number: medicineForm.batch_number.trim() || null, supplier: medicineForm.supplier.trim() || null,
      location: medicineForm.location.trim() || null, is_active: medicineForm.is_active,
      ...(medicineModalMode === "create" ? { last_restocked_at: new Date().toISOString() } : {}),
    };
    const { error: err } = medicineModalMode === "create"
      ? await schema().from("medicines").insert(payload)
      : await schema().from("medicines").update(payload).eq("id", medicineForm.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setNotice(medicineModalMode === "create" ? "Medicine added to inventory." : "Medicine updated.");
    setMedicineModalMode(null); setSaving(false); await loadData();
  };

  const handlePrescriptionSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const med = medicineMap.get(prescriptionForm.medicine_id);
    if (!med) { setError("Select a valid medicine."); setSaving(false); return; }
    const rxId = prescriptionForm.id.trim();
    const { error: rxErr } = await schema().from("prescriptions").insert({
      id: rxId, patient_id: prescriptionForm.patient_id, doctor_id: prescriptionForm.doctor_id,
      consultation_id: null, status: prescriptionForm.status,
    });
    if (rxErr) { setError(rxErr.message); setSaving(false); return; }
    const { error: itemErr } = await schema().from("prescription_items").insert({
      prescription_id: rxId, medicine_id: med.id, medicine_name: med.name,
      dosage: prescriptionForm.dosage.trim() || null, quantity: Number(prescriptionForm.quantity),
      unit: med.unit, unit_price: Number(med.price),
    });
    if (itemErr) { setError(itemErr.message); setSaving(false); return; }
    setNotice("Prescription added to pharmacy queue.");
    setPrescriptionModalOpen(false); setSaving(false); await loadData();
  };

  const receiveStock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const med = medicineMap.get(stockForm.medicine_id);
    if (!med) { setError("Select a valid medicine."); setSaving(false); return; }
    const nextStock = med.stock + Number(stockForm.quantity);
    const { error: err } = await schema().from("medicines").update({
      stock: nextStock,
      batch_number: stockForm.batch_number.trim() || med.batch_number || null,
      supplier: stockForm.supplier.trim() || med.supplier || null,
      expiry_date: stockForm.expiry_date || med.expiry_date || null,
      location: stockForm.location.trim() || med.location || "Main Pharmacy",
      last_restocked_at: new Date().toISOString(),
    }).eq("id", med.id);
    if (err) { setError(err.message); setSaving(false); return; }
    // Try to log stock movement (non-blocking if table doesn't exist)
    try { await schema().from("stock_movements").insert({ medicine_id: med.id, movement_type: "Received", quantity: Number(stockForm.quantity), reason: stockForm.reason }); } catch {}
    setNotice(`${med.name} stock updated to ${nextStock} ${med.unit}.`);
    setStockModalOpen(false); setSaving(false); await loadData();
  };

  const dispensePrescription = async (p: PrescriptionRow) => {
    const items = itemsByPrescription.get(p.id) ?? [];
    const missing = items.find((i) => { const m = medicineMap.get(i.medicine_id); return !m || m.stock < i.quantity; });
    if (missing) { setError(`${missing.medicine_name} does not have enough stock.`); return; }
    setSaving(true); setError(null);
    for (const item of items) {
      const med = medicineMap.get(item.medicine_id);
      if (!med) continue;
      const { error: mErr } = await schema().from("medicines").update({ stock: Math.max(0, med.stock - item.quantity) }).eq("id", med.id);
      if (mErr) { setError(mErr.message); setSaving(false); return; }
      try { await schema().from("stock_movements").insert({ medicine_id: med.id, movement_type: "Dispensed", quantity: item.quantity * -1, reason: `Dispensed ${item.medicine_name}` }); } catch {}
    }
    const { error: pErr } = await schema().from("prescriptions").update({ status: "Dispensed", dispensed_at: new Date().toISOString() }).eq("id", p.id);
    if (pErr) { setError(pErr.message); setSaving(false); return; }
    // Auto-bill
    try {
      const total = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
      const invId = `INV-${Date.now()}`;
      await schema().from("invoices").insert({ id: invId, patient_id: p.patient_id, total_amount: total, status: "Pending", payment_method: "Pharmacy" });
      await schema().from("invoice_items").insert(items.map((i) => ({ invoice_id: invId, service: `Medicine - ${i.medicine_name}`, amount: i.quantity * Number(i.unit_price) })));
    } catch (e) { console.error("[Pharmacy] auto-bill error:", e); }
    setNotice("Medication dispensed. Stock updated and invoice created.");
    setSelectedPrescription(null); setSaving(false); await loadData();
  };

  const exportInventory = () => {
    const header = "ID,Name,Category,Stock,Unit,Price,Reorder Level,Expiry,Batch,Supplier,Location";
    const rows = medicines.map((m) => [m.id, m.name, m.category, m.stock, m.unit, m.price, m.reorder_level, m.expiry_date ?? "", m.batch_number ?? "", m.supplier ?? "", m.location ?? ""].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "medicore-pharmacy-inventory.csv"; link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- UI ---------- */
  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-gradient-to-b from-white via-[#EAF4FE] to-[#F4F6F8] p-4 md:p-6">
      {/* HEADER */}
      <motion.section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"><Pill className="h-3.5 w-3.5" /> Pharmacy Information System</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dispensary &amp; Inventory</h1>
            <p className="mt-1 text-sm text-blue-50/90">Allergy screening · Batch tracking · Auto-billing</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50" onClick={openPrescriptionModal} type="button"><Plus className="h-4 w-4" /> New Prescription</button>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2ECC71] px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#27AE60]" onClick={() => openStockModal()} type="button"><Truck className="h-4 w-4" /> Receive Stock</button>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {(error || notice) && (
          <motion.div className={`flex items-start gap-3 rounded-xl border p-3 text-sm font-medium ${error ? "border-[#E74C3C]/20 bg-[#E74C3C]/5 text-[#C0392B]" : "border-[#2ECC71]/20 bg-[#2ECC71]/5 text-[#1E8C4A]"}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {error ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{error ?? notice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STATS */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Boxes} label="Medicines" value={kpis.medicines} tone="blue" />
        <MetricCard icon={ClipboardList} label="Pending Rx" value={kpis.pending} tone="yellow" />
        <MetricCard icon={PackageCheck} label="Dispensed Today" value={kpis.dispensedToday} tone="green" />
        <MetricCard icon={TrendingDown} label="Low Stock" value={kpis.lowStock} tone="red" />
        <MetricCard icon={Wallet} label="Stock Value" value={kpis.stockValue} tone="blue" money />
      </section>

      {/* CHARTS */}
      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:col-span-2">
          <div className="mb-4"><h3 className="flex items-center gap-2 text-base font-semibold"><PackageCheck className="h-4 w-4 text-[#1E88E5]" /><span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Weekly Dispensing</span></h3><p className="text-sm text-slate-500">Last 7 days</p></div>
          <ResponsiveContainer height={250} width="100%">
            <AreaChart data={weeklyDispenseData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs><linearGradient id="dispenseArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#1E88E5" stopOpacity={0.35} /><stop offset="100%" stopColor="#1E88E5" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
              <YAxis allowDecimals={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Area dataKey="value" fill="url(#dispenseArea)" stroke="#1E88E5" strokeWidth={2.5} type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800"><ReceiptText className="h-4 w-4 text-violet-600" /> Rx Status</h3>
          <p className="mb-2 text-sm text-slate-500">Distribution</p>
          {statusData.length ? (
            <>
              <div className="relative">
                <ResponsiveContainer height={160} width="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius={46} nameKey="label" outerRadius={70} paddingAngle={3} stroke="none">
                      {statusData.map((_, i) => <Cell key={i} fill={statusColors[i % statusColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-slate-900">{prescriptions.length}</span><span className="text-xs text-slate-400">total</span></div>
              </div>
              <div className="mt-3 space-y-1.5">{statusData.map((d, i) => (<div key={d.label} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColors[i] }} />{d.label}</span><span className="font-semibold text-slate-700">{d.value}</span></div>))}</div>
            </>
          ) : <div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>}
        </div>
      </section>

      {/* CATEGORY + LOW STOCK */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
          <div className="mb-4"><h3 className="flex items-center gap-2 text-base font-semibold"><Archive className="h-4 w-4 text-[#1E88E5]" /><span className="text-slate-800">Inventory by Category</span></h3><p className="text-sm text-slate-500">Stock quantity by class</p></div>
          <ResponsiveContainer height={230} width="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
              <XAxis allowDecimals={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} type="number" />
              <YAxis axisLine={false} dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} type="category" width={120} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
              <Bar dataKey="value" fill="#1E88E5" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
          <h3 className="flex items-center gap-2 text-base font-semibold"><TrendingDown className="h-4 w-4 text-[#E74C3C]" /> Low Stock Watchlist</h3>
          <p className="mb-3 text-sm text-slate-500">Medicines needing reorder</p>
          <div className="space-y-2">
            {medicines.filter((m) => m.stock <= m.reorder_level).slice(0, 6).map((m) => (
              <button key={m.id} className="flex w-full items-center justify-between rounded-xl bg-[#F4F6F8] p-3 text-left transition hover:bg-blue-50" onClick={() => setSelectedMedicine(m)} type="button">
                <div><p className="text-sm font-semibold text-slate-800">{m.name}</p><p className="text-xs text-slate-500">Reorder at {m.reorder_level} {m.unit}</p></div>
                <p className="text-xl font-bold text-[#E74C3C]">{m.stock}</p>
              </button>
            ))}
            {medicines.filter((m) => m.stock <= m.reorder_level).length === 0 && <div className="rounded-xl bg-[#F4F6F8] p-4 text-center text-sm text-slate-400">All stock levels healthy ✅</div>}
          </div>
        </div>
      </section>

      {/* PRESCRIPTION QUEUE */}
      <section className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-semibold text-slate-800">Prescription Queue</h2><p className="text-sm text-slate-500">Dispense medication &amp; update stock</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md">
              <Search className="h-4 w-4 text-[#1E88E5]" />
              <input className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-56" onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search patient, doctor..." value={searchTerm} />
            </div>
            <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">
              {prescriptionStatuses.map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${statusFilter === s ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{s}</button>)}
            </div>
          </div>
        </div>
        {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" /></div>
        : filteredPrescriptions.length === 0 ? <div className="flex h-40 flex-col items-center justify-center text-center"><FileText className="mb-2 h-10 w-10 text-slate-300" /><p className="text-sm text-slate-400">No prescriptions found</p></div>
        : <div className="space-y-3">
            {filteredPrescriptions.map((p) => {
              const patient = patientMap.get(p.patient_id);
              const doctor = doctorMap.get(p.doctor_id);
              const items = itemsByPrescription.get(p.id) ?? [];
              const allergies = patient?.allergies;
              const allergyWarn = allergies ? items.filter((i) => allergies.toLowerCase().includes(i.medicine_name.toLowerCase().split(" ")[0])) : [];
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-4 transition hover:shadow-md ${allergyWarn.length > 0 ? "border-[#E74C3C]/30 bg-[#E74C3C]/5" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><Pill className="h-5 w-5" /></div>
                      <div>
                        <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800">{patient?.name ?? p.patient_id}</p>{allergyWarn.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[#E74C3C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C0392B] ring-1 ring-inset ring-[#E74C3C]/30">⚠ ALLERGY</span>}</div>
                        <p className="text-xs text-slate-400">{p.id} · {doctor?.name ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${p.status === "Dispensed" ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40"}`}>{p.status}</span>
                      <button onClick={() => setSelectedPrescription(p)} className="flex items-center gap-1.5 rounded-xl bg-[#1E88E5]/10 px-4 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20"><Eye className="h-3.5 w-3.5" /> View &amp; Dispense</button>
                    </div>
                  </div>
                  {items.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{items.slice(0, 3).map((it) => <span key={it.id} className="rounded-lg border border-slate-100 bg-[#F4F6F8] px-2.5 py-1 text-xs font-medium text-slate-600">{it.medicine_name} ×{it.quantity}</span>)}{items.length > 3 && <span className="px-1 text-xs text-slate-400">+{items.length - 3} more</span>}</div>}
                </motion.div>
              );
            })}
          </div>}
      </section>

      {/* INVENTORY */}
      <section className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-lg font-semibold text-slate-800">Medicine Inventory</h2><p className="text-sm text-slate-500">Manage stock, batch, expiry &amp; pricing</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openCreateMedicineModal} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:opacity-90"><PackagePlus className="h-4 w-4" /> Add Medicine</button>
            <button onClick={exportInventory} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Download className="h-4 w-4" /> Export CSV</button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md">
            <Search className="h-4 w-4 text-[#1E88E5]" />
            <input className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-56" onChange={(e) => setInventorySearch(e.target.value)} placeholder="Search medicine, batch..." value={inventorySearch} />
          </div>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none transition focus:border-[#1E88E5]" onChange={(e) => setCategoryFilter(e.target.value)} value={categoryFilter}><option>All</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none transition focus:border-[#1E88E5]" onChange={(e) => setStockFilter(e.target.value as "All" | "Low Stock" | "In Stock" | "Expired")} value={stockFilter}><option>All</option><option>In Stock</option><option>Low Stock</option><option>Expired</option></select>
        </div>
        {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" /></div>
        : filteredMedicines.length === 0 ? <div className="flex h-40 flex-col items-center justify-center text-center"><PackagePlus className="mb-2 h-10 w-10 text-slate-300" /><p className="text-sm text-slate-400">No medicines found</p></div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMedicines.map((m, i) => {
              const low = m.stock <= m.reorder_level;
              const exp = expiryWarning(m);
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -4 }} className="rounded-2xl border border-white/60 bg-white p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:shadow-xl">
                  <div className="mb-3 flex items-start justify-between">
                    <button className="flex items-center gap-3 text-left" onClick={() => setSelectedMedicine(m)} type="button">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><Pill className="h-5 w-5" /></div>
                      <div><p className="text-sm font-semibold text-slate-800">{m.name}</p><p className="text-xs text-slate-400">{m.category} · {m.id}</p></div>
                    </button>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${exp === "Expired" ? "bg-[#E74C3C]/10 text-[#C0392B] ring-[#E74C3C]/30" : exp ? "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40" : low ? "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40" : "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30"}`}>{exp ?? (low ? "Low" : "OK")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[#F4F6F8] py-2"><p className="text-xs text-slate-400">Stock</p><p className="text-sm font-semibold text-slate-800">{m.stock}</p></div>
                    <div className="rounded-lg bg-[#F4F6F8] py-2"><p className="text-xs text-slate-400">Price</p><p className="text-sm font-semibold text-slate-800">{fmtKES(Number(m.price))}</p></div>
                    <div className="rounded-lg bg-[#F4F6F8] py-2"><p className="text-xs text-slate-400">Batch</p><p className="text-sm font-semibold text-slate-800">{m.batch_number ?? "—"}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setSelectedMedicine(m)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20"><Eye className="h-3.5 w-3.5" /> View</button>
                    <button onClick={() => openStockModal(m)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71]/10 py-2 text-xs font-semibold text-[#1E8C4A] transition hover:bg-[#2ECC71]/20"><Truck className="h-3.5 w-3.5" /> Stock</button>
                    <button onClick={() => openEditMedicineModal(m)} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#F1C40F]/15 px-3 py-2 text-xs font-semibold text-[#B8860B] transition hover:bg-[#F1C40F]/25"><Edit3 className="h-3.5 w-3.5" /></button>
                  </div>
                </motion.div>
              );
            })}
          </div>}
      </section>

      {/* MODALS */}
      <AnimatePresence>
        {selectedPrescription && (
          <DispenseModal
            doctor={doctorMap.get(selectedPrescription.doctor_id)} items={selectedItems} medicines={medicineMap}
            onClose={() => setSelectedPrescription(null)} onDispense={() => void dispensePrescription(selectedPrescription)}
            patient={patientMap.get(selectedPrescription.patient_id)} prescription={selectedPrescription} saving={saving}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{medicineModalMode && <MedicineFormModal form={medicineForm} mode={medicineModalMode} onChange={setMedicineForm} onClose={() => setMedicineModalMode(null)} onSubmit={handleMedicineSubmit} saving={saving} />}</AnimatePresence>
      <AnimatePresence>{prescriptionModalOpen && <PrescriptionFormModal doctors={doctors} form={prescriptionForm} medicines={medicines} onChange={setPrescriptionForm} onClose={() => setPrescriptionModalOpen(false)} onSubmit={handlePrescriptionSubmit} patients={patients} saving={saving} />}</AnimatePresence>
      <AnimatePresence>{stockModalOpen && <StockModal form={stockForm} medicines={medicines} onChange={setStockForm} onClose={() => setStockModalOpen(false)} onSubmit={receiveStock} saving={saving} />}</AnimatePresence>
      <AnimatePresence>{selectedMedicine && <MedicineDetailModal medicine={selectedMedicine} onClose={() => setSelectedMedicine(null)} onEdit={() => { openEditMedicineModal(selectedMedicine); setSelectedMedicine(null); }} onStock={() => { openStockModal(selectedMedicine); setSelectedMedicine(null); }} />}</AnimatePresence>
    </div>
  );
}

/* ---------- HELPERS ---------- */

function fmtKES(n: number) { return "KES " + n.toLocaleString("en-KE"); }

function expiryWarning(m: MedicineRow) {
  if (!m.expiry_date) return null;
  const days = Math.ceil((new Date(m.expiry_date + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return "Expired";
  if (days <= 90) return `Expires in ${days}d`;
  return null;
}

/* ---------- MODAL COMPONENTS ---------- */

function DispenseModal({ prescription, patient, doctor, items, medicines, saving, onClose, onDispense }: { prescription: PrescriptionRow; patient?: PatientRow; doctor?: DoctorRow; items: PrescriptionItemRow[]; medicines: Map<string, MedicineRow>; saving: boolean; onClose: () => void; onDispense: () => void }) {
  const total = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const allergies = patient?.allergies ?? "";
  const allergyWarn = items.filter((i) => allergies.toLowerCase().includes(i.medicine_name.toLowerCase().split(" ")[0]));
  const expired = items.map((i) => medicines.get(i.medicine_id)).filter((m): m is MedicineRow => Boolean(m && expiryWarning(m)));
  const insufficient = items.find((i) => (medicines.get(i.medicine_id)?.stock ?? 0) < i.quantity);
  const canDispense = !insufficient && prescription.status === "Pending" && allergyWarn.length === 0 && expired.length === 0;

  return (
    <Modal onClose={onClose} title="Dispense Medication">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-lg font-bold text-slate-900">{patient?.name ?? prescription.patient_id}</h3><p className="text-sm text-slate-500">{prescription.id} · {doctor?.name ?? "—"}</p></div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${prescription.status === "Dispensed" ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40"}`}>{prescription.status}</span>
          </div>
          {allergies && <p className="mt-2 text-xs text-[#C0392B]">⚠ Patient Allergies: {allergies}</p>}
        </div>

        {allergyWarn.length > 0 && <div className="rounded-xl border border-[#E74C3C]/30 bg-[#E74C3C]/10 p-3 text-sm font-medium text-[#C0392B]">⚠ Allergy conflict: {allergyWarn.map((w) => w.medicine_name).join(", ")}</div>}
        {expired.length > 0 && <div className="rounded-xl border border-[#E74C3C]/30 bg-[#E74C3C]/10 p-3 text-sm font-medium text-[#C0392B]">⚠ Expired: {expired.map((m) => m.name).join(", ")}</div>}
        {insufficient && <div className="rounded-xl border border-[#F1C40F]/30 bg-[#F1C40F]/10 p-3 text-sm font-medium text-[#B8860B]">⚠ Insufficient stock: {insufficient.medicine_name}</div>}

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400"><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Dosage</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {items.map((it) => { const med = medicines.get(it.medicine_id); const enough = (med?.stock ?? 0) >= it.quantity; return (
                <tr key={it.id} className="border-t border-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{it.medicine_name}</td>
                  <td className="px-3 py-2 text-slate-500">{it.dosage || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{it.quantity} {it.unit}</td>
                  <td className={`px-3 py-2 font-semibold ${enough ? "text-[#1E8C4A]" : "text-[#C0392B]"}`}>{med?.stock ?? 0}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">{fmtKES(it.quantity * Number(it.unit_price))}</td>
                </tr>); })}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-200 bg-[#F4F6F8]"><td colSpan={4} className="px-3 py-2 font-semibold text-slate-900">Total</td><td className="px-3 py-2 text-right text-base font-bold text-[#1E88E5]">{fmtKES(total)}</td></tr></tfoot>
          </table>
        </div>
        <div className="rounded-xl bg-[#1E88E5]/5 p-3 text-xs text-[#1E88E5]">Auto-billing: a pending invoice with line items will be created for this patient.</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Close</button>
          <button disabled={!canDispense || saving} onClick={onDispense} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2ECC71]/30 transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Confirm Dispense</button>
        </div>
      </div>
    </Modal>
  );
}

function MedicineFormModal({ form, mode, saving, onChange, onClose, onSubmit }: { form: MedicineForm; mode: "create" | "edit"; saving: boolean; onChange: (f: MedicineForm) => void; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Modal onClose={onClose} title={mode === "create" ? "Add Medicine" : "Edit Medicine"}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Medicine ID"><input className={inputClass} disabled={mode === "edit"} value={form.id} onChange={(e) => onChange({ ...form, id: e.target.value })} /></Field>
        <Field label="Name" required><input className={inputClass} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" /></Field>
        <Field label="Category"><select className={inputClass} value={form.category} onChange={(e) => onChange({ ...form, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Unit"><select className={inputClass} value={form.unit} onChange={(e) => onChange({ ...form, unit: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Stock"><input type="number" className={inputClass} value={form.stock} onChange={(e) => onChange({ ...form, stock: e.target.value })} /></Field>
        <Field label="Reorder Level"><input type="number" className={inputClass} value={form.reorder_level} onChange={(e) => onChange({ ...form, reorder_level: e.target.value })} /></Field>
        <Field label="Price (KES)"><input type="number" className={inputClass} value={form.price} onChange={(e) => onChange({ ...form, price: e.target.value })} /></Field>
        <Field label="Expiry Date"><input type="date" className={inputClass} value={form.expiry_date} onChange={(e) => onChange({ ...form, expiry_date: e.target.value })} /></Field>
        <Field label="Batch Number"><input className={inputClass} value={form.batch_number} onChange={(e) => onChange({ ...form, batch_number: e.target.value })} placeholder="e.g. BATCH-2024-001" /></Field>
        <Field label="Supplier"><input className={inputClass} value={form.supplier} onChange={(e) => onChange({ ...form, supplier: e.target.value })} placeholder="e.g. Phillips Pharma" /></Field>
        <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => onChange({ ...form, location: e.target.value })} /></Field>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(e) => onChange({ ...form, is_active: e.target.checked })} /> Active</label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:opacity-90 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? <Plus className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{mode === "create" ? "Add Medicine" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PrescriptionFormModal({ form, patients, doctors, medicines, saving, onChange, onClose, onSubmit }: { form: PrescriptionForm; patients: PatientRow[]; doctors: DoctorRow[]; medicines: MedicineRow[]; saving: boolean; onChange: (f: PrescriptionForm) => void; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Modal onClose={onClose} title="New Prescription">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Prescription ID"><input className={inputClass} value={form.id} onChange={(e) => onChange({ ...form, id: e.target.value })} /></Field>
        <Field label="Patient" required><select className={inputClass} value={form.patient_id} onChange={(e) => onChange({ ...form, patient_id: e.target.value })}><option value="">Select patient...</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Doctor" required><select className={inputClass} value={form.doctor_id} onChange={(e) => onChange({ ...form, doctor_id: e.target.value })}><option value="">Select doctor...</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Medicine" required><select className={inputClass} value={form.medicine_id} onChange={(e) => onChange({ ...form, medicine_id: e.target.value })}><option value="">Select medicine...</option>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stock} {m.unit})</option>)}</select></Field>
        <Field label="Dosage"><input className={inputClass} value={form.dosage} onChange={(e) => onChange({ ...form, dosage: e.target.value })} placeholder="e.g. 1 tab TDS" /></Field>
        <Field label="Quantity"><input type="number" className={inputClass} value={form.quantity} onChange={(e) => onChange({ ...form, quantity: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create Prescription</button>
        </div>
      </form>
    </Modal>
  );
}

function StockModal({ form, medicines, saving, onChange, onClose, onSubmit }: { form: StockForm; medicines: MedicineRow[]; saving: boolean; onChange: (f: StockForm) => void; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Modal onClose={onClose} title="Receive Stock">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Medicine" required className="sm:col-span-2"><select className={inputClass} value={form.medicine_id} onChange={(e) => onChange({ ...form, medicine_id: e.target.value })}><option value="">Select medicine...</option>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stock} {m.unit})</option>)}</select></Field>
        <Field label="Quantity Received" required><input type="number" className={inputClass} value={form.quantity} onChange={(e) => onChange({ ...form, quantity: e.target.value })} /></Field>
        <Field label="Batch Number"><input className={inputClass} value={form.batch_number} onChange={(e) => onChange({ ...form, batch_number: e.target.value })} placeholder="e.g. BATCH-2024-001" /></Field>
        <Field label="Supplier"><input className={inputClass} value={form.supplier} onChange={(e) => onChange({ ...form, supplier: e.target.value })} placeholder="e.g. Phillips Pharma" /></Field>
        <Field label="Expiry Date"><input type="date" className={inputClass} value={form.expiry_date} onChange={(e) => onChange({ ...form, expiry_date: e.target.value })} /></Field>
        <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => onChange({ ...form, location: e.target.value })} /></Field>
        <Field label="Reason"><input className={inputClass} value={form.reason} onChange={(e) => onChange({ ...form, reason: e.target.value })} /></Field>
        <div className="rounded-xl bg-[#2ECC71]/5 p-3 text-xs text-[#1E8C4A] sm:col-span-2">Stock movement will be logged for audit trail.</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}Update Stock</button>
        </div>
      </form>
    </Modal>
  );
}

function MedicineDetailModal({ medicine, onClose, onEdit, onStock }: { medicine: MedicineRow; onClose: () => void; onEdit: () => void; onStock: () => void }) {
  const exp = expiryWarning(medicine);
  return (
    <Modal onClose={onClose} title="Medicine Details">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><Pill className="h-7 w-7" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{medicine.name}</h3>
              <p className="text-sm text-slate-500">{medicine.id} · {medicine.category}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniInfo label="Stock" value={`${medicine.stock} ${medicine.unit}`} />
          <MiniInfo label="Price" value={fmtKES(Number(medicine.price))} />
          <MiniInfo label="Reorder At" value={`${medicine.reorder_level}`} />
          <MiniInfo label="Status" value={medicine.is_active === false ? "Inactive" : "Active"} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniInfo label="Batch Number" value={medicine.batch_number || "Not set"} />
          <MiniInfo label="Supplier" value={medicine.supplier || "Not set"} />
          <MiniInfo label="Location" value={medicine.location || "Main Pharmacy"} />
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-400">Expiry Date</p>
          <p className={`mt-1 text-sm font-medium ${exp ? "text-[#C0392B]" : "text-slate-700"}`}>{medicine.expiry_date ? new Date(medicine.expiry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not recorded"}{exp ? ` — ${exp}` : ""}</p>
        </div>
        {medicine.last_restocked_at && <p className="text-xs text-slate-400">Last restocked: {new Date(medicine.last_restocked_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Close</button>
          <button onClick={onStock} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]"><Truck className="h-4 w-4" /> Receive Stock</button>
          <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]"><Edit3 className="h-4 w-4" /> Edit</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- SHARED COMPONENTS ---------- */

function MetricCard({ icon: Icon, label, value, tone, money = false }: { icon: LucideIcon; label: string; value: number; tone: "blue" | "green" | "yellow" | "red"; money?: boolean }) {
  const toneMap = { blue: "from-[#1E88E5] to-[#64B5F6]", green: "from-[#2ECC71] to-[#58D68D]", yellow: "from-[#F1C40F] to-[#F39C12]", red: "from-[#E74C3C] to-[#EC7063]" };
  return (
    <motion.div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }}>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${toneMap[tone]} opacity-10`} />
      <div className="relative flex items-start justify-between">
        <div><p className="text-sm font-medium text-slate-500">{label}</p><p className={`mt-2 bg-gradient-to-r ${toneMap[tone]} bg-clip-text text-2xl font-bold tracking-tight text-transparent`}>{money ? fmtKES(value) : value.toLocaleString()}</p></div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${toneMap[tone]} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
      </div>
    </motion.div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-[#F4F6F8] p-3"><p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-700">{value}</p></div>;
}

function Field({ children, label, className, required }: { children: ReactNode; label: string; className?: string; required?: boolean }) {
  return <label className={`block ${className ?? ""}`}><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}{required && <span className="text-[#E74C3C]"> *</span>}</span>{children}</label>;
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20 disabled:bg-slate-50 disabled:text-slate-400";
