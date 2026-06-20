import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Droplet,
  ShieldCheck,
  Siren,
  HeartPulse,
  IdCard,
  CalendarClock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Stethoscope,
  FlaskConical,
  Pill,
  Receipt,
  BedDouble,
  Pencil,
  UserPlus,
  Clock,
  Wallet,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ============================ TYPES ============================ */

type Gender = "Male" | "Female" | "Other";
type PatientStatus = "Active" | "Inactive" | "Admitted" | "Discharged";

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  national_id: string | null;
  emergency_contact: string | null;
  address: string | null;
  blood_type: string;
  insurance: string;
  allergies: string | null;
  conditions: string | null;
  status: PatientStatus;
  registered_at: string;
}

interface Consultation {
  id: string;
  symptoms: string | null;
  diagnosis: string | null;
  bp: string | null;
  temperature: string | null;
  pulse: string | null;
  weight: string | null;
  notes: string | null;
  visit_date: string;
  staff?: { name: string }[] | null;
}

interface LabTest {
  id: string;
  test_type: string;
  status: string;
  result: string | null;
  requested_at: string;
  completed_at: string | null;
  staff?: { name: string }[] | null;
}

interface RxItem {
  id: number;
  medicine_name: string;
  dosage: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface Prescription {
  id: string;
  status: string;
  prescribed_at: string;
  dispensed_at: string | null;
  staff?: { name: string }[] | null;
  prescription_items?: RxItem[] | null;
}

interface InvItem {
  id: number;
  service: string;
  amount: number;
}

interface Invoice {
  id: string;
  total_amount: number;
  status: string;
  payment_method: string | null;
  invoice_date: string;
  paid_at: string | null;
  invoice_items?: InvItem[] | null;
}

interface Admission {
  id: string;
  ward: string;
  bed_number: string | null;
  admission_type: string;
  status: string;
  daily_rate: number;
  admitted_at: string;
  discharged_at: string | null;
  notes: string | null;
  staff?: { name: string }[] | null;
}

type Tab = "overview" | "consultations" | "labs" | "prescriptions" | "billing" | "admissions";

/* ============================ HELPERS ============================ */

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const toList = (s: string | null) =>
  (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const parseSymptoms = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.filter((x) => typeof x === "string");
  } catch { /* */ }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtKES = (n: number) => "KES " + Number(n).toLocaleString("en-KE");

const los = (admitted: string, discharged: string | null) =>
  Math.max(0, Math.floor(((discharged ? new Date(discharged).getTime() : Date.now()) - new Date(admitted).getTime()) / 86400000));

const genderGradient = (g: Gender) =>
  g === "Female" ? "from-pink-500 to-rose-500" : g === "Male" ? "from-[#1E88E5] to-[#64B5F6]" : "from-violet-500 to-purple-500";

const STATUS_DOT: Record<PatientStatus, string> = {
  Active: "#2ECC71", Admitted: "#1E88E5", Discharged: "#F1C40F", Inactive: "#94a3b8",
};

/* ============================ ACTIONS ============================ */

const ACTIONS = [
  { label: "Consult", icon: Stethoscope, link: "/consultations", gradient: "from-[#1E88E5] to-[#64B5F6]" },
  { label: "Admit", icon: BedDouble, link: "/addmissions", gradient: "from-[#F1C40F] to-[#F39C12]" },
  { label: "Lab Test", icon: FlaskConical, link: "/lab", gradient: "from-violet-500 to-purple-600" },
  { label: "Invoice", icon: Receipt, link: "/billing", gradient: "from-[#2ECC71] to-[#58D68D]" },
];

const TABS: { key: Tab; label: string; icon: typeof Stethoscope }[] = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "consultations", label: "Consultations", icon: Stethoscope },
  { key: "labs", label: "Lab Results", icon: FlaskConical },
  { key: "prescriptions", label: "Prescriptions", icon: Pill },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "admissions", label: "Admissions", icon: BedDouble },
];

