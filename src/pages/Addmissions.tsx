import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BedDouble,
  UserPlus,
  Search,
  X,
  Eye,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Clock,
  Building2,
  DoorOpen,
  FileText,
  ShieldAlert, // Isolation
  HeartCrack,  // DNR
  LayoutGrid,
  List as ListIcon,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type AdmStatus = "Admitted" | "Discharged";
type AdmType = "Emergency" | "Routine" | "Maternity" | "Surgical" | "ICU";

interface NursingNote {
  time: string;
  author: string;
  bp?: string;
  temp?: string;
  pulse?: string;
  note?: string;
}

interface Admission {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  ward: string;
  bed_number: string | null;
  admission_type: AdmType;
  reason: string | null;
  status: AdmStatus;
  daily_rate: number;
  admitted_at: string;
  discharged_at: string | null;
  notes: string | null;
  is_isolation?: boolean;
  is_dnr?: boolean;
  nursing_notes?: NursingNote[];
  patients?: { name: string; phone?: string; blood_type?: string; allergies?: string | null } | null;
  staff?: { name: string } | null;
}

interface OptionItem {
  id: string;
  name: string;
}

interface FormState {
  patient_id: string;
  doctor_id: string;
  ward: string;
  bed_number: string;
  admission_type: AdmType;
  reason: string;
  daily_rate: string;
  notes: string;
  is_isolation: boolean;
  is_dnr: boolean;
}

/* ============================ CONFIG ============================ */

const WARD_CONFIG = [
  { name: "General Ward", capacity: 12, color: "#1E88E5" },
  { name: "ICU", capacity: 6, color: "#7C3AED" },
  { name: "Maternity", capacity: 8, color: "#DB2777" },
  { name: "Pediatric", capacity: 8, color: "#F1C40F" },
  { name: "Surgical", capacity: 10, color: "#10b981" },
  { name: "Private Suite", capacity: 5, color: "#64748b" },
  { name: "Isolation", capacity: 4, color: "#E74C3C" },
];

const ADM_TYPES: AdmType[] = ["Emergency", "Routine", "Maternity", "Surgical", "ICU"];

