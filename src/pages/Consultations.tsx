import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Stethoscope, Plus, Search, X, Eye, Loader2, Thermometer, Activity, HeartPulse, Weight,
  ClipboardList, CheckCircle2, AlertTriangle, CalendarClock, FileText, User, Tag,
  ChevronRight, ShieldAlert, Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

interface Consultation {
  id: string; patient_id: string; doctor_id: string;
  chief_complaint: string | null; hpi: string | null;
  symptoms: string | null; diagnosis: string | null;
  objective_exam: string | null; assessment: string | null;
  plan_notes: string | null; notes: string | null;
  bp: string | null; temperature: string | null; pulse: string | null; weight: string | null;
  follow_up_date: string | null; icd10_code: string | null;
  visit_date: string; duration_minutes: number | null;
  // Single objects for to-one relations
  patients?: { name: string; age?: number; gender?: string; blood_type?: string; allergies?: string | null; conditions?: string | null } | null;
  staff?: { name: string } | null;
}

interface OptionItem { id: string; name: string; }

interface Medicine {
  id: string; name: string; category: string; stock: number; unit: string; price: number;
}

interface RxDraft {
  medicine_id: string; medicine_name: string; dosage: string;
  frequency: string; duration: number; quantity: number; unit: string; unit_price: number;
  instructions: string;
}

interface FormState {
  patient_id: string; doctor_id: string;
  chief_complaint: string; hpi: string;
  bp: string; temperature: string; pulse: string; weight: string;
  objective_exam: string; assessment: string; plan_notes: string;
  diagnosis: string; notes: string; follow_up_days: string;
}

/* ============================ VITALS INTERPRETATION ============================ */

interface VitalFlag { level: "normal" | "warning" | "critical"; label: string; color: string; }

function interpretBP(bp: string): VitalFlag | null {
  const m = bp.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const sys = Number(m[1]); const dia = Number(m[2]);
  if (sys >= 180 || dia >= 120) return { level: "critical", label: "Hypertensive Crisis", color: "#E74C3C" };
  if (sys >= 140 || dia >= 90) return { level: "warning", label: "Hypertension", color: "#F1C40F" };
  return { level: "normal", label: "Normal", color: "#2ECC71" };
}

function interpretTemp(temp: string): VitalFlag | null {
  const t = parseFloat(temp);
  if (isNaN(t)) return null;
  if (t >= 39.5) return { level: "critical", label: "High Fever", color: "#E74C3C" };
  if (t >= 37.5) return { level: "warning", label: "Fever", color: "#F1C40F" };
  return { level: "normal", label: "Normal", color: "#2ECC71" };
}

function interpretPulse(pulse: string): VitalFlag | null {
  const p = parseInt(pulse);
  if (isNaN(p)) return null;
  if (p >= 130) return { level: "critical", label: "Severe Tachycardia", color: "#E74C3C" };
  if (p >= 100) return { level: "warning", label: "Tachycardia", color: "#F1C40F" };
  return { level: "normal", label: "Normal", color: "#2ECC71" };
}

/* ============================ CONFIG ============================ */

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

