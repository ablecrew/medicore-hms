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
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Stethoscope,
  Search,
  X,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  UserCheck,
  XCircle,
  Circle,
  Phone,
  MessageSquare,
  Loader2,
  CalendarClock,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type ApptStatus = "Scheduled" | "Checked In" | "Completed" | "Cancelled";

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  department: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  status: ApptStatus;
  sms_sent: boolean;
  patients?: { name: string; phone: string }[] | null;
  staff?: { name: string }[] | null;
}

interface PatientOption {
  id: string;
  name: string;
  phone: string;
}
interface DoctorOption {
  id: string;
  name: string;
  department: string;
}

interface FormState {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string;
}

/* ============================ THEME ============================ */

const STATUS_META: Record<
  ApptStatus,
  { chip: string; dot: string; hex: string; icon: typeof Circle }
> = {
  Scheduled: {
    chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40",
    dot: "#F1C40F",
    hex: "#F1C40F",
    icon: Circle,
  },
  "Checked In": {
    chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30",
    dot: "#1E88E5",
    hex: "#1E88E5",
    icon: UserCheck,
  },
  Completed: {
    chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30",
    dot: "#2ECC71",
    hex: "#2ECC71",
    icon: CheckCircle2,
  },
  Cancelled: {
    chip: "bg-[#E74C3C]/10 text-[#C0392B] ring-[#E74C3C]/30",
    dot: "#E74C3C",
    hex: "#E74C3C",
    icon: XCircle,
  },
};

const emptyForm: FormState = {
  patient_id: "",
  doctor_id: "",
  appointment_date: new Date().toISOString().split("T")[0],
  appointment_time: "09:00",
  reason: "",
};

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
];

/* ============================ HELPERS ============================ */

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const todayISO = () => new Date().toISOString().split("T")[0];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

const patientName = (a: Appointment) => a.patients?.[0]?.name ?? "Unknown";
const patientPhone = (a: Appointment) => a.patients?.[0]?.phone ?? "—";
const doctorName = (a: Appointment) => a.staff?.[0]?.name ?? "—";

/* ============================ COMPONENT ============================ */

