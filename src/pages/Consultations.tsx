import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Stethoscope,
  Plus,
  Search,
  X,
  Eye,
  Loader2,
  Thermometer,
  Activity,
  HeartPulse,
  Weight,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  FileText,
  User,
  Tag,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string;
  symptoms: string | null;
  diagnosis: string | null;
  bp: string | null;
  temperature: string | null;
  pulse: string | null;
  weight: string | null;
  notes: string | null;
  visit_date: string;
  patients?: { name: string; age?: number; gender?: string }[] | null;
  staff?: { name: string }[] | null;
}

interface OptionItem {
  id: string;
  name: string;
}

interface FormState {
  patient_id: string;
  doctor_id: string;
  bp: string;
  temperature: string;
  pulse: string;
  weight: string;
  diagnosis: string;
  notes: string;
}

/* ============================ THEME ============================ */

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

const VITAL_FIELDS: { key: keyof FormState; label: string; icon: typeof Activity; placeholder: string; tone: string }[] = [
  { key: "bp", label: "Blood Pressure", icon: HeartPulse, placeholder: "120/80", tone: "text-[#E74C3C]" },
  { key: "temperature", label: "Temperature (°C)", icon: Thermometer, placeholder: "36.8", tone: "text-[#F1C40F]" },
  { key: "pulse", label: "Pulse (bpm)", icon: Activity, placeholder: "72", tone: "text-[#1E88E5]" },
  { key: "weight", label: "Weight (kg)", icon: Weight, placeholder: "70", tone: "text-[#2ECC71]" },
];

const COMMON_SYMPTOMS = [
  "Fever", "Headache", "Cough", "Fatigue", "Nausea",
  "Chest pain", "Shortness of breath", "Dizziness", "Abdominal pain", "Vomiting",
];

