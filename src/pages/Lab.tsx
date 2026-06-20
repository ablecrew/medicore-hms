import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ArrowUp,
  ArrowDown,
  AlertOctagon,
  BookOpen,
  ShieldAlert,
  PlusCircle,
  Zap,
  Printer,
  ExternalLink,
  FlaskRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type LabStatus = "Requested" | "In Progress" | "Completed";
type ResultFlag = "normal" | "high" | "low" | "critical_high" | "critical_low";

interface CatalogEntry {
  unit: string;
  refLow: number;
  refHigh: number;
  critLow?: number;
  critHigh?: number;
  price: number;
  specimen: string;
  tat: number;
  qualitative?: boolean;
}

interface LabTest {
  id: string;
  patient_id: string;
  doctor_id: string;
  test_type: string;
  status: LabStatus;
  result: string | null;
  result_value?: number | null;
  unit?: string | null;
  reference_range?: string | null;
  flag?: ResultFlag | null;
  is_critical?: boolean;
  critical_acknowledged?: boolean;
  requested_at: string;
  completed_at: string | null;
  patients?: { name: string } | null;
  staff?: { name: string } | null;
}

/* ============================ TEST CATALOG ============================ */

const TEST_CATALOG: Record<string, CatalogEntry> = {
  "Hemoglobin (Hb)": { unit: "g/dL", refLow: 12.0, refHigh: 16.0, critLow: 6.0, critHigh: 20.0, price: 500, specimen: "Whole Blood (EDTA)", tat: 2 },
  "WBC": { unit: "x10⁹/L", refLow: 4.0, refHigh: 11.0, critLow: 1.5, critHigh: 30.0, price: 500, specimen: "Whole Blood (EDTA)", tat: 2 },
  "Platelets": { unit: "x10⁹/L", refLow: 150, refHigh: 450, critLow: 50, critHigh: 1000, price: 500, specimen: "Whole Blood (EDTA)", tat: 2 },
  "RBC": { unit: "x10¹²/L", refLow: 4.2, refHigh: 5.9, price: 500, specimen: "Whole Blood (EDTA)", tat: 2 },
  "HCT": { unit: "%", refLow: 37, refHigh: 52, price: 500, specimen: "Whole Blood (EDTA)", tat: 2 },
  "Glucose (Random)": { unit: "mmol/L", refLow: 3.9, refHigh: 11.1, critLow: 2.5, critHigh: 25.0, price: 400, specimen: "Plasma (Fluoride)", tat: 1 },
  "Glucose (Fasting)": { unit: "mmol/L", refLow: 3.9, refHigh: 6.1, critLow: 2.5, critHigh: 25.0, price: 400, specimen: "Plasma (Fluoride)", tat: 1 },
  "Potassium": { unit: "mmol/L", refLow: 3.5, refHigh: 5.0, critLow: 3.0, critHigh: 6.5, price: 600, specimen: "Serum (SST)", tat: 2 },
  "Sodium": { unit: "mmol/L", refLow: 135, refHigh: 145, critLow: 125, critHigh: 155, price: 600, specimen: "Serum (SST)", tat: 2 },
  "Creatinine": { unit: "µmol/L", refLow: 60, refHigh: 120, critHigh: 500, price: 600, specimen: "Serum (SST)", tat: 3 },
  "Urea": { unit: "mmol/L", refLow: 2.5, refHigh: 6.5, critHigh: 30, price: 500, specimen: "Serum (SST)", tat: 3 },
  "ALT": { unit: "U/L", refLow: 0, refHigh: 40, critHigh: 1000, price: 600, specimen: "Serum (SST)", tat: 3 },
  "AST": { unit: "U/L", refLow: 0, refHigh: 40, critHigh: 1000, price: 600, specimen: "Serum (SST)", tat: 3 },
  "Cholesterol": { unit: "mmol/L", refLow: 0, refHigh: 5.2, price: 700, specimen: "Serum (SST)", tat: 3 },
  "HbA1c": { unit: "%", refLow: 4.0, refHigh: 5.6, price: 1500, specimen: "Whole Blood (EDTA)", tat: 4 },
  "Malaria RDT": { unit: "", refLow: 0, refHigh: 0, price: 300, specimen: "Whole Blood", tat: 1, qualitative: true },
  "COVID PCR": { unit: "", refLow: 0, refHigh: 0, price: 3500, specimen: "NP Swab (VTM)", tat: 24, qualitative: true },
  "Urinalysis": { unit: "", refLow: 0, refHigh: 0, price: 500, specimen: "Urine", tat: 1, qualitative: true },
  "Pregnancy Test": { unit: "", refLow: 0, refHigh: 0, price: 300, specimen: "Urine", tat: 1, qualitative: true },
  "Blood Group": { unit: "", refLow: 0, refHigh: 0, price: 400, specimen: "Whole Blood", tat: 1, qualitative: true },
};