const FREQUENCIES = ["OD (once daily)", "BID (twice daily)", "TDS (3x daily)", "QID (4x daily)", "PRN (as needed)", "STAT (immediate)"];
const DURATIONS = [1, 3, 5, 7, 10, 14, 30];
const COMMON_SYMPTOMS = ["Fever", "Headache", "Cough", "Fatigue", "Nausea", "Chest pain", "Shortness of breath", "Dizziness", "Abdominal pain", "Vomiting", "Joint pain", "Sore throat"];
const COMMON_DIAGNOSES = [
  { label: "Malaria (Uncomplicated)", icd10: "B54" },
  { label: "Upper Respiratory Tract Infection", icd10: "J06.9" },
  { label: "Essential Hypertension", icd10: "I10" },
  { label: "Type 2 Diabetes Mellitus", icd10: "E11.9" },
  { label: "Acute Gastroenteritis", icd10: "A09" },
  { label: "Urinary Tract Infection", icd10: "N39.0" },
  { label: "Bronchial Asthma", icd10: "J45.9" },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtKES = (n: number) => "KES " + n.toLocaleString("en-KE");

const parseSymptoms = (raw: string | null): string[] => {
  if (!raw) return [];
  try { const p = JSON.parse(raw); if (Array.isArray(p)) return p.filter((x: unknown) => typeof x === "string"); } catch { /* */ }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

const patientName = (c: Consultation) => c.patients?.name ?? "Unknown";
const patientMeta = (c: Consultation) => {
  const p = c.patients; if (!p) return "—";
  return `${p.age ?? "—"} yrs · ${p.gender ?? "—"}`;
};
const doctorName = (c: Consultation) => c.staff?.name ?? "—";

const emptyForm: FormState = {
  patient_id: "", doctor_id: "", chief_complaint: "", hpi: "",
  bp: "", temperature: "", pulse: "", weight: "",
  objective_exam: "", assessment: "", plan_notes: "",
  diagnosis: "", notes: "", follow_up_days: "",
};

/* ============================ COMPONENT ============================ */

export default function Consultations() {
  const { profile } = useAuth();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<OptionItem[]>([]);
  const [doctors, setDoctors] = useState<OptionItem[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [patientDetail, setPatientDetail] = useState<{ allergies?: string; conditions?: string; blood_type?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Diagnosed" | "Pending">("All");

  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Consultation | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
  const [rxDrafts, setRxDrafts] = useState<RxDraft[]>([]);
  const [labRequests, setLabRequests] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", msg: string) => { setToast({ type, message: msg }); setTimeout(() => setToast(null), 3500); };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const [conRes, patRes, docRes, medRes] = await Promise.all([
        supabase.schema("medicore").from("consultations")
          .select("id, patient_id, doctor_id, chief_complaint, hpi, symptoms, diagnosis, objective_exam, assessment, plan_notes, notes, bp, temperature, pulse, weight, follow_up_date, icd10_code, visit_date, duration_minutes, patients(name, age, gender, blood_type, allergies, conditions), staff(name)")
          .order("visit_date", { ascending: false }),
        supabase.schema("medicore").from("patients").select("id, name").order("name"),
        supabase.schema("medicore").from("staff").select("id, name").eq("role", "doctor").order("name"),
        supabase.schema("medicore").from("medicines").select("id, name, category, stock, unit, price").order("name"),
      ]);
      if (conRes.error) throw conRes.error;
      setConsultations((conRes.data as unknown as Consultation[]) ?? []);
      setPatients((patRes.data as OptionItem[]) ?? []);
      setDoctors((docRes.data as OptionItem[]) ?? []);
      setMedicines((medRes.data as Medicine[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Consultations] load error:", e);
      setError("Failed to load. Run consultation-upgrade.sql + check RLS.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel("medicore-consultations")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "consultations" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return consultations.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || patientName(c).toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || doctorName(c).toLowerCase().includes(q) || (c.diagnosis ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || (statusFilter === "Diagnosed" && !!c.diagnosis) || (statusFilter === "Pending" && !c.diagnosis);
      return matchesSearch && matchesStatus;
    });
  }, [consultations, search, statusFilter]);

  const stats = useMemo(() => ({
    total: consultations.length,
    today: consultations.filter((c) => c.visit_date.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    withDiagnosis: consultations.filter((c) => c.diagnosis).length,
    pending: consultations.filter((c) => !c.diagnosis).length,
  }), [consultations]);

  const trendData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const iso = d.toISOString().split("T")[0];
      days.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), count: consultations.filter((c) => c.visit_date.slice(0, 10) === iso).length });
    }
    return days;
  }, [consultations]);

  /* ---------------- PATIENT SAFETY SUMMARY ---------------- */
  const onPatientSelect = async (pid: string) => {
    setForm({ ...form, patient_id: pid });
    if (!pid) { setPatientDetail(null); return; }
    try {
      const { data } = await supabase.schema("medicore").from("patients").select("allergies, conditions, blood_type").eq("id", pid).maybeSingle();
      setPatientDetail(data as { allergies?: string; conditions?: string; blood_type?: string } | null);
    } catch { setPatientDetail(null); }
  };

  /* ---------------- SYMPTOMS ---------------- */
  const addSymptom = (value?: string) => {
    const v = (value ?? symptomInput).trim();
    if (v && !symptoms.includes(v)) { setSymptoms([...symptoms, v]); setSymptomInput(""); }
  };

  /* ---------------- PRESCRIPTION BUILDER ---------------- */
  const addRx = () => {
    if (medicines.length === 0) return;
    const m = medicines[0];
    setRxDrafts([...rxDrafts, { medicine_id: m.id, medicine_name: m.name, dosage: "1 tablet", frequency: FREQUENCIES[1], duration: 5, quantity: 10, unit: m.unit, unit_price: m.price, instructions: "" }]);
  };

  const updateRx = (i: number, patch: Partial<RxDraft>) => {
    setRxDrafts(rxDrafts.map((r, idx) => {
      if (idx !== i) return r;
      const updated = { ...r, ...patch };
      if (patch.medicine_id) {
        const m = medicines.find((x) => x.id === patch.medicine_id);
        if (m) { updated.medicine_name = m.name; updated.unit = m.unit; updated.unit_price = m.price; }
      }
      if (patch.frequency || patch.duration) {
        const freqMap: Record<string, number> = { "OD": 1, "BID": 2, "TDS": 3, "QID": 4, "PRN": 2, "STAT": 1 };
        const freq = updated.frequency.split(" ")[0];
        const perDay = freqMap[freq] ?? 1;
        updated.quantity = perDay * updated.duration;
      }
      return updated;
    }));
  };

  const removeRx = (i: number) => setRxDrafts(rxDrafts.filter((_, idx) => idx !== i));

  // Allergy check for prescriptions
  const allergyWarnings = useMemo(() => {
    if (!patientDetail?.allergies) return [];
    const allergyText = patientDetail.allergies.toLowerCase();
    return rxDrafts.filter((rx) => allergyText.includes(rx.medicine_name.toLowerCase().split(" ")[0])).map((rx) => rx.medicine_name);
  }, [rxDrafts, patientDetail]);

  /* ---------------- LAB REQUESTS ---------------- */
  const LAB_OPTIONS = ["Full Blood Count", "Malaria RDT", "Urinalysis", "Blood Glucose", "Lipid Profile", "COVID PCR", "Pregnancy Test", "Liver Function", "Renal Function"];
  const toggleLab = (test: string) => {
    setLabRequests(labRequests.includes(test) ? labRequests.filter((t) => t !== test) : [...labRequests, test]);
  };

  /* ---------------- SUBMIT ---------------- */
  const openForm = () => {
    setForm({ ...emptyForm, doctor_id: profile?.id || "" });
    setSymptoms([]); setSymptomInput(""); setRxDrafts([]); setLabRequests([]); setPatientDetail(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.patient_id) { showToast("error", "Select a patient."); return; }
    setSaving(true);
    try {
      const id = `CON-${String(stats.total + 1).padStart(4, "0")}`;
      const diagMatch = COMMON_DIAGNOSES.find((d) => d.label === form.diagnosis);
      const followUp = form.follow_up_days ? new Date(Date.now() + Number(form.follow_up_days) * 86400000).toISOString().split("T")[0] : null;

      const payload = {
        id, patient_id: form.patient_id, doctor_id: form.doctor_id || null,
        chief_complaint: form.chief_complaint.trim() || null,
        hpi: form.hpi.trim() || null,
        symptoms: symptoms.length ? JSON.stringify(symptoms) : null,
        objective_exam: form.objective_exam.trim() || null,
        assessment: form.assessment.trim() || null,
        plan_notes: form.plan_notes.trim() || null,
        diagnosis: form.diagnosis.trim() || null,
        icd10_code: diagMatch?.icd10 || null,
        bp: form.bp.trim() || null, temperature: form.temperature.trim() || null,
        pulse: form.pulse.trim() || null, weight: form.weight.trim() || null,
        notes: form.notes.trim() || null,
        follow_up_date: followUp,
      };

      const { error: conErr } = await supabase.schema("medicore").from("consultations").insert(payload);
      if (conErr) throw conErr;

      // 1. Create prescriptions
      if (rxDrafts.length > 0) {
        const rxId = `RX-${Date.now().toString().slice(-6)}`;
        await supabase.schema("medicore").from("prescriptions").insert({ id: rxId, patient_id: form.patient_id, doctor_id: form.doctor_id || null, consultation_id: id, status: "Pending" });
        await supabase.schema("medicore").from("prescription_items").insert(rxDrafts.map((rx) => ({
          prescription_id: rxId, medicine_id: rx.medicine_id, medicine_name: rx.medicine_name,
          dosage: `${rx.dosage} · ${rx.frequency} · ${rx.duration} days`, quantity: rx.quantity, unit: rx.unit, unit_price: rx.unit_price,
        })));
      }

      // 2. Create lab requests
      if (labRequests.length > 0) {
        await Promise.all(labRequests.map((testType, idx) =>
          supabase.schema("medicore").from("lab_tests").insert({
            id: `LAB-${Date.now().toString().slice(-5)}${idx}`, patient_id: form.patient_id,
            doctor_id: form.doctor_id || null, test_type: testType, status: "Requested",
          })
        ));
      }

      // 3. Auto-bill consultation fee
      try {
        const invId = `INV-${Date.now().toString().slice(-6)}`;
        await supabase.schema("medicore").from("invoices").insert({ id: invId, patient_id: form.patient_id, status: "Pending", total_amount: 0, due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] });
        await supabase.schema("medicore").from("invoice_items").insert({ invoice_id: invId, service: "Consultation Fee", amount: 1500 });
      } catch (e) { console.error("[Consult] auto-bill error:", e); }

      const parts = [`Consultation ${id} saved.`];
      if (rxDrafts.length) parts.push(`${rxDrafts.length} Rx → Pharmacy`);
      if (labRequests.length) parts.push(`${labRequests.length} labs → Lab`);
      parts.push("KES 1,500 billed");
      showToast("success", parts.join(" · "));

      setFormOpen(false);
      await load();
    } catch (e) {
      console.error("[Consultations] save error:", e);
      showToast("error", "Could not save consultation.");
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
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"><Stethoscope className="h-3.5 w-3.5" /> Clinical Documentation</div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Consultations</h1>
            <p className="mt-1 text-sm text-blue-50/90">SOAP Notes · Smart Rx · Vitals Alerts · Auto-billing{profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}</p>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={openForm} className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"><Plus className="h-4 w-4" /> New Consultation</motion.button>
        </div>
      </motion.div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={ClipboardList} gradient="from-[#1E88E5] to-[#64B5F6]" delta="Records" />
        <StatCard label="Today" value={stats.today} icon={CalendarClock} gradient="from-[#2ECC71] to-[#58D68D]" delta="New today" />
        <StatCard label="Diagnosed" value={stats.withDiagnosis} icon={CheckCircle2} gradient="from-violet-500 to-purple-600" delta="Assessed" />
        <StatCard label="Pending" value={stats.pending} icon={AlertTriangle} gradient="from-[#F1C40F] to-[#F39C12]" delta="Awaiting Dx" />
      </div>

      {/* TREND */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="mb-4"><h3 className="flex items-center gap-2 text-base font-semibold"><Activity className="h-4 w-4 text-[#1E88E5]" /><span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Consultations Trend</span></h3><p className="text-sm text-slate-500">Last 7 days</p></div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
            <defs><linearGradient id="conGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} /><stop offset="95%" stopColor="#1E88E5" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Area type="monotone" dataKey="count" name="Consultations" stroke="#1E88E5" strokeWidth={2.5} fill="url(#conGrad)" dot={{ r: 3, fill: "#1E88E5" }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md lg:w-80"><Search className="h-4 w-4 text-[#1E88E5]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, doctor, diagnosis..." className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />{search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}</div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">{(["All", "Diagnosed", "Pending"] as const).map((s) => <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${statusFilter === s ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{s}</button>)}</div>
        </div>
      </div>

      {/* LIST */}
      {loading ? <div className="flex h-64 items-center justify-center rounded-3xl border border-white/60 bg-white/70 backdrop-blur-md"><Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" /></div>
      : filtered.length === 0 ? <EmptyState icon={<Stethoscope className="h-8 w-8" />} title="No consultations found" cta={{ label: "New Consultation", onClick: openForm }} />
      : <div className="space-y-3">
          {filtered.map((c, i) => {
            const sym = parseSymptoms(c.symptoms); const hasDx = !!c.diagnosis;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -2 }} className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:shadow-xl">
                <div className={`absolute left-0 top-0 h-full w-1.5 ${hasDx ? "bg-[#2ECC71]" : "bg-[#F1C40F]"}`} />
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{patientName(c)}</h3>
                      <span className="text-xs text-slate-400">{c.id}</span>
                      {c.patients?.blood_type && <span className="inline-flex items-center gap-1 rounded-lg bg-[#E74C3C]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#C0392B]">{c.patients.blood_type}</span>}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${hasDx ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40"}`}>{hasDx ? "Diagnosed" : "Pending"}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><User className="h-3.5 w-3.5" /> {patientMeta(c)} · <Stethoscope className="h-3.5 w-3.5" /> {doctorName(c)} · {fmtDateTime(c.visit_date)}</p>
                    {c.chief_complaint && <p className="mt-2 text-sm font-medium text-slate-700">CC: {c.chief_complaint}</p>}
                    {c.diagnosis && <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><ClipboardList className="h-4 w-4 text-[#1E88E5]" /> {c.diagnosis}{c.icd10_code && <span className="text-xs font-normal text-slate-400">({c.icd10_code})</span>}</p>}
                    {sym.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{sym.slice(0, 5).map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-[#F1C40F]/15 px-2 py-0.5 text-[11px] font-medium text-[#B8860B] ring-1 ring-inset ring-[#F1C40F]/30"><Tag className="h-2.5 w-2.5" /> {s}</span>)}{sym.length > 5 && <span className="text-[11px] text-slate-400">+{sym.length - 5}</span>}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">{c.bp && <VitalChip icon={HeartPulse} value={c.bp} tone="text-[#E74C3C]" flag={interpretBP(c.bp)} />}{c.temperature && <VitalChip icon={Thermometer} value={`${c.temperature}°`} tone="text-[#F1C40F]" flag={interpretTemp(c.temperature)} />}{c.pulse && <VitalChip icon={Activity} value={c.pulse} tone="text-[#1E88E5]" flag={interpretPulse(c.pulse)} />}</div>
                    <button onClick={() => setViewing(c)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E88E5]/10 px-4 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20"><Eye className="h-3.5 w-3.5" /> View Details <ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>}

      {/* ---------------- NEW CONSULTATION MODAL (SOAP) ---------------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New Consultation" subtitle="SOAP Clinical Documentation" icon={<Stethoscope className="h-5 w-5" />} size="lg">
        <div className="space-y-5">
          {/* PATIENT + SAFETY SUMMARY */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Patient" required>
                <select className={inputCls} value={form.patient_id} onChange={(e) => onPatientSelect(e.target.value)}>
                  <option value="">Select patient...</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                </select>
              </Field>
              <Field label="Attending Doctor">
                <select className={inputCls} value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                  <option value="">Select doctor...</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            {patientDetail && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap items-center gap-2">
                {patientDetail.allergies && <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#E74C3C]/30 bg-[#E74C3C]/10 px-3 py-1.5 text-xs font-semibold text-[#C0392B]"><ShieldAlert className="h-3.5 w-3.5" /> Allergies: {patientDetail.allergies}</span>}
                {patientDetail.conditions && <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#F1C40F]/30 bg-[#F1C40F]/10 px-3 py-1.5 text-xs font-semibold text-[#B8860B]"><Activity className="h-3.5 w-3.5" /> Conditions: {patientDetail.conditions}</span>}
                {patientDetail.blood_type && <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Blood: {patientDetail.blood_type}</span>}
              </motion.div>
            )}
          </div>

          {/* SOAP: SUBJECTIVE */}
          <SoapSection title="S — Subjective" icon={<User className="h-4 w-4 text-[#1E88E5]" />}>
            <Field label="Chief Complaint (CC)">
              <input className={inputCls} value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} placeholder="e.g. Fever and headache for 3 days" />
            </Field>
            <Field label="History of Present Illness (HPI)">
              <textarea className={`${inputCls} min-h-[60px] resize-y`} value={form.hpi} onChange={(e) => setForm({ ...form, hpi: e.target.value })} placeholder="Onset, duration, severity, aggravating/relieving factors..." />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">Symptoms</p>
              <div className="flex gap-2"><input className={inputCls} value={symptomInput} onChange={(e) => setSymptomInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSymptom(); } }} placeholder="Type symptom + Enter" /><button onClick={() => addSymptom()} className="rounded-xl bg-[#F4F6F8] px-4 text-slate-600 hover:bg-slate-200"><Plus className="h-4 w-4" /></button></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{COMMON_SYMPTOMS.map((s) => <button key={s} onClick={() => addSymptom(s)} disabled={symptoms.includes(s)} className="rounded-lg bg-[#F4F6F8] px-2 py-1 text-[11px] text-slate-500 hover:bg-[#1E88E5]/10 hover:text-[#1E88E5] disabled:opacity-30">+ {s}</button>)}</div>
              {symptoms.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{symptoms.map((s) => <button key={s} onClick={() => setSymptoms(symptoms.filter((x) => x !== s))} className="inline-flex items-center gap-1 rounded-full bg-[#F1C40F]/15 px-3 py-1 text-xs font-medium text-[#B8860B] ring-1 ring-inset ring-[#F1C40F]/30">{s} <X className="h-3 w-3" /></button>)}</div>}
            </div>
          </SoapSection>

          {/* SOAP: OBJECTIVE */}
          <SoapSection title="O — Objective" icon={<Activity className="h-4 w-4 text-[#F1C40F]" />}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([["bp", "BP (mmHg)", "120/80", HeartPulse, "text-[#E74C3C]"], ["temperature", "Temp (°C)", "36.8", Thermometer, "text-[#F1C40F]"], ["pulse", "Pulse (bpm)", "72", Activity, "text-[#1E88E5]"], ["weight", "Weight (kg)", "70", Weight, "text-[#2ECC71]"]] as const).map(([key, label, ph, Icon, tone]) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">{label}</label>
                  <div className="relative">
                    <Icon className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${tone}`} />
                    <input className={`${inputCls} pl-9`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} />
                  </div>
                  {form[key] && key === "bp" && interpretBP(form[key]) && <VitalTag flag={interpretBP(form[key])!} />}
                  {form[key] && key === "temperature" && interpretTemp(form[key]) && <VitalTag flag={interpretTemp(form[key])!} />}
                  {form[key] && key === "pulse" && interpretPulse(form[key]) && <VitalTag flag={interpretPulse(form[key])!} />}
                </div>
              ))}
            </div>
            <Field label="Physical Examination Findings">
              <textarea className={`${inputCls} min-h-[50px] resize-y`} value={form.objective_exam} onChange={(e) => setForm({ ...form, objective_exam: e.target.value })} placeholder="General, CVS, RS, Abdomen, CNS findings..." />
            </Field>
          </SoapSection>

          {/* SOAP: ASSESSMENT */}
          <SoapSection title="A — Assessment" icon={<ClipboardList className="h-4 w-4 text-[#2ECC71]" />}>
            <Field label="Diagnosis">
              <input className={inputCls} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} list="diagnoses" placeholder="Select or type diagnosis" />
              <datalist id="diagnoses">{COMMON_DIAGNOSES.map((d) => <option key={d.icd10} value={d.label}>{d.icd10}</option>)}</datalist>
            </Field>
            <Field label="Differential / Assessment Notes">
              <input className={inputCls} value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} placeholder="Differential diagnosis, clinical reasoning..." />
            </Field>
          </SoapSection>

          {/* SOAP: PLAN */}
          <SoapSection title="P — Plan" icon={<FileText className="h-4 w-4 text-[#1E88E5]" />}>
            {/* PRESCRIPTION BUILDER */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Prescription</span>
                <button onClick={addRx} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:underline"><Plus className="h-3.5 w-3.5" /> Add medicine</button>
              </div>
              {rxDrafts.length === 0 ? <p className="rounded-xl bg-[#F4F6F8] p-3 text-center text-xs text-slate-400">No medicines prescribed</p> : (
                <div className="space-y-2">
                  {rxDrafts.map((rx, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select className={`${inputCls} flex-1 py-2`} value={rx.medicine_id} onChange={(e) => updateRx(i, { medicine_id: e.target.value })}>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stock} {m.unit})</option>)}</select>
                        <button onClick={() => removeRx(i)} className="rounded-lg p-2 text-slate-400 hover:bg-[#E74C3C]/10 hover:text-[#C0392B]"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input className={`${inputCls} py-2`} value={rx.dosage} onChange={(e) => updateRx(i, { dosage: e.target.value })} placeholder="1 tab" />
                        <select className={`${inputCls} py-2`} value={rx.frequency} onChange={(e) => updateRx(i, { frequency: e.target.value })}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select>
                        <select className={`${inputCls} py-2`} value={rx.duration} onChange={(e) => updateRx(i, { duration: Number(e.target.value) })}>{DURATIONS.map((d) => <option key={d} value={d}>{d} days</option>)}</select>
                      </div>
                      <p className="text-right text-xs font-semibold text-[#1E88E5]">Qty: {rx.quantity} {rx.unit} · {fmtKES(rx.quantity * rx.unit_price)}</p>
                    </div>
                  ))}
                </div>
              )}
              {allergyWarnings.length > 0 && <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#E74C3C]/30 bg-[#E74C3C]/10 p-2 text-xs font-semibold text-[#C0392B]"><ShieldAlert className="h-4 w-4" /> Allergy conflict: {allergyWarnings.join(", ")}</div>}
            </div>

            {/* LAB REQUESTS */}
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-slate-600">Lab Requests</span></div>
              <div className="flex flex-wrap gap-1.5">{LAB_OPTIONS.map((t) => <button key={t} onClick={() => toggleLab(t)} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${labRequests.includes(t) ? "bg-[#1E88E5] text-white" : "bg-[#F4F6F8] text-slate-500 hover:bg-[#1E88E5]/10 hover:text-[#1E88E5]"}`}>{labRequests.includes(t) ? "✓ " : "+ "}{t}</button>)}</div>
            </div>

            <Field label="Plan / Follow-up Notes">
              <textarea className={`${inputCls} min-h-[50px] resize-y`} value={form.plan_notes} onChange={(e) => setForm({ ...form, plan_notes: e.target.value })} placeholder="Treatment plan, advice, return precautions..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Follow-up (days)"><input type="number" className={inputCls} value={form.follow_up_days} onChange={(e) => setForm({ ...form, follow_up_days: e.target.value })} placeholder="7" /></Field>
              <div className="flex items-end"><div className="w-full rounded-xl bg-[#2ECC71]/5 p-2.5 text-center text-xs text-[#1E8C4A]">💰 Consultation fee: KES 1,500 will be auto-billed</div></div>
            </div>
          </SoapSection>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
            <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:opacity-90 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save & Complete</button>
          </div>
        </div>
      </Modal>

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Consultation Record" subtitle={viewing?.id} icon={<FileText className="h-5 w-5" />} size="lg">
        {viewing && (() => {
          const sym = parseSymptoms(viewing.symptoms);
          return (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><User className="h-6 w-6" /></div>
                  <div><h3 className="text-lg font-bold text-slate-900">{patientName(viewing)}</h3><p className="text-sm text-slate-500">{patientMeta(viewing)}{viewing.patients?.blood_type ? ` · ${viewing.patients.blood_type}` : ""}</p></div>
                </div>
                <div className="text-left sm:text-right"><p className="text-xs text-slate-400">Doctor</p><p className="text-sm font-semibold text-slate-700">{doctorName(viewing)}</p><p className="mt-1 text-xs text-slate-400">{fmtDateTime(viewing.visit_date)}</p></div>
              </div>

              {/* SAFETY BANNER */}
              {(viewing.patients?.allergies || viewing.patients?.conditions) && (
                <div className="flex flex-wrap gap-2">
                  {viewing.patients?.allergies && <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#E74C3C]/30 bg-[#E74C3C]/10 px-3 py-1.5 text-xs font-semibold text-[#C0392B]"><ShieldAlert className="h-3.5 w-3.5" /> Allergies: {viewing.patients.allergies}</span>}
                  {viewing.patients?.conditions && <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#F1C40F]/30 bg-[#F1C40F]/10 px-3 py-1.5 text-xs font-semibold text-[#B8860B]">Conditions: {viewing.patients.conditions}</span>}
                </div>
              )}

              {/* VITALS */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <VitalBox icon={HeartPulse} label="BP" value={viewing.bp} tone="text-[#E74C3C]" flag={viewing.bp ? interpretBP(viewing.bp) : null} />
                <VitalBox icon={Thermometer} label="Temp" value={viewing.temperature} suffix="°C" tone="text-[#F1C40F]" flag={viewing.temperature ? interpretTemp(viewing.temperature) : null} />
                <VitalBox icon={Activity} label="Pulse" value={viewing.pulse} suffix=" bpm" tone="text-[#1E88E5]" flag={viewing.pulse ? interpretPulse(viewing.pulse) : null} />
                <VitalBox icon={Weight} label="Weight" value={viewing.weight} suffix=" kg" tone="text-[#2ECC71]" />
              </div>

              {/* SOAP DISPLAY */}
              {viewing.chief_complaint && <SoapDisplay title="Chief Complaint" content={viewing.chief_complaint} />}
              {viewing.hpi && <SoapDisplay title="History of Present Illness" content={viewing.hpi} />}
              {sym.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-slate-600">Symptoms</p><div className="flex flex-wrap gap-1.5">{sym.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-[#F1C40F]/15 px-2 py-0.5 text-xs font-medium text-[#B8860B]"><Tag className="h-3 w-3" /> {s}</span>)}</div></div>}
              {viewing.objective_exam && <SoapDisplay title="Physical Examination" content={viewing.objective_exam} />}
              {viewing.diagnosis && <SoapDisplay title="Diagnosis" content={`${viewing.diagnosis}${viewing.icd10_code ? ` (${viewing.icd10_code})` : ""}`} />}
              {viewing.assessment && <SoapDisplay title="Assessment" content={viewing.assessment} />}
              {viewing.plan_notes && <SoapDisplay title="Plan" content={viewing.plan_notes} />}
              {viewing.follow_up_date && <div className="rounded-xl bg-[#1E88E5]/5 p-3 text-sm font-medium text-[#1E88E5]">📅 Follow-up: {fmtDate(viewing.follow_up_date)}</div>}
              {viewing.notes && <SoapDisplay title="Additional Notes" content={viewing.notes} />}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Close</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* TOAST */}
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 30, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 30, x: "-50%" }} className={`fixed bottom-24 left-1/2 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl lg:bottom-6 ${toast.type === "success" ? "bg-[#2ECC71]" : toast.type === "error" ? "bg-[#E74C3C]" : "bg-[#1E88E5]"}`}>{toast.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : toast.type === "error" ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}{toast.message}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function StatCard({ label, value, icon: Icon, gradient, delta }: { label: string; value: number; icon: typeof ClipboardList; gradient: string; delta: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => { const c = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) }); return () => c.stop(); }, [value]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className="relative flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-2xl font-bold tracking-tight text-transparent`}>{display.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{delta}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div></div>
    </motion.div>
  );
}

function SoapSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <div className="mb-3 flex items-center gap-2">{icon}<h4 className="text-sm font-semibold text-slate-700">{title}</h4></div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SoapDisplay({ title, content }: { title: string; content: string }) {
  return <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-400">{title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{content}</p></div>;
}

function VitalChip({ icon: Icon, value, tone, flag }: { icon: typeof Activity; value: string; tone: string; flag: VitalFlag | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className={`text-xs font-semibold ${flag?.level === "critical" ? "text-[#C0392B]" : flag?.level === "warning" ? "text-[#B8860B]" : "text-slate-600"}`}>{value}</span>
      {flag && flag.level !== "normal" && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: flag.color }} />}
    </div>
  );
}

function VitalTag({ flag }: { flag: VitalFlag }) {
  return <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold" style={{ color: flag.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: flag.color }} />{flag.label}</p>;
}

function VitalBox({ icon: Icon, label, value, suffix, tone, flag }: { icon: typeof Activity; label: string; value: string | null; suffix?: string; tone: string; flag?: VitalFlag | null }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${flag?.level === "critical" ? "border-[#E74C3C]/30 bg-[#E74C3C]/5" : flag?.level === "warning" ? "border-[#F1C40F]/30 bg-[#F1C40F]/5" : "border-slate-100"}`}>
      <Icon className={`mx-auto h-5 w-5 ${tone}`} />
      <p className="mt-1 text-sm font-bold text-slate-800">{value ? `${value}${suffix ?? ""}` : "—"}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
      {flag && flag.level !== "normal" && <p className="mt-1 text-[10px] font-semibold" style={{ color: flag.color }}>{flag.label}</p>}
    </div>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return <label className={`block ${className ?? ""}`}><span className="mb-1.5 block text-xs font-medium text-slate-600">{label}{required && <span className="text-[#E74C3C]"> *</span>}</span>{children}</label>;
}

function EmptyState({ icon, title, cta }: { icon: React.ReactNode; title: string; cta?: { label: string; onClick: () => void } }) {
  return <div className="flex flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/70 py-16 text-center backdrop-blur-md"><div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">{icon}</div><p className="font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-400">Adjust filters or start a new consultation.</p>{cta && <button onClick={cta.onClick} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"><Plus className="h-4 w-4" /> {cta.label}</button>}</div>;
}

function Modal({ open, onClose, title, subtitle, icon, size = "md", children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: React.ReactNode; size?: "md" | "lg"; children: React.ReactNode }) {
  return <AnimatePresence>{open && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.25 }} className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${size === "lg" ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">{icon && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">{icon}</div>}<div><h3 className="text-lg font-semibold text-slate-900">{title}</h3>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </div>
  )}</AnimatePresence>;
}