/* ============================ HELPERS ============================ */

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const parseSymptoms = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch {
    /* fall through */
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

const patientName = (c: Consultation) => c.patients?.[0]?.name ?? "Unknown";
const patientMeta = (c: Consultation) => {
  const p = c.patients?.[0];
  return p ? `${p.age ?? "—"} yrs · ${p.gender ?? "—"}` : "—";
};
const doctorName = (c: Consultation) => c.staff?.[0]?.name ?? "—";

const emptyForm: FormState = {
  patient_id: "",
  doctor_id: "",
  bp: "",
  temperature: "",
  pulse: "",
  weight: "",
  diagnosis: "",
  notes: "",
};

/* ============================ COMPONENT ============================ */

export default function Consultations() {
  const { profile } = useAuth();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<OptionItem[]>([]);
  const [doctors, setDoctors] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "With Diagnosis" | "Pending Review">("All");

  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Consultation | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
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
        .from("consultations")
        .select("id, patient_id, doctor_id, symptoms, diagnosis, bp, temperature, pulse, weight, notes, visit_date, patients(name, age, gender), staff(name)")
        .order("visit_date", { ascending: false });
      if (err) throw err;
      setConsultations((data as Consultation[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Consultations] load error:", e);
      setError("Failed to load consultations. Check schema exposure + RLS.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([
        supabase.schema("medicore").from("patients").select("id, name").order("name"),
        supabase.schema("medicore").from("staff").select("id, name").eq("role", "doctor").order("name"),
      ]);
      setPatients((pRes.data as OptionItem[]) ?? []);
      setDoctors((dRes.data as OptionItem[]) ?? []);
    } catch (e) {
      console.error("[Consultations] options error:", e);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel("medicore-consultations")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "consultations" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return consultations.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q || patientName(c).toLowerCase().includes(q) || c.id.toLowerCase().includes(q) ||
        doctorName(c).toLowerCase().includes(q) || (c.diagnosis ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "With Diagnosis" && !!c.diagnosis) ||
        (statusFilter === "Pending Review" && !c.diagnosis);
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
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: consultations.filter((c) => c.visit_date.slice(0, 10) === iso).length,
      });
    }
    return days;
  }, [consultations]);

  /* ---------------- FORM ---------------- */
  const openForm = () => {
    setForm({ ...emptyForm, doctor_id: profile?.id || "" });
    setSymptoms([]);
    setSymptomInput("");
    setFormOpen(true);
  };

  const addSymptom = (value?: string) => {
    const v = (value ?? symptomInput).trim();
    if (v && !symptoms.includes(v)) {
      setSymptoms([...symptoms, v]);
      setSymptomInput("");
    }
  };

  const submit = async () => {
    if (!form.patient_id) {
      showToast("error", "Please select a patient.");
      return;
    }
    setSaving(true);
    try {
      const id = `CON-${String(stats.total + 1).padStart(4, "0")}`;
      const payload = {
        id,
        patient_id: form.patient_id,
        doctor_id: form.doctor_id || null,
        symptoms: symptoms.length ? JSON.stringify(symptoms) : null,
        diagnosis: form.diagnosis.trim() || null,
        bp: form.bp.trim() || null,
        temperature: form.temperature.trim() || null,
        pulse: form.pulse.trim() || null,
        weight: form.weight.trim() || null,
        notes: form.notes.trim() || null,
      };
      const { error: e } = await supabase.schema("medicore").from("consultations").insert(payload);
      if (e) throw e;
      showToast("success", `Consultation ${id} recorded successfully.`);
      setFormOpen(false);
      await load();
    } catch (e) {
      console.error("[Consultations] save error:", e);
      showToast("error", "Could not save consultation.");
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
              <Stethoscope className="h-3.5 w-3.5" /> Consultations
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Clinical Records</h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Record consultations, vitals, symptoms &amp; diagnoses
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={openForm}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" /> New Consultation
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
        <StatCard label="Total" value={stats.total} icon={ClipboardList} gradient="from-[#1E88E5] to-[#64B5F6]" delta="Records" />
        <StatCard label="Today" value={stats.today} icon={CalendarClock} gradient="from-[#2ECC71] to-[#58D68D]" delta="New today" />
        <StatCard label="Diagnosed" value={stats.withDiagnosis} icon={CheckCircle2} gradient="from-violet-500 to-purple-600" delta="With diagnosis" />
        <StatCard label="Pending" value={stats.pending} icon={AlertTriangle} gradient="from-[#F1C40F] to-[#F39C12]" delta="Awaiting review" />
      </div>

      {/* CHART */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
      >
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Activity className="h-4 w-4 text-[#1E88E5]" /> Consultations Trend
          </h3>
          <p className="text-sm text-slate-500">Last 7 days</p>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="conGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#1E88E5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Area type="monotone" dataKey="count" name="Consultations" stroke="#1E88E5" strokeWidth={2.5} fill="url(#conGrad)" dot={{ r: 3, fill: "#1E88E5" }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-3.5 py-2.5 lg:w-80">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, ID, doctor, diagnosis..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <FilterPills options={["All", "With Diagnosis", "Pending Review"]} value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)} />
        </div>
        <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {consultations.length} consultations</p>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/70 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Stethoscope className="h-8 w-8" />} title="No consultations found" cta={{ label: "New Consultation", onClick: openForm }} />
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => {
            const sym = parseSymptoms(c.symptoms);
            const hasDiagnosis = !!c.diagnosis;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className={`absolute left-0 top-0 h-full w-1.5 ${hasDiagnosis ? "bg-[#2ECC71]" : "bg-[#F1C40F]"}`} />
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{patientName(c)}</h3>
                      <span className="text-xs text-slate-400">{c.id}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${hasDiagnosis ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40"}`}>
                        {hasDiagnosis ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {hasDiagnosis ? "Diagnosed" : "Pending"}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <User className="h-3.5 w-3.5" /> {patientMeta(c)} · <Stethoscope className="h-3.5 w-3.5" /> {doctorName(c)}
                    </p>
                    {c.diagnosis && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <ClipboardList className="h-4 w-4 text-[#1E88E5]" /> {c.diagnosis}
                      </p>
                    )}
                    {sym.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sym.slice(0, 4).map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-[#F1C40F]/15 px-2 py-0.5 text-[11px] font-medium text-[#B8860B] ring-1 ring-inset ring-[#F1C40F]/30">
                            <Tag className="h-2.5 w-2.5" /> {s}
                          </span>
                        ))}
                        {sym.length > 4 && <span className="text-[11px] text-slate-400">+{sym.length - 4}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-5 lg:flex-col lg:items-end">
                    <div className="flex items-center gap-3">
                      {c.bp && <VitalChip icon={HeartPulse} value={c.bp} tone="text-[#E74C3C]" />}
                      {c.temperature && <VitalChip icon={Thermometer} value={`${c.temperature}°`} tone="text-[#F1C40F]" />}
                      {c.pulse && <VitalChip icon={Activity} value={c.pulse} tone="text-[#1E88E5]" />}
                    </div>
                    <button onClick={() => setViewing(c)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E88E5]/10 px-4 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20">
                      <Eye className="h-3.5 w-3.5" /> View <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---------------- NEW CONSULTATION MODAL ---------------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New Consultation" subtitle="Record vitals, symptoms & diagnosis" icon={<Stethoscope className="h-5 w-5" />} size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Patient" required>
              <select className={inputCls} value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Select patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </Field>
            <Field label="Doctor">
              <select className={inputCls} value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">Select doctor...</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Activity className="h-4 w-4 text-[#1E88E5]" /> Vital Signs
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {VITAL_FIELDS.map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.key}>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">{v.label}</label>
                    <div className="relative">
                      <Icon className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${v.tone}`} />
                      <input className={`${inputCls} pl-9`} value={form[v.key]} onChange={(e) => setForm({ ...form, [v.key]: e.target.value })} placeholder={v.placeholder} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Thermometer className="h-4 w-4 text-[#F1C40F]" /> Symptoms
            </p>
            <div className="flex gap-2">
              <input className={inputCls} value={symptomInput} onChange={(e) => setSymptomInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSymptom(); } }} placeholder="Type a symptom and press Enter" />
              <button onClick={() => addSymptom()} className="rounded-xl bg-[#F4F6F8] px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_SYMPTOMS.map((s) => (
                <button key={s} onClick={() => addSymptom(s)} disabled={symptoms.includes(s)} className="rounded-lg bg-[#F4F6F8] px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-[#1E88E5]/10 hover:text-[#1E88E5] disabled:opacity-40">
                  + {s}
                </button>
              ))}
            </div>
            {symptoms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {symptoms.map((s) => (
                  <button key={s} onClick={() => setSymptoms(symptoms.filter((x) => x !== s))} className="inline-flex items-center gap-1 rounded-full bg-[#F1C40F]/15 px-3 py-1 text-xs font-medium text-[#B8860B] ring-1 ring-inset ring-[#F1C40F]/30 transition hover:bg-[#F1C40F]/25">
                    {s} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <ClipboardList className="h-4 w-4 text-[#2ECC71]" /> Diagnosis &amp; Notes
            </p>
            <div className="space-y-3">
              <Field label="Diagnosis">
                <input className={inputCls} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="e.g. Malaria (P. falciparum)" />
              </Field>
              <Field label="Clinical Notes">
                <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Treatment plan, advice, follow-up..." />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
              Cancel
            </button>
            <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Consultation
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Consultation Record" subtitle={viewing?.id} icon={<FileText className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{patientName(viewing)}</h3>
                  <p className="text-sm text-slate-500">{patientMeta(viewing)}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-400">Doctor</p>
                <p className="text-sm font-semibold text-slate-700">{doctorName(viewing)}</p>
                <p className="mt-1 text-xs text-slate-400">{fmtDateTime(viewing.visit_date)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Vital Signs</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <VitalBox icon={HeartPulse} label="BP" value={viewing.bp} tone="text-[#E74C3C]" />
                <VitalBox icon={Thermometer} label="Temp" value={viewing.temperature ? `${viewing.temperature}°C` : null} tone="text-[#F1C40F]" />
                <VitalBox icon={Activity} label="Pulse" value={viewing.pulse ? `${viewing.pulse} bpm` : null} tone="text-[#1E88E5]" />
                <VitalBox icon={Weight} label="Weight" value={viewing.weight ? `${viewing.weight} kg` : null} tone="text-[#2ECC71]" />
              </div>
            </div>

            {parseSymptoms(viewing.symptoms).length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Thermometer className="h-4 w-4 text-[#F1C40F]" /> Symptoms
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parseSymptoms(viewing.symptoms).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-[#F1C40F]/15 px-2.5 py-1 text-xs font-medium text-[#B8860B] ring-1 ring-inset ring-[#F1C40F]/30">
                      <Tag className="h-3 w-3" /> {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-100 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <ClipboardList className="h-4 w-4 text-[#2ECC71]" /> Diagnosis
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">{viewing.diagnosis || "Not yet diagnosed"}</p>
            </div>

            {viewing.notes && (
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <FileText className="h-4 w-4 text-[#1E88E5]" /> Clinical Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{viewing.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Close
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

function StatCard({ label, value, icon: Icon, gradient, delta }: { label: string; value: number; icon: typeof ClipboardList; gradient: string; delta: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
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

function VitalChip({ icon: Icon, value, tone }: { icon: typeof Activity; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className="text-xs font-semibold text-slate-600">{value}</span>
    </div>
  );
}

function VitalBox({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string | null; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3 text-center">
      <Icon className={`mx-auto h-5 w-5 ${tone}`} />
      <p className="mt-1.5 text-sm font-bold text-slate-800">{value || "—"}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-[#E74C3C]">*</span>}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ icon, title, cta }: { icon: React.ReactNode; title: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white py-16 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
        {icon}
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">Try adjusting your search or record a new consultation.</p>
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