const TYPE_META: Record<AdmType, { chip: string; hex: string }> = {
  Emergency: { chip: "bg-[#E74C3C]/10 text-[#C0392B] ring-[#E74C3C]/30", hex: "#E74C3C" },
  ICU: { chip: "bg-violet-100 text-violet-700 ring-violet-300", hex: "#7C3AED" },
  Maternity: { chip: "bg-pink-100 text-pink-700 ring-pink-300", hex: "#DB2777" },
  Surgical: { chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30", hex: "#1E88E5" },
  Routine: { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", hex: "#2ECC71" },
};

const STATUS_META: Record<AdmStatus, { chip: string; dot: string }> = {
  Admitted: { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71" },
  Discharged: { chip: "bg-slate-100 text-slate-500 ring-slate-200", dot: "#94a3b8" },
};

const emptyForm: FormState = {
  patient_id: "",
  doctor_id: "",
  ward: "General Ward",
  bed_number: "",
  admission_type: "Routine",
  reason: "",
  daily_rate: "5000",
  notes: "",
  is_isolation: false,
  is_dnr: false,
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

/* ============================ HELPERS ============================ */

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const patientName = (a: Admission) => a.patients?.name ?? "Unknown";
const doctorName = (a: Admission) => a.staff?.name ?? "—";

const lengthOfStay = (admitted: string, discharged: string | null) => {
  const end = discharged ? new Date(discharged).getTime() : Date.now();
  const days = Math.max(0, Math.floor((end - new Date(admitted).getTime()) / 86400000));
  return days;
};

const fmtKES = (n: number) => "KES " + n.toLocaleString("en-KE");

/* ============================ COMPONENT ============================ */

export default function Admissions() {
  const { profile } = useAuth();

  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [patients, setPatients] = useState<OptionItem[]>([]);
  const [doctors, setDoctors] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [wardFilter, setWardFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<AdmStatus | "All">("All");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Admission | null>(null);
  const [viewing, setViewing] = useState<Admission | null>(null);
  const [discharging, setDischarging] = useState<Admission | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
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
        .from("admissions")
        .select("id, patient_id, doctor_id, ward, bed_number, admission_type, reason, status, daily_rate, admitted_at, discharged_at, notes, is_isolation, is_dnr, nursing_notes, patients(name, phone, blood_type, allergies), staff(name)")
        .order("admitted_at", { ascending: false });
      if (err) throw err;
      setAdmissions((data as unknown as Admission[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Admissions] load error:", e);
      setError("Failed to load admissions. Ensure you ran the updated SQL.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([
        supabase.schema("medicore").from("patients").select("id, name").order("name"),
        supabase.schema("medicore").from("staff").select("id, name").eq("role", "doctor").order("name"),
      ]);
      setPatients((p.data as OptionItem[]) ?? []);
      setDoctors((d.data as OptionItem[]) ?? []);
    } catch (e) {
      console.error("[Admissions] options error:", e);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel("medicore-admissions")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "admissions" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const activeAdmissions = useMemo(() => admissions.filter((a) => a.status === "Admitted"), [admissions]);

  const filtered = useMemo(() => {
    return admissions.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || patientName(a).toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.ward.toLowerCase().includes(q) || (a.bed_number ?? "").toLowerCase().includes(q);
      const matchesWard = wardFilter === "All" || a.ward === wardFilter;
      const matchesStatus = statusFilter === "All" || a.status === statusFilter;
      return matchesSearch && matchesWard && matchesStatus;
    });
  }, [admissions, search, wardFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalBeds = WARD_CONFIG.reduce((sum, w) => sum + w.capacity, 0);
    const occupied = activeAdmissions.length;
    return {
      total: admissions.length,
      admitted: occupied,
      wards: new Set(activeAdmissions.map((a) => a.ward)).size,
      occupancy: Math.round((occupied / totalBeds) * 100),
      avgStay: activeAdmissions.length ? Math.round(activeAdmissions.reduce((s, a) => s + lengthOfStay(a.admitted_at, null), 0) / activeAdmissions.length) : 0,
    };
  }, [admissions, activeAdmissions]);

  /* ---------------- FORM ---------------- */
  const openAdmit = (ward?: string, bed?: string) => {
    setForm({ ...emptyForm, ward: ward ?? "General Ward", bed_number: bed ?? "" });
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (a: Admission) => {
    setForm({
      patient_id: a.patient_id,
      doctor_id: a.doctor_id ?? "",
      ward: a.ward,
      bed_number: a.bed_number ?? "",
      admission_type: a.admission_type,
      reason: a.reason ?? "",
      daily_rate: String(a.daily_rate),
      notes: a.notes ?? "",
      is_isolation: a.is_isolation ?? false,
      is_dnr: a.is_dnr ?? false,
    });
    setEditing(a);
    setViewing(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.patient_id) {
      showToast("error", "Please select a patient.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patient_id: form.patient_id,
        doctor_id: form.doctor_id || null,
        ward: form.ward,
        bed_number: form.bed_number.trim() || null,
        admission_type: form.admission_type,
        reason: form.reason.trim() || null,
        daily_rate: Number(form.daily_rate) || 5000,
        notes: form.notes.trim() || null,
        is_isolation: form.is_isolation,
        is_dnr: form.is_dnr,
      };
      if (editing) {
        const { error: e } = await supabase.schema("medicore").from("admissions").update(payload).eq("id", editing.id);
        if (e) throw e;
        showToast("success", `${editing.id} updated.`);
      } else {
        const id = `ADM-${String(stats.total + 1).padStart(4, "0")}`;
        const { error: e } = await supabase.schema("medicore").from("admissions").insert({ ...payload, id, status: "Admitted" });
        if (e) throw e;
        showToast("success", `${patients.find(p => p.id === form.patient_id)?.name ?? "Patient"} admitted.`);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      console.error("[Admissions] save error:", e);
      showToast("error", "Could not save admission.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDischarge = async () => {
    if (!discharging) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.schema("medicore").from("admissions").update({ status: "Discharged", discharged_at: new Date().toISOString() }).eq("id", discharging.id);
      if (e) throw e;
      showToast("success", `${patientName(discharging)} discharged.`);
      setDischarging(null);
      setViewing(null);
      await load();
    } catch (e) {
      console.error("[Admissions] discharge error:", e);
      showToast("error", "Could not discharge patient.");
    } finally {
      setSaving(false);
    }
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
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Building2 className="h-3.5 w-3.5" /> Ward Command Center
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admissions &amp; Bed Board</h1>
            <p className="mt-1 text-sm text-blue-50/90">Live bed management · Clinical notes · Vitals tracking{profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}</p>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => openAdmit()} className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50">
            <UserPlus className="h-4 w-4" /> Admit Patient
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
        <StatCard label="Bed Occupancy" value={stats.occupancy} suffix="%" icon={Activity} gradient="from-[#1E88E5] to-[#64B5F6]" delta="Capacity used" />
        <StatCard label="Admitted" value={stats.admitted} icon={BedDouble} gradient="from-[#2ECC71] to-[#58D68D]" delta="In care now" />
        <StatCard label="Active Wards" value={stats.wards} icon={Building2} gradient="from-violet-500 to-purple-600" delta="In use" />
        <StatCard label="Avg Stay" value={stats.avgStay} suffix=" days" icon={Clock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Duration" />
      </div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-[#F4F6F8] p-1">
              <button onClick={() => setView("board")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === "board" ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500"}`}><LayoutGrid className="h-3.5 w-3.5" /> Bed Board</button>
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === "list" ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500"}`}><ListIcon className="h-3.5 w-3.5" /> List View</button>
            </div>
            <select value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20">
              <option value="All">All Wards</option>
              {WARD_CONFIG.map((w) => <option key={w.name}>{w.name}</option>)}
            </select>
            {view === "list" && (
              <FilterPills options={["All", "Admitted", "Discharged"]} value={statusFilter} onChange={(v) => setStatusFilter(v as AdmStatus | "All")} />
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md lg:w-80">
            <Search className="h-4 w-4 text-[#1E88E5]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, ID, bed..." className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-white/60 bg-white/70 backdrop-blur-md"><Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" /></div>
      ) : view === "board" ? (
        /* BED BOARD VIEW */
        <div className="space-y-8">
          {WARD_CONFIG.filter(w => wardFilter === "All" || w.name === wardFilter).map((ward) => {
            const beds = Array.from({ length: ward.capacity }, (_, i) => {
              const bedNum = String(i + 1);
              const occupant = activeAdmissions.find(a => a.ward === ward.name && a.bed_number === bedNum);
              return { bedNum, occupant };
            });
            const occupiedCount = beds.filter(b => b.occupant).length;

            return (
              <div key={ward.name}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: ward.color }}></span>
                  <h3 className="text-base font-bold text-slate-800">{ward.name}</h3>
                  <span className="text-xs text-slate-500">{occupiedCount}/{ward.capacity} Occupied</span>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {beds.map((bed) => (
                    <motion.button
                      key={bed.bedNum}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -3 }}
                      onClick={() => bed.occupant ? setViewing(bed.occupant) : openAdmit(ward.name, bed.bedNum)}
                      className={`relative flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition ${
                        bed.occupant
                          ? "border-transparent bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white shadow-lg shadow-[#1E88E5]/30"
                          : "border-dashed border-slate-300 bg-white/50 text-slate-400 hover:border-[#1E88E5] hover:text-[#1E88E5]"
                      }`}
                    >
                      {bed.occupant ? (
                        <>
                          <BedDouble className="h-5 w-5 mb-1" />
                          <p className="text-[10px] font-bold uppercase">Bed {bed.bedNum}</p>
                          <p className="mt-1 text-xs font-semibold truncate w-full">{patientName(bed.occupant)}</p>
                          
                          {/* Safety Flags */}
                          <div className="absolute -right-1.5 -top-1.5 flex gap-1">
                            {bed.occupant.is_isolation && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1C40F] text-white ring-2 ring-white"><ShieldAlert className="h-3 w-3" /></span>
                            )}
                            {bed.occupant.is_dnr && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E74C3C] text-white ring-2 ring-white"><HeartCrack className="h-3 w-3" /></span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 mb-1" />
                          <p className="text-[10px] font-bold uppercase">Bed {bed.bedNum}</p>
                          <p className="mt-1 text-[10px]">Empty</p>
                        </>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/70 py-16 text-center backdrop-blur-md">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400"><BedDouble className="h-8 w-8" /></div>
              <p className="font-semibold text-slate-700">No admissions found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a, i) => {
                const los = lengthOfStay(a.admitted_at, a.discharged_at);
                const tmeta = TYPE_META[a.admission_type];
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} whileHover={{ y: -4 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
                    <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: tmeta.hex }} />
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><BedDouble className="h-5 w-5" /></div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{patientName(a)}</h3>
                          <p className="text-xs text-slate-400">{a.ward}{a.bed_number ? ` · Bed ${a.bed_number}` : ""}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_META[a.status].chip}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[a.status].dot }} />{a.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#F4F6F8] px-2 py-0.5 text-[10px] font-medium text-slate-600"><Clock className="h-3 w-3" /> {los} day{los !== 1 ? "s" : ""}</span>
                      {a.is_isolation && <span className="inline-flex items-center gap-1 rounded-lg bg-[#F1C40F]/10 px-2 py-0.5 text-[10px] font-semibold text-[#B8860B]"><ShieldAlert className="h-3 w-3" /> Isolation</span>}
                      {a.is_dnr && <span className="inline-flex items-center gap-1 rounded-lg bg-[#E74C3C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C0392B]"><HeartCrack className="h-3 w-3" /> DNR</span>}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => setViewing(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5]"><Eye className="h-3.5 w-3.5" /> View</button>
                      {a.status === "Admitted" && <button onClick={() => setDischarging(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71] py-2 text-xs font-semibold text-white"><DoorOpen className="h-3.5 w-3.5" /> Discharge</button>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- ADMIT / EDIT MODAL ---------------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Admission" : "Admit Patient"} subtitle={editing ? editing.id : "Assign ward, bed & clinical flags"} icon={<BedDouble className="h-5 w-5" />} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Patient" required className="sm:col-span-2">
            <select className={inputCls} value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} disabled={!!editing}>
              <option value="">Select patient...</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </Field>
          <Field label="Ward" required>
            <select className={inputCls} value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })}>{WARD_CONFIG.map((w) => <option key={w.name}>{w.name}</option>)}</select>
          </Field>
          <Field label="Bed Number">
            <input className={inputCls} value={form.bed_number} onChange={(e) => setForm({ ...form, bed_number: e.target.value })} placeholder="e.g. 1" />
          </Field>
          <Field label="Attending Doctor">
            <select className={inputCls} value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
              <option value="">Select doctor...</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Daily Rate (KES)">
            <input type="number" className={inputCls} value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} placeholder="5000" />
          </Field>
          
          <div className="sm:col-span-2 mt-2 grid grid-cols-2 gap-4">
            <Toggle 
              label="Isolation Required" 
              desc="Infection control" 
              icon={<ShieldAlert className="h-5 w-5 text-[#F1C40F]" />} 
              active={form.is_isolation} 
              onClick={() => setForm({ ...form, is_isolation: !form.is_isolation })} 
            />
            <Toggle 
              label="DNR Status" 
              desc="Do Not Resuscitate" 
              icon={<HeartCrack className="h-5 w-5 text-[#E74C3C]" />} 
              active={form.is_dnr} 
              onClick={() => setForm({ ...form, is_dnr: !form.is_dnr })} 
            />
          </div>

          <Field label="Reason for Admission" className="sm:col-span-2">
            <input className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Severe malaria requiring IV" />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={() => setFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
          <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <CheckCircle2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {editing ? "Save Changes" : "Admit Patient"}
          </button>
        </div>
      </Modal>

      {/* ---------------- VIEW MODAL (CLINICAL HUB) ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Admission & Clinical Record" subtitle={viewing?.id} icon={<FileText className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><BedDouble className="h-6 w-6" /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{patientName(viewing)}</h3>
                  <p className="text-sm text-slate-500">{viewing.ward} · Bed {viewing.bed_number ?? "N/A"}</p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_META[viewing.status].chip}`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[viewing.status].dot }} />{viewing.status}
                </span>
                <div className="flex gap-2">
                  {viewing.is_isolation && <span className="inline-flex items-center gap-1 rounded-full bg-[#F1C40F]/10 px-2 py-0.5 text-[10px] font-bold text-[#B8860B]"><ShieldAlert className="h-3 w-3" /> ISOLATION</span>}
                  {viewing.is_dnr && <span className="inline-flex items-center gap-1 rounded-full bg-[#E74C3C]/10 px-2 py-0.5 text-[10px] font-bold text-[#C0392B]"><HeartCrack className="h-3 w-3" /> DNR</span>}
                </div>
              </div>
            </div>

            {/* Vitals Chart & Notes */}
            <div className="rounded-2xl border border-slate-100 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><Activity className="h-4 w-4 text-[#1E88E5]" /> Vitals & Nursing Notes</h4>
              
              {viewing.nursing_notes && viewing.nursing_notes.length > 0 ? (
                <div className="mb-4 h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={viewing.nursing_notes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="temp" stroke="#F1C40F" strokeWidth={2} dot={{ r: 3 }} name="Temp (°C)" />
                      <Line type="monotone" dataKey="pulse" stroke="#1E88E5" strokeWidth={2} dot={{ r: 3 }} name="Pulse (bpm)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mb-4 flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">No vitals charted yet</div>
              )}

              <div className="max-h-32 space-y-2 overflow-y-auto pr-2">
                {viewing.nursing_notes && viewing.nursing_notes.map((n, i) => (
                  <div key={i} className="rounded-lg bg-slate-50 p-2 text-xs">
                    <div className="flex justify-between border-b border-slate-200 pb-1 mb-1 font-semibold">
                      <span>{new Date(n.time).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>{n.author}</span>
                    </div>
                    <div className="flex gap-3 text-slate-600">
                      {n.bp && <span>BP: {n.bp}</span>}
                      {n.temp && <span>Temp: {n.temp}°C</span>}
                      {n.pulse && <span>Pulse: {n.pulse}</span>}
                    </div>
                    {n.note && <p className="mt-1 text-slate-500 italic">"{n.note}"</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Close</button>
              {viewing.status === "Admitted" && (
                <>
                  <button onClick={() => openEdit(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]"><Pencil className="h-4 w-4" /> Edit</button>
                  <button onClick={() => setDischarging(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]"><DoorOpen className="h-4 w-4" /> Discharge</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- DISCHARGE MODAL ---------------- */}
      <Modal open={!!discharging} onClose={() => setDischarging(null)} title="Discharge Patient" subtitle={discharging?.id} icon={<DoorOpen className="h-5 w-5" />}>
        {discharging && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-[#2ECC71]/5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2ECC71]/10 text-[#1E8C4A]"><DoorOpen className="h-5 w-5" /></div>
              <p className="text-sm text-slate-600">Discharge <span className="font-semibold text-slate-900">{patientName(discharging)}</span>? <br/> Final Bill: <span className="font-bold text-[#1E88E5]">{fmtKES(lengthOfStay(discharging.admitted_at, null) * Number(discharging.daily_rate))}</span></p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setDischarging(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
              <button disabled={saving} onClick={confirmDischarge} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />} Confirm Discharge
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- TOAST ---------------- */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 30, x: "-50%" }} className={`fixed bottom-24 left-1/2 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl lg:bottom-6 ${toast.type === "success" ? "bg-[#2ECC71]" : toast.type === "error" ? "bg-[#E74C3C]" : "bg-[#1E88E5]"}`}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : toast.type === "error" ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}{toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function StatCard({ label, value, suffix, icon: Icon, gradient, delta }: { label: string; value: number; suffix?: string; icon: typeof BedDouble; gradient: string; delta: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-3xl font-bold tracking-tight text-transparent`}>{display.toLocaleString()}{suffix}</p>
          <p className="mt-1 text-xs text-slate-400">{delta}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
      </div>
    </motion.div>
  );
}

function Toggle({ label, desc, icon, active, onClick }: { label: string; desc: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-[#1E88E5] bg-[#1E88E5]/5" : "border-slate-200 bg-white"}`}>
      {icon}
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>      
      <div className={`flex h-6 w-11 items-center rounded-full p-1 transition ${active ? "bg-[#1E88E5]" : "bg-slate-200"}`}>
        <motion.div layout className={`h-4 w-4 rounded-full bg-white shadow-sm`} />
      </div>
    </button>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label} {required && <span className="text-[#E74C3C]">*</span>}</span>{children}
    </label>
  );
}

function FilterPills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === o ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{o}</button>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, subtitle, icon, size = "md", children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: React.ReactNode; size?: "md" | "lg"; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.25 }} className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${size === "lg" ? "max-w-2xl" : "max-w-xl"}`}>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-3">
                {icon && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">{icon}</div>}
                <div><h3 className="text-lg font-semibold text-slate-900">{title}</h3>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}