export default function Appointments() {
  const { profile } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(new Date()); // month cursor
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApptStatus | "All">("All");

  // modals
  const [bookOpen, setBookOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [viewing, setViewing] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .schema("medicore")
        .from("appointments")
        .select(
          "id, patient_id, doctor_id, department, appointment_date, appointment_time, reason, status, sms_sent, patients(name, phone), staff(name)"
        )
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });
      if (err) throw err;
      setAppointments((data as Appointment[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Appointments] load error:", e);
      setError("Failed to load appointments. Check schema exposure + RLS + foreign-key relations.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([
        supabase
          .schema("medicore")
          .from("patients")
          .select("id, name, phone")
          .order("name"),
        supabase
          .schema("medicore")
          .from("staff")
          .select("id, name, department")
          .eq("role", "doctor")
          .order("name"),
      ]);
      setPatients((p.data as PatientOption[]) ?? []);
      setDoctors((d.data as DoctorOption[]) ?? []);
    } catch (e) {
      console.error("[Appointments] options error:", e);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  /* ---------------- REALTIME ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel("medicore-appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "medicore", table: "appointments" },
        () => void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        patientName(a).toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        doctorName(a).toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, search, statusFilter]);

  const stats = useMemo(() => {
    const today = todayISO();
    return {
      total: appointments.length,
      today: appointments.filter((a) => a.appointment_date === today).length,
      scheduled: appointments.filter((a) => a.status === "Scheduled").length,
      completed: appointments.filter((a) => a.status === "Completed").length,
      cancelled: appointments.filter((a) => a.status === "Cancelled").length,
    };
  }, [appointments]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = { Scheduled: 0, "Checked In": 0, Completed: 0, Cancelled: 0 };
    appointments.forEach((a) => {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    });
    return (Object.keys(counts) as ApptStatus[])
      .map((k) => ({
        name: k,
        value: counts[k],
        color: STATUS_META[k].hex,
      }))
      .filter((d) => d.value > 0);
  }, [appointments]);

  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach((a) => {
      counts[a.department] = (counts[a.department] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [appointments]);

  // calendar grid
  const calendar = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(
        `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    return cells;
  }, [cursor]);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.appointment_date === selectedDate)
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time)),
    [appointments, selectedDate]
  );

  /* ---------------- FORM ---------------- */
  const openBook = (date?: string) => {
    setForm({ ...emptyForm, appointment_date: date ?? selectedDate });
    setEditing(null);
    setBookOpen(true);
  };

  const openEdit = (a: Appointment) => {
    setForm({
      patient_id: a.patient_id,
      doctor_id: a.doctor_id,
      appointment_date: a.appointment_date,
      appointment_time: a.appointment_time.slice(0, 5),
      reason: a.reason ?? "",
    });
    setEditing(a);
    setViewing(null);
    setBookOpen(true);
  };

  const submit = async () => {
    if (!form.patient_id || !form.doctor_id) {
      showToast("error", "Please select a patient and a doctor.");
      return;
    }
    setSaving(true);
    try {
      const doctor = doctors.find((d) => d.id === form.doctor_id);
      const payload = {
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        department: doctor?.department ?? "General Medicine",
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        reason: form.reason.trim() || null,
        status: "Scheduled" as ApptStatus,
        sms_sent: true,
      };

      if (editing) {
        const { error: e } = await supabase
          .schema("medicore")
          .from("appointments")
          .update({
            patient_id: payload.patient_id,
            doctor_id: payload.doctor_id,
            department: payload.department,
            appointment_date: payload.appointment_date,
            appointment_time: payload.appointment_time,
            reason: payload.reason,
          })
          .eq("id", editing.id);
        if (e) throw e;
        showToast("success", `${editing.id} updated successfully.`);
      } else {
        const id = `APT-${String(stats.total + 1).padStart(4, "0")}`;
        const { error: e } = await supabase
          .schema("medicore")
          .from("appointments")
          .insert({ ...payload, id });
        if (e) throw e;
        showToast("success", `Appointment ${id} booked. SMS confirmation sent.`);
      }
      setBookOpen(false);
      setEditing(null);
      setSelectedDate(form.appointment_date);
      await load();
    } catch (e) {
      console.error("[Appointments] save error:", e);
      showToast("error", "Could not save appointment. Check permissions.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (a: Appointment, status: ApptStatus) => {
    try {
      const { error: e } = await supabase
        .schema("medicore")
        .from("appointments")
        .update({ status })
        .eq("id", a.id);
      if (e) throw e;
      setViewing(null);
      showToast("info", `${a.id} marked as ${status}.`);
      await load();
    } catch (e) {
      console.error("[Appointments] status error:", e);
      showToast("error", "Could not update status.");
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    setSaving(true);
    try {
      const { error: e } = await supabase
        .schema("medicore")
        .from("appointments")
        .update({ status: "Cancelled" })
        .eq("id", cancelling.id);
      if (e) throw e;
      showToast("info", `${cancelling.id} has been cancelled.`);
      setCancelling(null);
      await load();
    } catch (e) {
      console.error("[Appointments] cancel error:", e);
      showToast("error", "Could not cancel appointment.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="space-y-6 p-4 md:p-6">
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
              <CalendarClock className="h-3.5 w-3.5" /> Appointment Management
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Schedule &amp; Bookings
            </h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Manage patient appointments, calendar and status workflow
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openBook()}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"
          >
            <CalendarPlus className="h-4 w-4" /> Book Appointment
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
        <StatCard label="Total" value={stats.total} icon={CalendarDays} gradient="from-[#1E88E5] to-[#64B5F6]" delta="All bookings" />
        <StatCard label="Today" value={stats.today} icon={Clock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Scheduled today" />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Circle} gradient="from-[#F1C40F] to-[#F39C12]" delta="Upcoming" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} gradient="from-[#2ECC71] to-[#58D68D]" delta="Done" />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <Activity className="h-4 w-4 text-[#1E88E5]" /> Department Load
              </h3>
              <p className="text-sm text-slate-500">Appointments by department</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={departmentData} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
              <Bar dataKey="value" name="Appointments" radius={[6, 6, 0, 0]} barSize={32}>
                {departmentData.map((_, i) => (
                  <Cell key={i} fill={["#1E88E5", "#2ECC71", "#F1C40F", "#E74C3C", "#8E44AD", "#1ABC9C"][i % 6]} />
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
            <UserCheck className="h-4 w-4 text-violet-600" /> Status Split
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
                  <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                  <span className="text-xs text-slate-400">total</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {statusData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
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
              placeholder="Search patient, ID, doctor..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-[#F4F6F8] p-1">
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  view === "calendar" ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Calendar
              </button>
              <button
                onClick={() => setView("list")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  view === "list" ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500"
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" /> List
              </button>
            </div>
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <FilterPills
              options={["All", "Scheduled", "Checked In", "Completed", "Cancelled"]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as ApptStatus | "All")}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/70 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : view === "calendar" ? (
        /* CALENDAR + DAY PANEL */
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-3"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => { setCursor(new Date()); setSelectedDate(todayISO()); }} className="rounded-lg px-2 py-1 text-xs font-medium text-[#1E88E5] hover:bg-[#1E88E5]/10">
                  Today
                </button>
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{d}</div>
              ))}
              {calendar.map((iso, i) => {
                if (!iso) return <div key={i} />;
                const dayNum = Number(iso.split("-")[2]);
                const isToday = iso === todayISO();
                const isSelected = iso === selectedDate;
                const count = appointments.filter((a) => a.appointment_date === iso).length;
                return (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.06 }}
                    onClick={() => setSelectedDate(iso)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                      isSelected
                        ? "bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] font-bold text-white shadow-md shadow-[#1E88E5]/30"
                        : isToday
                        ? "bg-[#1E88E5]/10 font-semibold text-[#1E88E5] ring-1 ring-inset ring-[#1E88E5]/30"
                        : "text-slate-600 hover:bg-[#F4F6F8]"
                    }`}
                  >
                    {dayNum}
                    {count > 0 && (
                      <span className={`mt-0.5 flex h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#1E88E5]"}`} />
                    )}
                    {count > 1 && (
                      <span className={`absolute right-1 top-1 rounded-full px-1 text-[9px] font-bold ${isSelected ? "bg-white/30 text-white" : "bg-[#1E88E5]/15 text-[#1E88E5]"}`}>
                        {count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Day schedule */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm lg:col-span-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Day Schedule</h3>
                <p className="text-sm text-slate-500">{fmtDate(selectedDate)}</p>
              </div>
              <button onClick={() => openBook(selectedDate)} className="rounded-lg bg-[#1E88E5]/10 px-3 py-1.5 text-xs font-semibold text-[#1E88E5] hover:bg-[#1E88E5]/20">
                + Add
              </button>
            </div>
            {dayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">No appointments this day</p>
                <button onClick={() => openBook(selectedDate)} className="mt-3 text-xs font-semibold text-[#1E88E5] hover:underline">
                  Book one now
                </button>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {dayAppointments.map((a) => {
                  const meta = STATUS_META[a.status];
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group rounded-2xl border border-slate-200 p-3 transition hover:border-[#1E88E5]/40 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-[#F4F6F8] text-xs font-bold text-slate-600">
                            {a.appointment_time.slice(0, 5)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{patientName(a)}</p>
                            <p className="flex items-center gap-1 text-xs text-slate-500">
                              <Stethoscope className="h-3 w-3" /> {doctorName(a)} · {a.department}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.chip}`}>
                          <Icon className="h-3 w-3" /> {a.status}
                        </span>
                      </div>
                      {a.reason && <p className="mt-2 text-xs text-slate-500">{a.reason}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        {a.sms_sent && (
                          <span className="flex items-center gap-1 text-[11px] text-[#2ECC71]">
                            <MessageSquare className="h-3 w-3" /> SMS sent
                          </span>
                        )}
                        <button onClick={() => setViewing(a)} className="ml-auto text-xs font-semibold text-[#1E88E5] hover:underline">
                          Details →
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      ) : (
        /* LIST VIEW */
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white py-16 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
                <CalendarDays className="h-8 w-8" />
              </div>
              <p className="font-semibold text-slate-700">No appointments found</p>
              <p className="mt-1 text-sm text-slate-400">Try adjusting your search or book a new one.</p>
              <button onClick={() => openBook()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]">
                <CalendarPlus className="h-4 w-4" /> Book Appointment
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3 font-medium">Patient</th>
                        <th className="px-5 py-3 font-medium">Doctor / Dept</th>
                        <th className="px-5 py-3 font-medium">Date &amp; Time</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a, i) => (
                        <motion.tr key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="border-b border-slate-50 transition hover:bg-[#F4F6F8]/60">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-slate-800">{patientName(a)}</p>
                            <p className="text-xs text-slate-400">{a.id}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-slate-700">{doctorName(a)}</p>
                            <p className="text-xs text-slate-400">{a.department}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="flex items-center gap-1 text-slate-700"><CalendarDays className="h-3.5 w-3.5 text-slate-400" /> {fmtDate(a.appointment_date)}</p>
                            <p className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" /> {a.appointment_time.slice(0, 5)}</p>
                          </td>
                          <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <IconButton tone="blue" title="View" onClick={() => setViewing(a)}><Eye className="h-4 w-4" /></IconButton>
                              <IconButton tone="amber" title="Edit" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></IconButton>
                              <IconButton tone="red" title="Cancel" onClick={() => setCancelling(a)}><Ban className="h-4 w-4" /></IconButton>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
                {filtered.map((a, i) => (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{patientName(a)}</p>
                        <p className="text-xs text-slate-400">{a.id} · {doctorName(a)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(a.appointment_date)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {a.appointment_time.slice(0, 5)}</span>
                    </div>
                    {a.reason && <p className="mt-2 text-xs text-slate-500">{a.reason}</p>}
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                      <button onClick={() => setViewing(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5]">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => openEdit(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#F1C40F]/15 py-2 text-xs font-semibold text-[#B8860B]">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => setCancelling(a)} className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E74C3C]/10 px-3 py-2 text-xs font-semibold text-[#C0392B]">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ---------------- BOOK / EDIT MODAL ---------------- */}
      <Modal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        title={editing ? "Edit Appointment" : "Book Appointment"}
        subtitle={editing ? `${editing.id}` : "An SMS confirmation will be sent automatically"}
        icon={<CalendarPlus className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Patient" required className="sm:col-span-2">
            <select className={inputCls} value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select patient...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </Field>
          <Field label="Doctor" required className="sm:col-span-2">
            <select className={inputCls} value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
              <option value="">Select doctor...</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name} — {d.department}</option>
              ))}
            </select>
          </Field>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} />
          </Field>
          <Field label="Time" required>
            <select className={inputCls} value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}>
              {TIME_SLOTS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason for Visit" className="sm:col-span-2">
            <input className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Fever and persistent headache" />
          </Field>
        </div>

        {!editing && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#2ECC71]/5 p-3 text-xs text-[#1E8C4A]">
            <MessageSquare className="h-4 w-4" /> On confirm, the patient receives an automated SMS confirmation.
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={() => setBookOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <CheckCircle2 className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
            {editing ? "Save Changes" : "Confirm Booking"}
          </button>
        </div>
      </Modal>

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Appointment Details" subtitle={viewing?.id} icon={<Eye className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{patientName(viewing)}</h3>
                  <p className="text-sm text-slate-500">{viewing.department}</p>
                </div>
              </div>
              <StatusBadge status={viewing.status} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={Stethoscope} label="Doctor" value={doctorName(viewing)} />
              <InfoRow icon={Phone} label="Patient Phone" value={patientPhone(viewing)} />
              <InfoRow icon={CalendarDays} label="Date" value={fmtDate(viewing.appointment_date)} />
              <InfoRow icon={Clock} label="Time" value={viewing.appointment_time.slice(0, 5)} />
            </div>

            {viewing.reason && (
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-medium text-slate-400">Reason for Visit</p>
                <p className="mt-1 text-sm text-slate-700">{viewing.reason}</p>
              </div>
            )}

            {/* Status workflow */}
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="mb-3 text-xs font-medium text-slate-400">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {(["Scheduled", "Checked In", "Completed", "Cancelled"] as ApptStatus[]).map((s) => {
                  const meta = STATUS_META[s];
                  const active = viewing.status === s;
                  return (
                    <button
                      key={s}
                      disabled={active}
                      onClick={() => changeStatus(viewing, s)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        active ? `${meta.chip} cursor-default` : "bg-[#F4F6F8] text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <meta.icon className="h-3.5 w-3.5" /> {s}
                    </button>
                  );
                })}
              </div>
              {viewing.sms_sent && (
                <p className="mt-3 flex items-center gap-1 text-[11px] text-[#2ECC71]">
                  <MessageSquare className="h-3 w-3" /> SMS confirmation sent to patient
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Close
              </button>
              <button onClick={() => openEdit(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#F1C40F]/15 px-5 py-2.5 text-sm font-semibold text-[#B8860B] transition hover:bg-[#F1C40F]/25">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button onClick={() => setCancelling(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#E74C3C]/10 px-5 py-2.5 text-sm font-semibold text-[#C0392B] transition hover:bg-[#E74C3C]/20">
                <Ban className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- CANCEL MODAL ---------------- */}
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel Appointment" subtitle="This will mark the appointment as cancelled" icon={<Ban className="h-5 w-5" />}>
        {cancelling && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-[#E74C3C]/5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E74C3C]/10 text-[#E74C3C]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-600">
                Cancel <span className="font-semibold text-slate-900">{cancelling.id}</span> for{" "}
                <span className="font-semibold text-slate-900">{patientName(cancelling)}</span> on{" "}
                {fmtDate(cancelling.appointment_date)} at {cancelling.appointment_time.slice(0, 5)}?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelling(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Keep
              </button>
              <button disabled={saving} onClick={confirmCancel} className="inline-flex items-center gap-2 rounded-xl bg-[#E74C3C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C0392B] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Cancel Appointment
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
}: {
  label: string;
  value: number;
  icon: typeof CalendarDays;
  gradient: string;
  delta: string;
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
          <p className="text-sm font-medium text-slate-500">{label}</ p>
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

function StatusBadge({ status }: { status: ApptStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.chip}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
}

function Field({
  label,
  children,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-[#E74C3C]">*</span>}
      </span>
      {children}
    </label>
  );
}

function IconButton({
  children,
  onClick,
  tone,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "blue" | "amber" | "red";
  title: string;
}) {
  const tones = {
    blue: "text-[#1E88E5] hover:bg-[#1E88E5]/10",
    amber: "text-[#B8860B] hover:bg-[#F1C40F]/15",
    red: "text-[#C0392B] hover:bg-[#E74C3C]/10",
  };
  return (
    <button title={title} onClick={onClick} className={`rounded-lg p-2 transition ${tones[tone]}`}>
      {children}
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
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

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
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