/* ============================ COMPONENT ============================ */

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [labs, setLabs] = useState<LabTest[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const schema = supabase.schema("medicore");
      const [patRes, conRes, labRes, rxRes, invRes, admRes] = await Promise.all([
        schema.from("patients").select("*").eq("id", id).maybeSingle(),
        schema.from("consultations").select("id, symptoms, diagnosis, bp, temperature, pulse, weight, notes, visit_date, staff(name)").eq("patient_id", id).order("visit_date", { ascending: false }),
        schema.from("lab_tests").select("id, test_type, status, result, requested_at, completed_at, staff(name)").eq("patient_id", id).order("requested_at", { ascending: false }),
        schema.from("prescriptions").select("id, status, prescribed_at, dispensed_at, staff(name), prescription_items(id, medicine_name, dosage, quantity, unit, unit_price)").eq("patient_id", id).order("prescribed_at", { ascending: false }),
        schema.from("invoices").select("id, total_amount, status, payment_method, invoice_date, paid_at, invoice_items(id, service, amount)").eq("patient_id", id).order("invoice_date", { ascending: false }),
        schema.from("admissions").select("id, ward, bed_number, admission_type, status, daily_rate, admitted_at, discharged_at, notes, staff(name)").eq("patient_id", id).order("admitted_at", { ascending: false }),
      ]);
      if (patRes.error) throw patRes.error;
      setPatient((patRes.data as Patient) ?? null);
      setConsultations((conRes.data as Consultation[]) ?? []);
      setLabs((labRes.data as LabTest[]) ?? []);
      setPrescriptions((rxRes.data as Prescription[]) ?? []);
      setInvoices((invRes.data as Invoice[]) ?? []);
      setAdmissions((admRes.data as Admission[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[PatientDetail] load error:", e);
      setError("Failed to load patient record. Check schema exposure + RLS.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`patient-${id}`)
      .on("postgres_changes", { event: "*", schema: "medicore", table: "patients", filter: `id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "consultations", filter: `patient_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "lab_tests", filter: `patient_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "prescriptions", filter: `patient_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "invoices", filter: `patient_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "admissions", filter: `patient_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  const derived = useMemo(() => {
    const outstanding = invoices.filter((i) => i.status === "Pending").reduce((s, i) => s + Number(i.total_amount), 0);
    const paid = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + Number(i.total_amount), 0);
    const currentAdmission = admissions.find((a) => a.status === "Admitted");
    const lastConsult = consultations[0];
    return { outstanding, paid, currentAdmission, lastConsult };
  }, [invoices, admissions, consultations]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#EAF4FE]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-4 rounded-2xl bg-gradient-to-b from-white to-[#EAF4FE] p-6">
        <button onClick={() => navigate("/patients")} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E88E5]">
          <ArrowLeft className="h-4 w-4" /> Back to Patients
        </button>
        <div className="rounded-2xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-[#E74C3C]" />
          <p className="font-semibold text-slate-800">{error ?? "Patient not found"}</p>
        </div>
      </div>
    );
  }

  const allergies = toList(patient.allergies);
  const conditions = toList(patient.conditions);
  const hasAlert = allergies.length > 0 || conditions.length > 0;

  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-gradient-to-b from-white via-[#EAF4FE] to-[#F4F6F8] p-4 md:p-6">
      {/* BACK */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/patients")}
        className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/60 px-3 py-2 text-sm font-semibold text-slate-600 backdrop-blur-md transition hover:bg-white"
      >
        <ArrowLeft className="h-4 w-4" /> All Patients
      </motion.button>

      {/* ---------- HERO BANNER ---------- */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[#2ECC71]/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${genderGradient(patient.gender)} text-xl font-bold text-white shadow-lg ring-2 ring-white/30`}>
              {initials(patient.name)}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{patient.name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT[patient.status] }} />{patient.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E74C3C]/20 px-2.5 py-0.5 text-xs font-semibold">
                  <Droplet className="h-3 w-3" /> {patient.blood_type}
                </span>
              </div>
              <p className="text-sm text-blue-50/90">
                {patient.id} · {patient.gender}, {patient.age} yrs · {patient.insurance}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/patients")}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
        </div>

        {/* alert strip */}
        {hasAlert && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            {allergies.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#E74C3C]/20 px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-[#E74C3C]/40">
                <AlertTriangle className="h-3.5 w-3.5" /> Allergies: {allergies.join(", ")}
              </span>
            )}
            {conditions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F1C40F]/20 px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-[#F1C40F]/40">
                <HeartPulse className="h-3.5 w-3.5" /> {conditions.join(", ")}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* ---------- QUICK ACTIONS ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((a, i) => (
          <motion.button
            key={a.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -3 }}
            onClick={() => navigate(a.link)}
            className={`group flex items-center gap-3 rounded-2xl bg-gradient-to-r ${a.gradient} p-4 text-left text-white shadow-lg shadow-slate-200/50 transition`}
          >
            <a.icon className="h-5 w-5" />
            <span className="text-sm font-semibold">{a.label}</span>
            <ArrowRight className="ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100" />
          </motion.button>
        ))}
      </div>

      {/* ---------- QUICK STAT CARDS ---------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat icon={Stethoscope} label="Consultations" value={consultations.length} tone="text-[#1E88E5]" />
        <MiniStat icon={FlaskConical} label="Lab Tests" value={labs.length} tone="text-[#F1C40F]" />
        <MiniStat icon={Wallet} label="Outstanding" value={derived.outstanding} tone="text-[#C0392B]" money />
        <MiniStat icon={CheckCircle2} label="Total Paid" value={derived.paid} tone="text-[#1E8C4A]" money />
      </div>

      {/* ---------- TABS ---------- */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/60 bg-white/70 p-1 backdrop-blur-md">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm"
              style={active ? { color: "#1E88E5" } : { color: "#64748b" }}
            >
              {active && (
                <motion.span layoutId="emr-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------- TAB CONTENT ---------- */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "overview" && (
            <OverviewTab patient={patient} derived={derived} />
          )}
          {tab === "consultations" && <ConsultationsTab consultations={consultations} />}
          {tab === "labs" && <LabsTab labs={labs} />}
          {tab === "prescriptions" && <PrescriptionsTab prescriptions={prescriptions} />}
          {tab === "billing" && <BillingTab invoices={invoices} />}
          {tab === "admissions" && <AdmissionsTab admissions={admissions} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ============================ TABS ============================ */

function OverviewTab({ patient, derived }: { patient: Patient; derived: { lastConsult?: Consultation; currentAdmission?: Admission } }) {
  const last = derived.lastConsult;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Panel title="Demographics" icon={<UserPlus className="h-4 w-4 text-[#1E88E5]" />} className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow icon={Phone} label="Phone" value={patient.phone} />
          <InfoRow icon={IdCard} label="National ID" value={patient.national_id || "—"} />
          <InfoRow icon={MapPin} label="Address" value={patient.address || "—"} />
          <InfoRow icon={ShieldCheck} label="Insurance" value={patient.insurance || "—"} />
          <InfoRow icon={Siren} label="Emergency" value={patient.emergency_contact || "—"} />
          <InfoRow icon={CalendarClock} label="Registered" value={fmtDate(patient.registered_at)} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TagBlock title="Allergies" items={toList(patient.allergies)} tone="red" icon={<AlertTriangle className="h-4 w-4" />} />
          <TagBlock title="Conditions" items={toList(patient.conditions)} tone="blue" icon={<HeartPulse className="h-4 w-4" />} />
        </div>
      </Panel>

      <div className="space-y-5">
        {/* latest vitals */}
        <Panel title="Latest Vitals" icon={<Activity className="h-4 w-4 text-[#2ECC71]" />}>
          {last ? (
            <div className="grid grid-cols-2 gap-3">
              <VitalBox icon={HeartPulse} label="BP" value={last.bp} tone="text-[#E74C3C]" />
              <VitalBox icon={Activity} label="Temp" value={last.temperature ? `${last.temperature}°C` : null} tone="text-[#F1C40F]" />
              <VitalBox icon={TrendingUp} label="Pulse" value={last.pulse ? `${last.pulse} bpm` : null} tone="text-[#1E88E5]" />
              <VitalBox icon={Activity} label="Weight" value={last.weight ? `${last.weight} kg` : null} tone="text-[#2ECC71]" />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-slate-400">No vitals recorded</div>
          )}
        </Panel>

        {/* current admission */}
        <Panel title="Status" icon={<BedDouble className="h-4 w-4 text-[#1E88E5]" />}>
          {derived.currentAdmission ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-[#1E88E5]" /> <span className="font-semibold text-slate-700">{derived.currentAdmission.ward}</span> · Bed {derived.currentAdmission.bed_number ?? "—"}</p>
              <p className="flex items-center gap-2 text-slate-500"><Clock className="h-4 w-4" /> {los(derived.currentAdmission.admitted_at, null)} days in care</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4 text-[#2ECC71]" /> Outpatient (not admitted)</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ConsultationsTab({ consultations }: { consultations: Consultation[] }) {
  if (!consultations.length) return <EmptyTab icon={Stethoscope} label="No consultations recorded" />;
  return (
    <div className="space-y-3">
      {consultations.map((c, i) => {
        const sym = parseSymptoms(c.symptoms);
        const doc = c.staff?.[0]?.name ?? "—";
        return (
          <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-[#1E88E5]" />
                <p className="font-semibold text-slate-800">{c.diagnosis || "Under observation"}</p>
              </div>
              <span className="text-xs text-slate-400">{fmtDateTime(c.visit_date)} · {doc}</span>
            </div>
            {(c.bp || c.temperature || c.pulse || c.weight) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {c.bp && <Chip tone="red">BP {c.bp}</Chip>}
                {c.temperature && <Chip tone="amber">{c.temperature}°C</Chip>}
                {c.pulse && <Chip tone="blue">{c.pulse} bpm</Chip>}
                {c.weight && <Chip tone="green">{c.weight} kg</Chip>}
              </div>
            )}
            {sym.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sym.map((s) => <span key={s} className="rounded-lg bg-[#F1C40F]/15 px-2 py-0.5 text-[11px] font-medium text-[#B8860B] ring-1 ring-inset ring-[#F1C40F]/30">{s}</span>)}
              </div>
            )}
            {c.notes && <p className="mt-3 rounded-xl bg-[#F4F6F8] p-3 text-sm text-slate-600">{c.notes}</p>}
          </motion.div>
        );
      })}
    </div>
  );
}

function LabsTab({ labs }: { labs: LabTest[] }) {
  if (!labs.length) return <EmptyTab icon={FlaskConical} label="No lab tests on record" />;
  return (
    <div className="space-y-3">
      {labs.map((l, i) => {
        const doc = l.staff?.[0]?.name ?? "—";
        const tone = l.status === "Completed" ? { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71" } : l.status === "In Progress" ? { chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30", dot: "#1E88E5" } : { chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40", dot: "#F1C40F" };
        return (
          <motion.div key={l.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-[#1E88E5]" />
                <p className="font-semibold text-slate-800">{l.test_type}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone.chip}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />{l.status}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{fmtDateTime(l.requested_at)} · Req. by {doc}</p>
            {l.result && (
              <div className="mt-3 rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1E8C4A]"><CheckCircle2 className="h-3.5 w-3.5" /> Result</p>
                <p className="mt-1 text-sm text-[#1E8C4A]/80">{l.result}</p>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function PrescriptionsTab({ prescriptions }: { prescriptions: Prescription[] }) {
  if (!prescriptions.length) return <EmptyTab icon={Pill} label="No prescriptions on record" />;
  return (
    <div className="space-y-3">
      {prescriptions.map((rx, i) => {
        const doc = rx.staff?.[0]?.name ?? "—";
        const items = rx.prescription_items ?? [];
        const total = items.reduce((s, it) => s + it.quantity * Number(it.unit_price), 0);
        const dispensed = rx.status === "Dispensed";
        return (
          <motion.div key={rx.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-[#1E88E5]" />
                <p className="font-semibold text-slate-800">{rx.id}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${dispensed ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40"}`}>{rx.status}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{fmtDate(rx.prescribed_at)} · By {doc} · {items.length} item(s)</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead><tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400"><th className="px-3 py-2 font-medium">Medicine</th><th className="px-3 py-2 font-medium">Dosage</th><th className="px-3 py-2 text-right font-medium">Qty</th></tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-slate-50"><td className="px-3 py-2 font-medium text-slate-700">{it.medicine_name}</td><td className="px-3 py-2 text-slate-500">{it.dosage || "—"}</td><td className="px-3 py-2 text-right text-slate-600">{it.quantity} {it.unit}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-right text-sm font-bold text-[#1E88E5]">{fmtKES(total)}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

function BillingTab({ invoices }: { invoices: Invoice[] }) {
  if (!invoices.length) return <EmptyTab icon={Receipt} label="No invoices on record" />;
  return (
    <div className="space-y-3">
      {invoices.map((inv, i) => {
        const items = inv.invoice_items ?? [];
        const paid = inv.status === "Paid";
        return (
          <motion.div key={inv.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#1E88E5]" />
                <p className="font-semibold text-slate-800">{inv.id}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${paid ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40"}`}>{inv.status}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{fmtDate(inv.invoice_date)}{paid && inv.payment_method ? ` · ${inv.payment_method}` : ""}</p>
            <div className="mt-3 space-y-1">
              {items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm"><span className="text-slate-600">{it.service}</span><span className="font-medium text-slate-700">{fmtKES(Number(it.amount))}</span></div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-bold"><span className="text-slate-800">Total</span><span className="text-[#1E88E5]">{fmtKES(Number(inv.total_amount))}</span></div>
          </motion.div>
        );
      })}
    </div>
  );
}

function AdmissionsTab({ admissions }: { admissions: Admission[] }) {
  if (!admissions.length) return <EmptyTab icon={BedDouble} label="No admissions on record" />;
  return (
    <div className="space-y-3">
      {admissions.map((a, i) => {
        const doc = a.staff?.[0]?.name ?? "—";
        const active = a.status === "Admitted";
        return (
          <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-[#1E88E5]" />
                <p className="font-semibold text-slate-800">{a.ward}{a.bed_number ? ` · Bed ${a.bed_number}` : ""}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${active ? "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{a.status}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{fmtDate(a.admitted_at)} → {a.discharged_at ? fmtDate(a.discharged_at) : "present"} · {los(a.admitted_at, a.discharged_at)} days · {doc}</p>
            <p className="mt-1 text-xs font-semibold text-[#1E88E5]">{fmtKES(Number(a.daily_rate))}/day · {fmtKES(los(a.admitted_at, a.discharged_at) * Number(a.daily_rate))}</p>
            {a.notes && <p className="mt-2 rounded-xl bg-[#F4F6F8] p-3 text-sm text-slate-600">{a.notes}</p>}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ============================ SUBCOMPONENTS ============================ */

function MiniStat({ icon: Icon, label, value, tone, money }: { icon: typeof Stethoscope; label: string; value: number; tone: string; money?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <Icon className={`h-6 w-6 ${tone}`} />
      <div>
        <p className={`text-xl font-bold ${tone}`}>{money ? fmtKES(value) : value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Panel({ title, icon, className, children }: { title: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md ${className ?? ""}`}>
      <div className="mb-4 flex items-center gap-2">{icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F6F8]">{icon}</div>}<h3 className="text-base font-semibold text-slate-800">{title}</h3></div>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/50 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F6F8] text-[#1E88E5]"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0"><p className="text-xs text-slate-400">{label}</p><p className="truncate text-sm font-medium text-slate-700">{value}</p></div>
    </div>
  );
}

function TagBlock({ title, items, tone, icon }: { title: string; items: string[]; tone: "red" | "blue"; icon: React.ReactNode }) {
  const tones = { red: "border-[#E74C3C]/20 bg-[#E74C3C]/5 text-[#C0392B]", blue: "border-[#1E88E5]/20 bg-[#1E88E5]/5 text-[#1E88E5]" };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length ? items.map((it) => <span key={it} className="rounded-lg bg-white/70 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-slate-200">{it}</span>) : <span className="text-xs opacity-60">None recorded</span>}
      </div>
    </div>
  );
}

function VitalBox({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string | null; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white/50 p-3 text-center">
      <Icon className={`mx-auto h-5 w-5 ${tone}`} />
      <p className="mt-1.5 text-sm font-bold text-slate-800">{value || "—"}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "red" | "amber" | "blue" | "green" }) {
  const tones = { red: "bg-[#E74C3C]/10 text-[#C0392B]", amber: "bg-[#F1C40F]/15 text-[#B8860B]", blue: "bg-[#1E88E5]/10 text-[#1E88E5]", green: "bg-[#2ECC71]/10 text-[#1E8C4A]" };
  return <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function EmptyTab({ icon: Icon, label }: { icon: typeof Stethoscope; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/70 py-16 text-center backdrop-blur-md">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400"><Icon className="h-8 w-8" /></div>
      <p className="font-semibold text-slate-700">{label}</p>
    </div>
  );
}