const matchCatalog = (testType: string): { key: string; entry: CatalogEntry } | null => {
  const t = testType.toLowerCase().trim();
  // Direct key match
  for (const [key, entry] of Object.entries(TEST_CATALOG)) {
    if (t === key.toLowerCase() || t.includes(key.toLowerCase())) return { key, entry };
  }
  // Abbreviation matching
  if (t.includes("hb") || t.includes("haemoglobin") || t.includes("hemoglobin")) return { key: "Hemoglobin (Hb)", entry: TEST_CATALOG["Hemoglobin (Hb)"] };
  if (t.includes("wbc") || t.includes("white blood")) return { key: "WBC", entry: TEST_CATALOG["WBC"] };
  if (t.includes("platelet")) return { key: "Platelets", entry: TEST_CATALOG["Platelets"] };
  if (t.includes("hct") || t.includes("hematocrit")) return { key: "HCT", entry: TEST_CATALOG["HCT"] };
  if (t.includes("rbc") || t.includes("red blood")) return { key: "RBC", entry: TEST_CATALOG["RBC"] };
  if (t.includes("hba1c") || t.includes("glycated")) return { key: "HbA1c", entry: TEST_CATALOG["HbA1c"] };
  if (t.includes("glucose") || t.includes("sugar")) {
    return t.includes("fast") ? { key: "Glucose (Fasting)", entry: TEST_CATALOG["Glucose (Fasting)"] } : { key: "Glucose (Random)", entry: TEST_CATALOG["Glucose (Random)"] };
  }
  if (t.includes("potassium") || t.includes("k+")) return { key: "Potassium", entry: TEST_CATALOG["Potassium"] };
  if (t.includes("sodium") || t.includes("na+")) return { key: "Sodium", entry: TEST_CATALOG["Sodium"] };
  if (t.includes("creatinine")) return { key: "Creatinine", entry: TEST_CATALOG["Creatinine"] };
  if (t.includes("urea") || t.includes("bun")) return { key: "Urea", entry: TEST_CATALOG["Urea"] };
  if (t.includes("alt") || t.includes("sgpt")) return { key: "ALT", entry: TEST_CATALOG["ALT"] };
  if (t.includes("ast") || t.includes("sgot")) return { key: "AST", entry: TEST_CATALOG["AST"] };
  if (t.includes("cholesterol") || t.includes("lipid")) return { key: "Cholesterol", entry: TEST_CATALOG["Cholesterol"] };
  if (t.includes("malaria")) return { key: "Malaria RDT", entry: TEST_CATALOG["Malaria RDT"] };
  if (t.includes("covid")) return { key: "COVID PCR", entry: TEST_CATALOG["COVID PCR"] };
  if (t.includes("urine")) return { key: "Urinalysis", entry: TEST_CATALOG["Urinalysis"] };
  if (t.includes("pregnancy") || t.includes("hcg")) return { key: "Pregnancy Test", entry: TEST_CATALOG["Pregnancy Test"] };
  if (t.includes("blood group") || t.includes("blood type") || t.includes("grouping")) return { key: "Blood Group", entry: TEST_CATALOG["Blood Group"] };
  return null;
};

const evaluateResult = (value: number, entry: CatalogEntry): { flag: ResultFlag; isCritical: boolean } => {
  if (entry.qualitative) return { flag: "normal", isCritical: false };
  if (entry.critHigh !== undefined && value > entry.critHigh) return { flag: "critical_high", isCritical: true };
  if (entry.critLow !== undefined && value < entry.critLow) return { flag: "critical_low", isCritical: true };
  if (value > entry.refHigh) return { flag: "high", isCritical: false };
  if (value < entry.refLow) return { flag: "low", isCritical: false };
  return { flag: "normal", isCritical: false };
};

/* ============================ FLAG VISUALS ============================ */

const FLAG_META: Record<ResultFlag, { bg: string; text: string; border: string; label: string; icon: typeof CheckCircle2 }> = {
  normal: { bg: "bg-[#2ECC71]/10", text: "text-[#1E8C4A]", border: "border-[#2ECC71]/30", label: "Normal", icon: CheckCircle2 },
  high: { bg: "bg-[#F1C40F]/15", text: "text-[#B8860B]", border: "border-[#F1C40F]/40", label: "HIGH (H)", icon: ArrowUp },
  low: { bg: "bg-[#F1C40F]/15", text: "text-[#B8860B]", border: "border-[#F1C40F]/40", label: "LOW (L)", icon: ArrowDown },
  critical_high: { bg: "bg-[#E74C3C]/10", text: "text-[#C0392B]", border: "border-[#E74C3C]/40", label: "⚠ CRITICAL HIGH", icon: AlertOctagon },
  critical_low: { bg: "bg-[#E74C3C]/10", text: "text-[#C0392B]", border: "border-[#E74C3C]/40", label: "⚠ CRITICAL LOW", icon: AlertOctagon },
};

/* ============================ CONFIG ============================ */

const STATUS_META: Record<LabStatus, { chip: string; dot: string; hex: string; icon: typeof Clock }> = {
  Requested: { chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40", dot: "#F1C40F", hex: "#F1C40F", icon: Clock },
  "In Progress": { chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30", dot: "#1E88E5", hex: "#1E88E5", icon: Loader2 },
  Completed: { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71", hex: "#2ECC71", icon: CheckCircle2 },
};

const testIconFor = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("blood") || t.includes("cbc") || t.includes("hb") || t.includes("sugar") || t.includes("glucose")) return Droplet;
  if (t.includes("malaria") || t.includes("covid")) return Bug;
  if (t.includes("urine")) return Beaker;
  return TestTube;
};

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const patientName = (t: LabTest) => t.patients?.name ?? "Unknown";
const doctorName = (t: LabTest) => t.staff?.name ?? "—";

/* ============================ COMPONENT ============================ */

export default function Lab() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [tests, setTests] = useState<LabTest[]>([]);
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LabStatus | "All">("All");

  const [viewing, setViewing] = useState<LabTest | null>(null);
  const [uploading, setUploading] = useState<LabTest | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // request form
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ patient_id: "", test_type: "Hemoglobin (Hb)", doctor_id: "", is_stat: false });
  const [resultValue, setResultValue] = useState("");
  const [resultText, setResultText] = useState("");
  const [notes, setNotes] = useState("");
  const [liveFlag, setLiveFlag] = useState<ResultFlag | null>(null);
  const [showCritical, setShowCritical] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3200); };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .schema("medicore")
        .from("lab_tests")
        .select("id, patient_id, doctor_id, test_type, status, result, result_value, unit, reference_range, flag, is_critical, critical_acknowledged, requested_at, completed_at, patients(name), staff(name)")
        .order("requested_at", { ascending: false });
      if (err) throw err;
      setTests((data as unknown as LabTest[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Lab] load error:", e);
      setError("Failed to load lab tests. Run lab-reference-ranges.sql + check RLS.");
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
      setPatients((p.data as { id: string; name: string }[]) ?? []);
      setDoctors((d.data as { id: string; name: string }[]) ?? []);
    } catch (e) {
      console.error("[Lab] options error:", e);
    }
  }, []);

  useEffect(() => { void load(); void loadOptions(); }, [load, loadOptions]);

  /* ---------------- REQUEST TEST ---------------- */
  const submitRequest = async () => {
    if (!reqForm.patient_id || !reqForm.test_type) {
      showToast("error", "Please select a patient and test.");
      return;
    }
    setSaving(true);
    try {
      const id = `LAB-${String(stats.total + 1).padStart(4, "0")}`;
      const testLabel = reqForm.is_stat ? `STAT: ${reqForm.test_type}` : reqForm.test_type;
      const { error: e } = await supabase
        .schema("medicore")
        .from("lab_tests")
        .insert({
          id,
          patient_id: reqForm.patient_id,
          doctor_id: reqForm.doctor_id || profile?.id || null,
          test_type: testLabel,
          status: "Requested",
        });
      if (e) throw e;
      showToast("success", `${id} requested.${reqForm.is_stat ? " Marked STAT." : ""}`);
      setRequestOpen(false);
      setReqForm({ patient_id: "", test_type: "Hemoglobin (Hb)", doctor_id: "", is_stat: false });
      await load();
    } catch (e) {
      console.error("[Lab] request error:", e);
      showToast("error", "Could not request test.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase.channel("medicore-lab").on("postgres_changes", { event: "*", schema: "medicore", table: "lab_tests" }, () => void load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return tests.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || patientName(t).toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.test_type.toLowerCase().includes(q) || doctorName(t).toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tests, search, statusFilter]);

  const stats = useMemo(() => ({
    total: tests.length,
    requested: tests.filter((t) => t.status === "Requested").length,
    inProgress: tests.filter((t) => t.status === "In Progress").length,
    completed: tests.filter((t) => t.status === "Completed").length,
    critical: tests.filter((t) => t.is_critical && !t.critical_acknowledged).length,
  }), [tests]);

  const statusData = useMemo(() =>
    (["Requested", "In Progress", "Completed"] as LabStatus[]).map((k) => ({ name: k, value: tests.filter((t) => t.status === k).length, color: STATUS_META[k].hex })).filter((d) => d.value > 0),
  [tests]);

  const trendData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), count: tests.filter((t) => t.requested_at?.slice(0, 10) === iso).length });
    }
    return days;
  }, [tests]);

  /* ---------------- RESULT EVALUATION ---------------- */
  const uploadMatch = uploading ? matchCatalog(uploading.test_type) : null;

  const onResultValueChange = (val: string) => {
    setResultValue(val);
    if (uploadMatch && !uploadMatch.entry.qualitative) {
      const num = Number(val);
      if (val && !isNaN(num)) {
        setLiveFlag(evaluateResult(num, uploadMatch.entry).flag);
      } else {
        setLiveFlag(null);
      }
    }
  };

  /* ---------------- ACTIONS ---------------- */
  const advance = async (t: LabTest) => {
    try {
      const { error: e } = await supabase.schema("medicore").from("lab_tests").update({ status: "In Progress" }).eq("id", t.id);
      if (e) throw e;
      showToast("info", `${t.id} is now In Progress.`);
      await load();
    } catch (e) { console.error("[Lab] advance error:", e); showToast("error", "Could not update status."); }
  };

  const openUpload = (t: LabTest) => {
    setUploading(t);
    setResultValue("");
    setResultText(t.result ?? "");
    setNotes("");
    setLiveFlag(null);
  };

  const submitResult = async (acknowledged = false) => {
    if (!uploading) return;

    // If critical and not acknowledged, show popup instead of submitting
    if (uploadMatch && !uploadMatch.entry.qualitative) {
      const num = Number(resultValue);
      if (!resultValue || isNaN(num)) {
        showToast("error", "Please enter a valid numeric result.");
        return;
      }
      const evalResult = evaluateResult(num, uploadMatch.entry);
      if (evalResult.isCritical && !acknowledged) {
        setShowCritical(true);
        return;
      }
    } else if (!resultText.trim()) {
      showToast("error", "Please enter the result/findings.");
      return;
    }

    setSaving(true);
    try {
      const refRange = uploadMatch ? `${uploadMatch.entry.refLow} – ${uploadMatch.entry.refHigh} ${uploadMatch.entry.unit}`.trim() : null;
      const resultSummary = uploadMatch && !uploadMatch.entry.qualitative
        ? `${resultValue} ${uploadMatch.entry.unit} (Ref: ${refRange})${notes ? ` · ${notes}` : ""}`
        : `${resultText}${notes ? ` · ${notes}` : ""}`;

      const evalResult = uploadMatch && !uploadMatch.entry.qualitative
        ? evaluateResult(Number(resultValue), uploadMatch.entry)
        : { flag: "normal" as ResultFlag, isCritical: false };

      const payload: Record<string, unknown> = {
        status: "Completed",
        result: resultSummary,
        completed_at: new Date().toISOString(),
        flag: evalResult.flag,
        is_critical: evalResult.isCritical,
        critical_acknowledged: evalResult.isCritical ? acknowledged : false,
        critical_acknowledged_at: evalResult.isCritical && acknowledged ? new Date().toISOString() : null,
      };

      if (uploadMatch && !uploadMatch.entry.qualitative) {
        payload.result_value = Number(resultValue);
        payload.unit = uploadMatch.entry.unit;
        payload.reference_range = refRange;
      }

      const { error: e } = await supabase.schema("medicore").from("lab_tests").update(payload).eq("id", uploading.id);
      if (e) throw e;

      // If critical, create a notification for the doctor
      if (evalResult.isCritical) {
        await supabase.schema("medicore").from("notifications").insert({
          title: `CRITICAL: ${uploading.test_type} = ${resultValue} ${uploadMatch?.entry.unit ?? ""}`,
          message: `Critical result for ${patientName(uploading)}. Reference: ${refRange}. Requires immediate clinical attention.`,
          role: "doctor",
          staff_id: uploading.doctor_id,
          entity_type: "lab_test",
          entity_id: uploading.id,
          priority: "critical",
          status: "unread",
        }).then(({ error }) => { if (error) console.error("[Lab] notification error:", error.message); });
      }

      showToast("success", `Result uploaded for ${uploading.id}.${evalResult.isCritical ? " Doctor notified of critical value." : ""}`);
      setShowCritical(false);
      setUploading(null);
      setResultValue("");
      setResultText("");
      setNotes("");
      setLiveFlag(null);
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
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-6 text-white shadow-lg shadow-[#1E88E5]/25 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <FlaskConical className="h-3.5 w-3.5" /> Laboratory Information System
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lab Diagnostics</h1>
            <p className="mt-1 text-sm text-blue-50/90">Reference ranges · Auto-flagging · Critical alerts{profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.critical > 0 && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-3 rounded-2xl bg-[#E74C3C]/20 px-4 py-3 backdrop-blur ring-1 ring-inset ring-[#E74C3C]/40">
                <AlertOctagon className="h-6 w-6 text-[#FF6B6B] animate-pulse" />
                <div><p className="text-xl font-bold leading-none">{stats.critical}</p><p className="text-[10px] text-red-100">Critical unack</p></div>
              </motion.div>
            )}
            <button onClick={() => setCatalogOpen(true)} className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/25">
              <BookOpen className="h-4 w-4" /> Catalog
            </button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setRequestOpen(true)} className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50">
              <PlusCircle className="h-4 w-4" /> Request Test
            </motion.button>
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
        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:col-span-2">
          <div className="mb-4"><h3 className="flex items-center gap-2 text-base font-semibold"><Activity className="h-4 w-4 text-[#1E88E5]" /><span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Test Requests Trend</span></h3><p className="text-sm text-slate-500">Last 7 days</p></div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
              <defs><linearGradient id="labGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} /><stop offset="95%" stopColor="#1E88E5" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Area type="monotone" dataKey="count" name="Tests" stroke="#1E88E5" strokeWidth={2.5} fill="url(#labGrad)" dot={{ r: 3, fill: "#1E88E5" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800"><ListChecks className="h-4 w-4 text-violet-600" /> Status Split</h3>
          <p className="mb-2 text-sm text-slate-500">Distribution</p>
          {statusData.length ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                      {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-slate-900">{stats.total}</span><span className="text-xs text-slate-400">tests</span></div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {statusData.map((d) => (<div key={d.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span><span className="font-semibold text-slate-700">{d.value}</span></div>))}
              </div>
            </>
          ) : (<div className="flex h-40 items-center justify-center text-sm text-slate-400">No data yet</div>)}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md lg:w-80">
            <Search className="h-4 w-4 text-[#1E88E5]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, ID, test type..." className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
          </div>
          <FilterPills options={["All", "Requested", "In Progress", "Completed"]} value={statusFilter} onChange={(v) => setStatusFilter(v as LabStatus | "All")} />
        </div>
        <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {tests.length} tests</p>
      </div>

      {/* TEST CARDS */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-white/60 bg-white/70 backdrop-blur-md"><Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/60 bg-white/70 py-16 text-center backdrop-blur-md">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400"><FlaskConical className="h-8 w-8" /></div>
          <p className="font-semibold text-slate-700">No lab tests found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, i) => {
            const Icon = testIconFor(t.test_type);
            const meta = STATUS_META[t.status];
            const flag = t.flag ? FLAG_META[t.flag] : null;
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -5 }} className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md transition hover:shadow-xl">
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: t.is_critical && !t.critical_acknowledged ? "#E74C3C" : meta.hex }} />
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white shadow-lg"><Icon className="h-6 w-6" /></div>
                    <div><h3 className="text-base font-bold text-slate-900">{t.test_type}</h3><p className="text-xs text-slate-400">{t.id}</p></div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}><meta.icon className="h-3 w-3" />{t.status}</span>
                    {t.is_critical && !t.critical_acknowledged && <span className="inline-flex items-center gap-1 rounded-full bg-[#E74C3C]/10 px-2 py-0.5 text-[9px] font-bold text-[#C0392B] ring-1 ring-inset ring-[#E74C3C]/30 animate-pulse"><AlertOctagon className="h-3 w-3" /> UNACK</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl bg-[#F4F6F8] p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#1E88E5]"><User className="h-4 w-4" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{patientName(t)}</p><p className="truncate text-xs text-slate-500">Req. by {doctorName(t)}</p></div>
                </div>

                {/* RESULT DISPLAY */}
                {t.status === "Completed" && t.result_value != null && flag ? (
                  <div className={`mt-3 rounded-xl border p-3 ${flag.border} ${flag.bg}`}>
                    <div className="flex items-center justify-between">
                      <div><p className="text-lg font-bold text-slate-900">{t.result_value} <span className="text-sm text-slate-500">{t.unit}</span></p><p className="text-[10px] text-slate-400">Ref: {t.reference_range}</p></div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${flag.bg} ${flag.text}`}><flag.icon className="h-3 w-3" />{flag.label}</span>
                    </div>
                  </div>
                ) : t.result ? (
                  <div className="mt-3 rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/5 p-3"><p className="flex items-center gap-1.5 text-xs font-semibold text-[#1E8C4A]"><CheckCircle2 className="h-3.5 w-3.5" /> Result</p><p className="mt-1 text-xs text-[#1E8C4A]/80">{t.result}</p></div>
                ) : null}

                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock className="h-3.5 w-3.5" /> {fmtDateTime(t.requested_at)}</p>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => setViewing(t)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20"><Eye className="h-3.5 w-3.5" /> View</button>
                  {t.status === "Requested" && <button onClick={() => advance(t)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5] py-2 text-xs font-semibold text-white transition hover:bg-[#1976D2]"><PlayCircle className="h-3.5 w-3.5" /> Start</button>}
                  {t.status === "In Progress" && <button onClick={() => openUpload(t)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71] py-2 text-xs font-semibold text-white transition hover:bg-[#27AE60]"><Upload className="h-3.5 w-3.5" /> Result</button>}
                  {t.status === "Completed" && <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71]/10 py-2 text-xs font-semibold text-[#1E8C4A]"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Lab Test Details" subtitle={viewing?.id} icon={<FlaskConical className="h-5 w-5" />} size="lg">
        {viewing && (() => {
          const vMatch = matchCatalog(viewing.test_type);
          const vFlag = viewing.flag ? FLAG_META[viewing.flag] : null;
          const VIcon = testIconFor(viewing.test_type);
          return (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white"><VIcon className="h-6 w-6" /></div>
                  <div><h3 className="text-lg font-bold text-slate-900">{viewing.test_type}</h3><p className="text-sm text-slate-500">{viewing.id}</p></div>
                </div>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_META[viewing.status].chip}`}>{viewing.status}</span>
                  {viewing.is_critical && !viewing.critical_acknowledged && <span className="inline-flex items-center gap-1 rounded-full bg-[#E74C3C]/10 px-2 py-0.5 text-[9px] font-bold text-[#C0392B] ring-1 ring-inset ring-[#E74C3C]/30 animate-pulse"><AlertOctagon className="h-3 w-3" /> UNACK</span>}
                </div>
              </div>

              {vMatch && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-100 p-3 text-center"><Beaker className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-xs font-semibold text-slate-700">{vMatch.entry.specimen}</p><p className="text-[10px] text-slate-400">Specimen</p></div>
                  <div className="rounded-xl border border-slate-100 p-3 text-center"><Clock className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-xs font-semibold text-slate-700">{vMatch.entry.tat}h</p><p className="text-[10px] text-slate-400">TAT Target</p></div>
                  <div className="rounded-xl border border-slate-100 p-3 text-center"><FileText className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-xs font-semibold text-slate-700">KES {vMatch.entry.price}</p><p className="text-[10px] text-slate-400">Price</p></div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow icon={User} label="Patient" value={patientName(viewing)} />
                <InfoRow icon={Stethoscope} label="Requested By" value={doctorName(viewing)} />
                <InfoRow icon={CalendarClock} label="Requested At" value={fmtDateTime(viewing.requested_at)} />
                <InfoRow icon={CheckCircle2} label="Completed At" value={viewing.completed_at ? fmtDateTime(viewing.completed_at) : "—"} />
              </div>

              {viewing.status === "Completed" && viewing.result_value != null && vFlag ? (
                <div className={`rounded-xl border-2 p-5 ${vFlag.border} ${vFlag.bg}`}>
                  <div className="flex items-center justify-between">
                    <div><p className="text-3xl font-bold text-slate-900">{viewing.result_value} <span className="text-lg text-slate-500">{viewing.unit}</span></p><p className="mt-1 text-xs text-slate-400">Reference: {viewing.reference_range}</p></div>
                    <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${vFlag.bg} ${vFlag.text}`}><vFlag.icon className="h-4 w-4" />{vFlag.label}</span>
                  </div>
                </div>
              ) : viewing.result ? (
                <div className="rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/5 p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-[#1E8C4A]"><FileText className="h-4 w-4" /> Result</p><p className="mt-2 text-sm text-[#1E8C4A]/80">{viewing.result}</p></div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Close</button>
                {viewing.status === "Completed" && (
                  <>
                    <button onClick={() => navigate(`/patients/${viewing.patient_id}`)} className="inline-flex items-center gap-2 rounded-xl border border-[#1E88E5]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/5"><ExternalLink className="h-4 w-4" /> View EMR</button>
                    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"><Printer className="h-4 w-4" /> Print</button>
                  </>
                )}
                {viewing.status !== "Completed" && (
                  <>
                    {viewing.status === "Requested" && <button onClick={() => advance(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]"><PlayCircle className="h-4 w-4" /> Start Test</button>}
                    <button onClick={() => { const t = viewing; setViewing(null); openUpload(t); }} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27AE60]"><Upload className="h-4 w-4" /> Upload Result</button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ---------------- UPLOAD RESULT MODAL ---------------- */}
      <Modal open={!!uploading} onClose={() => setUploading(null)} title="Enter Lab Result" subtitle={uploading?.test_type} icon={<Upload className="h-5 w-5" />} size="lg">
        {uploading && uploadMatch && !uploadMatch.entry.qualitative ? (
          /* QUANTITATIVE RESULT ENTRY */
          <div className="space-y-4">
            <div className="rounded-xl bg-[#F4F6F8] p-4"><p className="text-sm font-semibold text-slate-800">{patientName(uploading)}</p><p className="text-xs text-slate-500">{uploading.id} · Requested by {doctorName(uploading)}</p></div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-100 p-3 text-center"><Beaker className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-xs font-semibold text-slate-700">{uploadMatch.entry.specimen}</p><p className="text-[10px] text-slate-400">Specimen</p></div>
              <div className="rounded-xl border border-slate-100 p-3 text-center"><FileText className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-xs font-semibold text-slate-700">{uploadMatch.entry.refLow}–{uploadMatch.entry.refHigh} {uploadMatch.entry.unit}</p><p className="text-[10px] text-slate-400">Reference</p></div>
              <div className="rounded-xl border border-slate-100 p-3 text-center"><Clock className="mx-auto h-4 w-4 text-slate-400" /><p className="mt-1 text-xs font-semibold text-slate-700">{uploadMatch.entry.tat}h</p><p className="text-[10px] text-slate-400">TAT</p></div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Result Value <span className="text-[#E74C3C]">*</span></label>
              <div className="relative">
                <input type="number" step="0.01" className={`${inputCls} pr-16 text-lg font-bold`} value={resultValue} onChange={(e) => onResultValueChange(e.target.value)} placeholder="0.00" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{uploadMatch.entry.unit}</span>
              </div>
            </div>

            {/* LIVE FLAG PREVIEW */}
            {liveFlag && (() => { const fMeta = FLAG_META[liveFlag]; return (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`flex items-center justify-between rounded-xl border-2 p-4 ${fMeta.border} ${fMeta.bg}`}>
                <div><p className="text-xs text-slate-500">Reference: {uploadMatch.entry.refLow} – {uploadMatch.entry.refHigh} {uploadMatch.entry.unit}</p><p className="text-lg font-bold text-slate-900">{resultValue} {uploadMatch.entry.unit}</p></div>
                <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${fMeta.bg} ${fMeta.text}`}><fMeta.icon className="h-4 w-4" />{fMeta.label}</span>
              </motion.div>
            ); })()}

            <Field label="Clinical Notes (optional)">
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Repeat test recommended" />
            </Field>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setUploading(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
              <button disabled={saving || !resultValue} onClick={() => submitResult(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Submit Result</button>
            </div>
          </div>
        ) : uploading ? (
          /* QUALITATIVE / UNKNOWN TEST RESULT ENTRY */
          <div className="space-y-4">
            <div className="rounded-xl bg-[#F4F6F8] p-4"><p className="text-sm font-semibold text-slate-800">{patientName(uploading)}</p><p className="text-xs text-slate-500">{uploading.id} · Requested by {doctorName(uploading)}</p></div>
            <Field label="Result / Findings <span className='text-[#E74C3C]'>*</span>">
              <textarea className={`${inputCls} min-h-[100px] resize-y`} value={resultText} onChange={(e) => setResultText(e.target.value)} placeholder="e.g. Positive — Plasmodium falciparum (+2)" />
            </Field>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setUploading(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
              <button disabled={saving} onClick={() => submitResult(false)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-[#27AE60] hover:to-[#46C57A] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Submit Result</button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ---------------- CRITICAL VALUE POPUP ---------------- */}
      <Modal open={showCritical} onClose={() => setShowCritical(false)} title="⚠ CRITICAL VALUE ALERT" subtitle="Immediate action required" icon={<AlertOctagon className="h-5 w-5 text-[#E74C3C]" />} size="md">
        {uploading && liveFlag && (() => { const fMeta = FLAG_META[liveFlag]; return (
          <div className="space-y-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center ${fMeta.border} ${fMeta.bg}`}>
              <AlertOctagon className="h-12 w-12 text-[#E74C3C] animate-pulse" />
              <div>
                <p className="text-3xl font-bold text-slate-900">{resultValue} {uploadMatch?.entry.unit}</p>
                <p className="mt-1 text-sm font-semibold text-[#C0392B]">{fMeta.label}</p>
                <p className="mt-1 text-xs text-slate-500">Reference: {uploadMatch?.entry.refLow} – {uploadMatch?.entry.refHigh} {uploadMatch?.entry.unit}</p>
                <p className="mt-1 text-xs text-slate-500">Critical threshold: {liveFlag === "critical_high" ? `> ${uploadMatch?.entry.critHigh}` : `< ${uploadMatch?.entry.critLow}`}</p>
              </div>
            </motion.div>
            <div className="rounded-xl bg-[#E74C3C]/5 p-4">
              <p className="text-sm font-semibold text-slate-800">⚠ {patientName(uploading)}</p>
              <p className="text-xs text-slate-600">You must acknowledge this critical value before submitting. The requesting doctor ({doctorName(uploading)}) will be notified immediately.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setShowCritical(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
              <button disabled={saving} onClick={() => submitResult(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#E74C3C] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#C0392B] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}Acknowledge &amp; Submit</button>
            </div>
          </div>
        ); })()}
      </Modal>

      {/* ---------------- REQUEST TEST MODAL ---------------- */}
      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Request Lab Test" subtitle="Select test from the catalog" icon={<FlaskRound className="h-5 w-5" />} size="lg">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Patient <span className="text-[#E74C3C]">*</span></span>
            <select className={inputCls} value={reqForm.patient_id} onChange={(e) => setReqForm({ ...reqForm, patient_id: e.target.value })}>
              <option value="">Select patient...</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Test <span className="text-[#E74C3C]">*</span></span>
            <select className={inputCls} value={reqForm.test_type} onChange={(e) => setReqForm({ ...reqForm, test_type: e.target.value })}>
              {Object.keys(TEST_CATALOG).map((t) => <option key={t}>{t}</option>)}
              <option value="Other">Other (specify in notes)</option>
            </select>
            {reqForm.test_type !== "Other" && TEST_CATALOG[reqForm.test_type] && (
              <p className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                <span>Specimen: <strong className="text-slate-500">{TEST_CATALOG[reqForm.test_type].specimen}</strong></span>
                <span>Price: <strong className="text-slate-500">KES {TEST_CATALOG[reqForm.test_type].price}</strong></span>
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Requesting Doctor</span>
            <select className={inputCls} value={reqForm.doctor_id} onChange={(e) => setReqForm({ ...reqForm, doctor_id: e.target.value })}>
              <option value="">Select doctor...</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>

          <button type="button" onClick={() => setReqForm({ ...reqForm, is_stat: !reqForm.is_stat })} className={`flex items-center justify-between rounded-xl border p-3 transition ${reqForm.is_stat ? "border-[#E74C3C] bg-[#E74C3C]/5" : "border-slate-200"}`}>
            <span className="flex items-center gap-2"><Zap className={`h-4 w-4 ${reqForm.is_stat ? "text-[#E74C3C]" : "text-slate-400"}`} /><span className="text-sm font-semibold text-slate-700">STAT (Emergency priority)</span></span>
            <div className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${reqForm.is_stat ? "bg-[#E74C3C]" : "bg-slate-200"}`}><motion.div layout className="h-4 w-4 rounded-full bg-white shadow-sm" /></div>
          </button>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setRequestOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
            <button disabled={saving} onClick={submitRequest} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}Request Test</button>
          </div>
        </div>
      </Modal>

      {/* ---------------- CATALOG MODAL ---------------- */}
      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Test Catalog" subtitle="Reference ranges & specifications" icon={<BookOpen className="h-5 w-5" />} size="lg">
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-[#F4F6F8] text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2 font-medium">Test</th><th className="px-3 py-2 font-medium">Specimen</th><th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 font-medium">Ref Range</th><th className="px-3 py-2 font-medium">Critical</th><th className="px-3 py-2 text-right font-medium">Price</th>
            </tr></thead>
            <tbody>
              {Object.entries(TEST_CATALOG).map(([key, e]) => (
                <tr key={key} className="border-t border-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{key}</td>
                  <td className="px-3 py-2 text-slate-500">{e.specimen}</td>
                  <td className="px-3 py-2 text-slate-500">{e.unit || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{e.qualitative ? "N/A" : `${e.refLow} – ${e.refHigh}`}</td>
                  <td className="px-3 py-2 text-[#C0392B]">{!e.qualitative && (e.critLow || e.critHigh) ? `${e.critLow ?? "—"} / ${e.critHigh ?? "—"}` : "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-700">KES {e.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function StatCard({ label, value, icon: Icon, gradient, delta }: { label: string; value: number; icon: typeof TestTube; gradient: string; delta: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => { const controls = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) }); return () => controls.stop(); }, [value]);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`} />
      <div className="relative flex items-start justify-between">
        <div><p className="text-sm font-medium text-slate-500">{label}</p><p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-3xl font-bold tracking-tight text-transparent`}>{display.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{delta}</p></div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}><Icon className="h-5 w-5" /></div>
      </div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-600" dangerouslySetInnerHTML={{ __html: label }} />{children}</label>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof TestTube; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F6F8] text-[#1E88E5]"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0"><p className="text-xs text-slate-400">{label}</p><p className="truncate text-sm font-medium text-slate-700">{value}</p></div>
    </div>
  );
}

function FilterPills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">
      {options.map((o) => (<button key={o} onClick={() => onChange(o)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${value === o ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{o}</button>))}
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
              <div className="flex items-center gap-3">{icon && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">{icon}</div>}<div><h3 className="text-lg font-semibold text-slate-900">{title}</h3>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div></div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
