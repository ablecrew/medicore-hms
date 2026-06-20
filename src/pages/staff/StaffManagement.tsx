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
  Users,
  UserPlus,
  Search,
  X,
  Eye,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  Stethoscope,
  ShieldCheck,
  HeartPulse,
  Pill,
  FlaskConical,
  ConciergeBell,
  CircleDot,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers,
  IdCard,
  CalendarClock,
  KeyRound,
  Copy,
  LogIn,
  ShieldBan,
  ShieldOff,
  CalendarDays,
  ListChecks,
  BarChart3,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/* ============================ TYPES ============================ */

type Role = "admin" | "doctor" | "nurse" | "pharmacy" | "lab" | "reception";
type DutyStatus = "On Duty" | "Off Duty";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  specialization: string | null;
  department: string | null;
  status: DutyStatus;
  auth_user_id: string | null;
  created_at: string;
  license_number?: string | null;
  license_expiry?: string | null;
  account_status?: string | null;
}

interface Shift {
  id: number;
  staff_id: string;
  day_of_week: string;
  shift_type: string;
}

interface LeaveRequest {
  id: number;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  requested_at: string;
}

interface Metrics {
  consultations: number;
  appointments: number;
  prescriptions: number;
  lab_tests: number;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  role: Role;
  specialization: string;
  department: string;
  status: DutyStatus;
  license_number: string;
  license_expiry: string;
}

interface LeaveFormState {
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

/* ============================ THEME ============================ */

const ROLE_META: Record<
  Role,
  { label: string; gradient: string; soft: string; text: string; hex: string; icon: typeof Stethoscope }
> = {
  admin: { label: "Administrator", gradient: "from-slate-700 to-slate-900", soft: "bg-slate-100", text: "text-slate-700", hex: "#475569", icon: ShieldCheck },
  doctor: { label: "Doctor", gradient: "from-[#1E88E5] to-[#64B5F6]", soft: "bg-[#1E88E5]/10", text: "text-[#1E88E5]", hex: "#1E88E5", icon: Stethoscope },
  nurse: { label: "Nurse", gradient: "from-[#2ECC71] to-[#58D68D]", soft: "bg-[#2ECC71]/10", text: "text-[#1E8C4A]", hex: "#2ECC71", icon: HeartPulse },
  pharmacy: { label: "Pharmacist", gradient: "from-[#F1C40F] to-[#F39C12]", soft: "bg-[#F1C40F]/15", text: "text-[#B8860B]", hex: "#F1C40F", icon: Pill },
  lab: { label: "Lab Technician", gradient: "from-violet-500 to-purple-600", soft: "bg-violet-50", text: "text-violet-600", hex: "#7C3AED", icon: FlaskConical },
  reception: { label: "Receptionist", gradient: "from-[#1ABC9C] to-teal-600", soft: "bg-teal-50", text: "text-teal-600", hex: "#16A085", icon: ConciergeBell },
};

const DUTY_META: Record<DutyStatus, { chip: string; dot: string }> = {
  "On Duty": { chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30", dot: "#2ECC71" },
  "Off Duty": { chip: "bg-slate-100 text-slate-500 ring-slate-200", dot: "#94a3b8" },
};

const SHIFT_COLORS: Record<string, string> = {
  "Day": "bg-[#1E88E5]/10 text-[#1E88E5] border-[#1E88E5]/30",
  "Evening": "bg-[#F1C40F]/10 text-[#B8860B] border-[#F1C40F]/30",
  "Night": "bg-violet-100 text-violet-700 border-violet-300",
  "Off": "bg-slate-100 text-slate-400 border-slate-200",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHIFT_TYPES = ["Day", "Evening", "Night", "Off"];

const DEPARTMENTS = [
  "General Medicine",
  "Cardiology",
  "Pediatrics",
  "Orthopedics",
  "Neurology",
  "Dermatology",
  "Obstetrics & Gynecology",
  "Pharmacy",
  "Laboratory",
  "Reception",
  "Administration",
];

const ROLES = Object.keys(ROLE_META) as Role[];
const LEAVE_TYPES = ["Annual", "Sick", "Maternity", "Emergency", "Study"];

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  role: "doctor",
  specialization: "",
  department: "General Medicine",
  status: "On Duty",
  license_number: "",
  license_expiry: "",
};

const emptyLeaveForm: LeaveFormState = {
  staff_id: "",
  leave_type: "Annual",
  start_date: "",
  end_date: "",
  reason: "",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

/* ============================ HELPERS ============================ */

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const daysUntil = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

/* ============================ COMPONENT ============================ */

export default function StaffManagement() {
  const { profile } = useAuth();

  const [tab, setTab] = useState<"directory" | "roster" | "leave">("directory");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "All">("All");
  const [dutyFilter, setDutyFilter] = useState<DutyStatus | "All">("All");

  // modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [viewing, setViewing] = useState<StaffMember | null>(null);
  const [viewMetrics, setViewMetrics] = useState<Metrics | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);

  // login provisioning
  const [provisioningStaff, setProvisioningStaff] = useState<StaffMember | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [leaveForm, setLeaveForm] = useState<LeaveFormState>(emptyLeaveForm);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const [staffRes, shiftRes, leaveRes] = await Promise.all([
        supabase
          .schema("medicore")
          .from("staff")
          .select("id, name, email, phone, role, specialization, department, status, auth_user_id, created_at, license_number, license_expiry, account_status")
          .order("name"),
        supabase.schema("medicore").from("staff_shifts").select("*"),
        supabase.schema("medicore").from("leave_requests").select("*").order("requested_at", { ascending: false }),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (shiftRes.error) throw shiftRes.error;
      if (leaveRes.error) throw leaveRes.error;

      setStaff((staffRes.data as StaffMember[]) ?? []);
      setShifts((shiftRes.data as Shift[]) ?? []);
      setLeave((leaveRes.data as LeaveRequest[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Staff] load error:", e);
      setError("Failed to load. Run staff-hr-upgrade.sql + check RLS.");
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
      .channel("medicore-staff-mgmt")
      .on("postgres_changes", { event: "*", schema: "medicore", table: "staff" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "staff_shifts" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "medicore", table: "leave_requests" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) ||
        (s.specialization ?? "").toLowerCase().includes(q) || (s.department ?? "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "All" || s.role === roleFilter;
      const matchesDuty = dutyFilter === "All" || s.status === dutyFilter;
      return matchesSearch && matchesRole && matchesDuty;
    });
  }, [staff, search, roleFilter, dutyFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    onDuty: staff.filter((s) => s.status === "On Duty").length,
    roles: ROLES.filter((r) => staff.some((s) => s.role === r)).length,
    joinedThisMonth: staff.filter((s) => {
      const created = new Date(s.created_at);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length,
    suspended: staff.filter((s) => s.account_status === "Suspended").length,
    pendingLeave: leave.filter((l) => l.status === "Pending").length,
    onLeave: staff.filter((s) => {
      const today = new Date().toISOString().split("T")[0];
      return leave.some((l) => l.staff_id === s.id && l.status === "Approved" && l.start_date <= today && l.end_date >= today);
    }).length,
  }), [staff, leave]);

  const roleData = useMemo(
    () =>
      ROLES.map((r) => ({
        name: ROLE_META[r].label,
        value: staff.filter((s) => s.role === r).length,
        color: ROLE_META[r].hex,
      })).filter((d) => d.value > 0),
    [staff]
  );

  const dutyData = useMemo(() => {
    const on = staff.filter((s) => s.status === "On Duty").length;
    const off = staff.length - on;
    return [
      { name: "On Duty", value: on, color: "#2ECC71" },
      { name: "Off Duty", value: off, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [staff]);

  /* ---------------- FORM ---------------- */
  const openAdd = () => {
    setForm(emptyForm);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setForm({
      name: s.name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      specialization: s.specialization ?? "",
      department: s.department ?? "General Medicine",
      status: s.status,
      license_number: s.license_number ?? "",
      license_expiry: s.license_expiry ?? "",
    });
    setEditing(s);
    setViewing(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      showToast("error", "Name, email and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        role: form.role,
        specialization: form.specialization.trim() || null,
        department: form.department,
        status: form.status,
        license_number: form.license_number.trim() || null,
        license_expiry: form.license_expiry || null,
      };

      if (editing) {
        const { error: e } = await supabase
          .schema("medicore")
          .from("staff")
          .update(payload)
          .eq("id", editing.id);
        if (e) throw e;
        showToast("success", `${editing.id} updated successfully.`);
      } else {
        const id = `STF-${String(staff.length + 1).padStart(3, "0")}`;
        const { error: e } = await supabase
          .schema("medicore")
          .from("staff")
          .insert({ ...payload, id, password_hash: "pending-auth-setup" });
        if (e) throw e;
        showToast("success", `${form.role} ${id} added. Set up login credentials separately.`);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      console.error("[Staff] save error:", e);
      showToast("error", "Could not save staff member. Check permissions / email uniqueness.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDuty = async (s: StaffMember) => {
    const next: DutyStatus = s.status === "On Duty" ? "Off Duty" : "On Duty";
    try {
      const { error: e } = await supabase.schema("medicore").from("staff").update({ status: next }).eq("id", s.id);
      if (e) throw e;
      showToast("info", `${s.name} is now ${next}.`);
      await load();
    } catch (e) {
      console.error("[Staff] toggle error:", e);
      showToast("error", "Could not update duty status.");
    }
  };

  const toggleAccountStatus = async (s: StaffMember) => {
    const next = s.account_status === "Suspended" ? "Active" : "Suspended";
    try {
      const { error: e } = await supabase.schema("medicore").from("staff").update({ account_status: next }).eq("id", s.id);
      if (e) throw e;
      showToast("info", `${s.name}'s account is now ${next}.`);
      if (viewing) setViewing({ ...s, account_status: next });
      await load();
    } catch (e) {
      console.error("[Staff] toggle status error:", e);
      showToast("error", "Could not update account status.");
    }
  };

  const updateShift = async (staffId: string, day: string, shiftType: string) => {
    try {
      const existing = shifts.find((sh) => sh.staff_id === staffId && sh.day_of_week === day);
      if (existing) {
        await supabase.schema("medicore").from("staff_shifts").update({ shift_type: shiftType }).eq("id", existing.id);
      } else {
        await supabase.schema("medicore").from("staff_shifts").insert({ staff_id: staffId, day_of_week: day, shift_type: shiftType });
      }
      await load();
    } catch (e) {
      showToast("error", "Could not update shift.");
    }
  };

  const approveLeave = async (id: number, status: "Approved" | "Rejected") => {
    try {
      const { error: e } = await supabase.schema("medicore").from("leave_requests").update({ status }).eq("id", id);
      if (e) throw e;
      showToast("success", `Leave ${status}.`);
      await load();
    } catch {
      showToast("error", "Could not update leave.");
    }
  };

  const submitLeave = async () => {
    if (!leaveForm.staff_id || !leaveForm.start_date || !leaveForm.end_date) {
      showToast("error", "Fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      const { error: e } = await supabase.schema("medicore").from("leave_requests").insert({
        staff_id: leaveForm.staff_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason.trim() || null,
        status: "Pending",
      });
      if (e) throw e;
      showToast("success", "Leave request submitted.");
      setLeaveFormOpen(false);
      setLeaveForm(emptyLeaveForm);
      await load();
    } catch {
      showToast("error", "Could not submit leave.");
    } finally {
      setSaving(false);
    }
  };

  const openView = async (s: StaffMember) => {
    setViewing(s);
    setViewMetrics(null);
    try {
      const [con, apt, rx, lab] = await Promise.all([
        supabase.schema("medicore").from("consultations").select("id", { count: "exact", head: true }).eq("doctor_id", s.id),
        supabase.schema("medicore").from("appointments").select("id", { count: "exact", head: true }).eq("doctor_id", s.id),
        supabase.schema("medicore").from("prescriptions").select("id", { count: "exact", head: true }).eq("doctor_id", s.id),
        supabase.schema("medicore").from("lab_tests").select("id", { count: "exact", head: true }).eq("doctor_id", s.id),
      ]);
      setViewMetrics({
        consultations: con.count ?? 0,
        appointments: apt.count ?? 0,
        prescriptions: rx.count ?? 0,
        lab_tests: lab.count ?? 0,
      });
    } catch {
      setViewMetrics({ consultations: 0, appointments: 0, prescriptions: 0, lab_tests: 0 });
    }
  };

  /* ---------------- PROVISION LOGIN ---------------- */
  const provisionLogin = async (s: StaffMember) => {
    setProvisioningStaff(s);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        showToast("error", "Your session expired. Please sign in again.");
        setProvisioningStaff(null);
        return;
      }

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-login`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ staffId: s.id }),
      });

      const raw = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: `Non-JSON response (${res.status}): ${raw.slice(0, 200)}` };
      }

      if (!res.ok) {
        throw new Error((data.error as string) ?? `Request failed (${res.status})`);
      }

      const pwd = (data.tempPassword as string) ?? (data.password as string);
      const email = (data.email as string) ?? s.email;

      if (!pwd) {
        throw new Error("The function responded without a password.");
      }

      setCredentials({ email, password: pwd, name: s.name });
      setProvisioningStaff(null);
      await load();
    } catch (e) {
      console.error("[Staff] provision error:", e);
      const message = e instanceof Error ? e.message : "Could not create login.";
      showToast("error", message);
      setProvisioningStaff(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.schema("medicore").from("staff").delete().eq("id", deleting.id);
      if (e) throw e;
      showToast("success", `${deleting.name} has been removed.`);
      setDeleting(null);
      await load();
    } catch (e) {
      console.error("[Staff] delete error:", e);
      showToast("error", "Could not delete staff member.");
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
              <Users className="h-3.5 w-3.5" /> Staff Management
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Personnel Directory</h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Manage staff, roles &amp; duty rosters
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={openAdd}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4" /> Add Staff
          </motion.button>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/5 p-3 text-sm text-[#C0392B]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Staff" value={stats.total} icon={Users} gradient="from-[#1E88E5] to-[#64B5F6]" delta="All personnel" />
        <StatCard label="On Duty" value={stats.onDuty} icon={CircleDot} gradient="from-[#2ECC71] to-[#58D68D]" delta="Available now" />
        <StatCard label="On Leave" value={stats.onLeave} icon={CalendarClock} gradient="from-[#F1C40F] to-[#F39C12]" delta="Away today" />
        <StatCard label="Suspended" value={stats.suspended} icon={ShieldBan} gradient="from-[#E74C3C] to-[#EC7063]" delta="Access blocked" />
        <StatCard label="Pending Leave" value={stats.pendingLeave} icon={CalendarClock} gradient="from-violet-500 to-purple-600" delta="Awaiting approval" />
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
              <Layers className="h-4 w-4 text-[#1E88E5]" /> Staff by Role
            </h3>
            <p className="text-sm text-slate-500">Distribution across departments</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={roleData} layout="vertical" margin={{ left: 20, right: 20, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} cursor={{ fill: "#F4F6F8" }} />
              <Bar dataKey="value" name="Staff" radius={[0, 6, 6, 0]} barSize={18}>
                {roleData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
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
            <Activity className="h-4 w-4 text-[#2ECC71]" /> Duty Status
          </h3>
          <p className="mb-2 text-sm text-slate-500">Live availability</p>
          {dutyData.length ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={dutyData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={70} paddingAngle={3} stroke="none">
                      {dutyData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                  <span className="text-xs text-slate-400">staff</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {dutyData.map((d) => (
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

      {/* TABS */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-[#F4F6F8] p-1">
        {([["directory", "Directory", ListChecks], ["roster", "Shift Roster", CalendarDays], ["leave", "Leave Requests", CalendarClock]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === key ? "bg-white text-[#1E88E5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ===================== DIRECTORY TAB ===================== */}
      {tab === "directory" && (
        <>
          {/* TOOLBAR */}
          <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 rounded-xl bg-[#F4F6F8] px-3.5 py-2.5 lg:w-80">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, specialty..."
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterPills options={["All", ...ROLES]} value={roleFilter} onChange={(v) => setRoleFilter(v as Role | "All")} />
                <span className="hidden h-5 w-px bg-slate-200 sm:block" />
                <FilterPills options={["All", "On Duty", "Off Duty"]} value={dutyFilter} onChange={(v) => setDutyFilter(v as DutyStatus | "All")} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {staff.length} staff</p>
          </div>

          {/* STAFF GRID */}
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200/70 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} title="No staff found" cta={{ label: "Add Staff", onClick: openAdd }} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((s, i) => {
                const meta = ROLE_META[s.role];
                const Icon = meta.icon;
                const isSuspended = s.account_status === "Suspended";
                const expDays = daysUntil(s.license_expiry);
                const licenseExpiring = expDays !== null && expDays <= 30;

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -5 }}
                    className={`group relative overflow-hidden rounded-3xl border p-5 shadow-sm transition hover:shadow-lg ${isSuspended ? "border-[#E74C3C]/30 bg-[#E74C3C]/5" : "border-slate-200/70 bg-white"}`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${meta.gradient}`} />
                    {isSuspended && (
                      <div className="absolute right-3 top-3 rounded-full bg-[#E74C3C] px-2 py-0.5 text-[10px] font-bold text-white">SUSPENDED</div>
                    )}
                    <div className="mb-3 flex items-start justify-between">
                      <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} text-xl font-bold text-white shadow-lg`}>
                        {initials(s.name)}
                        {!isSuspended && <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-2 ring-white" style={{ background: DUTY_META[s.status].dot }} />}
                      </div>
                      {!isSuspended && (
                        <button
                          onClick={() => toggleDuty(s)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset transition hover:opacity-80 ${DUTY_META[s.status].chip}`}
                        >
                          {s.status}
                        </button>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{s.name}</h3>
                    <p className="text-xs text-slate-400">{s.id}</p>
                    <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-medium ${meta.text}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {s.specialization || meta.label}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 className="h-3.5 w-3.5" />
                      {s.department || "—"}
                    </p>

                    {/* License alert */}
                    {licenseExpiring && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#E74C3C]/10 px-2 py-1 text-[10px] font-semibold text-[#C0392B]">
                        <AlertTriangle className="h-3 w-3" /> License expires in {expDays}d!
                      </div>
                    )}

                    {/* role + contact */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-lg ${meta.soft} px-2 py-0.5 text-[11px] font-semibold ${meta.text}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5" /> {s.phone}
                    </p>

                    {/* login status indicator */}
                    {s.auth_user_id ? (
                      <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#2ECC71]/10 px-2 py-1 text-[11px] font-semibold text-[#1E8C4A]">
                        <CheckCircle2 className="h-3 w-3" /> Login enabled
                      </span>
                    ) : (
                      <button
                        onClick={() => provisionLogin(s)}
                        disabled={!!provisioningStaff}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2ECC71]/10 py-2 text-[11px] font-semibold text-[#1E8C4A] transition hover:bg-[#2ECC71]/20 disabled:opacity-60"
                      >
                        {provisioningStaff?.id === s.id ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</>
                        ) : (
                          <><KeyRound className="h-3.5 w-3.5" /> Create Login</>
                        )}
                      </button>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openView(s)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5] transition hover:bg-[#1E88E5]/20">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button onClick={() => openEdit(s)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#F1C40F]/15 py-2 text-xs font-semibold text-[#B8860B] transition hover:bg-[#F1C40F]/25">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => toggleAccountStatus(s)} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${isSuspended ? "bg-[#2ECC71]/10 text-[#1E8C4A] hover:bg-[#2ECC71]/20" : "bg-[#E74C3C]/10 text-[#C0392B] hover:bg-[#E74C3C]/20"}`} title={isSuspended ? "Activate account" : "Suspend account"}>
                        {isSuspended ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldBan className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => setDeleting(s)} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#E74C3C]/10 px-3 py-2 text-xs font-semibold text-[#C0392B] transition hover:bg-[#E74C3C]/20">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===================== ROSTER TAB ===================== */}
      {tab === "roster" && (
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <CalendarDays className="h-4 w-4 text-[#1E88E5]" /> Weekly Shift Roster
              </h3>
              <p className="text-sm text-slate-500">Click a cell to assign shift</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-400">
                  <th className="px-3 py-2 font-medium">Staff Member</th>
                  {DAYS.map((d) => <th key={d} className="px-3 py-2 text-center font-medium">{d.slice(0, 3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-700">{s.name}<br /><span className="text-[10px] font-normal text-slate-400">{s.role}</span></td>
                    {DAYS.map((day) => {
                      const shift = shifts.find((sh) => sh.staff_id === s.id && sh.day_of_week === day)?.shift_type || "Off";
                      return (
                        <td key={day} className="px-3 py-3 text-center">
                          <select
                            value={shift}
                            onChange={(e) => updateShift(s.id, day, e.target.value)}
                            className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-bold outline-none ${SHIFT_COLORS[shift]}`}
                          >
                            {SHIFT_TYPES.map((st) => <option key={st} value={st} className="bg-white text-slate-700">{st}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Coverage gaps */}
          <div className="mt-4 space-y-1.5">
            {DAYS.map((day) => {
              const dayShifts = shifts.filter((sh) => sh.day_of_week === day);
              const types = ["Day", "Evening", "Night"];
              const gaps = types.filter((t) => !dayShifts.some((sh) => sh.shift_type === t));
              if (gaps.length === 0) return null;
              return (
                <div key={day} className="flex items-center gap-2 rounded-lg bg-[#F1C40F]/10 px-3 py-2 text-xs text-[#B8860B]">
                  <AlertTriangle className="h-3.5 w-3.5" /> {day}: No staff on {gaps.join(", ")} shift
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== LEAVE TAB ===================== */}
      {tab === "leave" && (
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <CalendarClock className="h-4 w-4 text-[#1E88E5]" /> Leave Requests
            </h3>
            <button onClick={() => { setLeaveForm(emptyLeaveForm); setLeaveFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1976D2]">
              <Plus className="h-4 w-4" /> Request Leave
            </button>
          </div>
          <div className="space-y-3">
            {leave.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No leave requests.</p>
            ) : leave.map((l) => {
              const sm = staff.find((s) => s.id === l.staff_id);
              return (
                <div key={l.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${ROLE_META[sm?.role ?? "doctor"].gradient} text-xs font-bold text-white`}>
                      {initials(sm?.name ?? "?")}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{sm?.name ?? "Unknown"}</p>
                      <p className="text-xs text-slate-500">{l.leave_type} · {fmtDate(l.start_date)} → {fmtDate(l.end_date)}</p>
                      {l.reason && <p className="mt-1 text-xs text-slate-400">{l.reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status === "Pending" ? (
                      <>
                        <button onClick={() => approveLeave(l.id, "Approved")} className="rounded-lg bg-[#2ECC71] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#27AE60]">Approve</button>
                        <button onClick={() => approveLeave(l.id, "Rejected")} className="rounded-lg bg-[#E74C3C] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C0392B]">Reject</button>
                      </>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${l.status === "Approved" ? "bg-[#2ECC71]/10 text-[#1E8C4A]" : "bg-[#E74C3C]/10 text-[#C0392B]"}`}>{l.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Staff Profile" subtitle={viewing?.id} icon={<Users className="h-5 w-5" />} size="lg">
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${ROLE_META[viewing.role].gradient} text-xl font-bold text-white shadow-lg`}>
                {initials(viewing.name)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{viewing.name}</h3>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${DUTY_META[viewing.status].chip}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: DUTY_META[viewing.status].dot }} />
                    {viewing.status}
                  </span>
                  {viewing.account_status === "Suspended" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E74C3C]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C0392B] ring-1 ring-inset ring-[#E74C3C]/30">
                      <ShieldBan className="h-3 w-3" /> Suspended
                    </span>
                  )}
                </div>
                <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${ROLE_META[viewing.role].text}`}>
                  {(() => { const Icon = ROLE_META[viewing.role].icon; return <Icon className="h-4 w-4" />; })()}
                  {viewing.specialization || ROLE_META[viewing.role].label}
                </p>
                <p className="text-xs text-slate-500">{viewing.department || "—"}</p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart3 className="h-4 w-4 text-[#1E88E5]" /> Performance Metrics
              </h4>
              {viewMetrics ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricBox label="Consultations" value={viewMetrics.consultations} />
                  <MetricBox label="Appointments" value={viewMetrics.appointments} />
                  <MetricBox label="Prescriptions" value={viewMetrics.prescriptions} />
                  <MetricBox label="Lab Orders" value={viewMetrics.lab_tests} />
                </div>
              ) : <Loader2 className="h-5 w-5 animate-spin text-[#1E88E5]" />}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={IdCard} label="Staff ID" value={viewing.id} />
              <InfoRow icon={Layers} label="Role" value={ROLE_META[viewing.role].label} />
              <InfoRow icon={Mail} label="Email" value={viewing.email} />
              <InfoRow icon={Phone} label="Phone" value={viewing.phone} />
              <InfoRow icon={Building2} label="Department" value={viewing.department || "—"} />
              <InfoRow icon={IdCard} label="License No." value={viewing.license_number || "N/A"} />
              <InfoRow icon={CalendarClock} label="License Expiry" value={viewing.license_expiry ? fmtDate(viewing.license_expiry) : "N/A"} />
              <InfoRow icon={CalendarClock} label="Joined" value={fmtDate(viewing.created_at)} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => toggleAccountStatus(viewing)} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${viewing.account_status === "Suspended" ? "bg-[#2ECC71]/10 text-[#1E8C4A] hover:bg-[#2ECC71]/20" : "bg-[#E74C3C]/10 text-[#C0392B] hover:bg-[#E74C3C]/20"}`}>
                {viewing.account_status === "Suspended" ? <ShieldOff className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                {viewing.account_status === "Suspended" ? "Activate" : "Suspend"}
              </button>
              <button onClick={() => toggleDuty(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#2ECC71]/10 px-5 py-2.5 text-sm font-semibold text-[#1E8C4A] transition hover:bg-[#2ECC71]/20">
                <CircleDot className="h-4 w-4" /> Toggle {viewing.status === "On Duty" ? "Off" : "On"} Duty
              </button>
              <button onClick={() => setViewing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Close
              </button>
              <button onClick={() => openEdit(viewing)} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- ADD / EDIT MODAL ---------------- */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit Staff" : "Add Staff Member"} subtitle={editing ? editing.id : "Create a new personnel record"} icon={<UserPlus className="h-5 w-5" />} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full Name" required className="sm:col-span-2">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dr. Jane Doe" />
            </Field>
            <Field label="Email" required>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@medicore.co.ke" />
            </Field>
            <Field label="Phone" required>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
            </Field>
            <Field label="Role" required>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="License Number">
              <input className={inputCls} value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="e.g. KMPDB-A-12345" />
            </Field>
            <Field label="License Expiry Date">
              <input type="date" className={inputCls} value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} />
            </Field>
            <Field label="Specialization" className="sm:col-span-2">
              <input className={inputCls} value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiologist" />
            </Field>
            <Field label="Duty Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DutyStatus })}>
                <option>On Duty</option>
                <option>Off Duty</option>
              </select>
            </Field>
          </div>

          {!editing && (
            <div className="flex items-center gap-2 rounded-xl bg-[#F1C40F]/10 p-3 text-xs text-[#B8860B]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Login credentials are set up separately in Authentication. This record stores profile &amp; role info.
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
              Cancel
            </button>
            <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <CheckCircle2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {editing ? "Save Changes" : "Add Staff"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------------- LEAVE FORM MODAL ---------------- */}
      <Modal open={leaveFormOpen} onClose={() => setLeaveFormOpen(false)} title="Request Leave" subtitle="Submit a new leave application" icon={<CalendarClock className="h-5 w-5" />}>
        <div className="space-y-4">
          <Field label="Staff Member" required>
            <select className={inputCls} value={leaveForm.staff_id} onChange={(e) => setLeaveForm({ ...leaveForm, staff_id: e.target.value })}>
              <option value="">Select staff...</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </Field>
          <Field label="Leave Type" required>
            <select className={inputCls} value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
              {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" required><input type="date" className={inputCls} value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} /></Field>
            <Field label="End Date" required><input type="date" className={inputCls} value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} /></Field>
          </div>
          <Field label="Reason"><textarea className={`${inputCls} min-h-[60px] resize-y`} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Brief reason for leave..." /></Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setLeaveFormOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cancel</button>
            <button disabled={saving} onClick={submitLeave} className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Submit
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------------- DELETE MODAL ---------------- */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Staff" subtitle="This action cannot be undone" icon={<Trash2 className="h-5 w-5" />}>
        {deleting && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-[#E74C3C]/5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E74C3C]/10 text-[#E74C3C]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-600">
                Remove <span className="font-semibold text-slate-900">{deleting.name}</span> ({deleting.id}) from the staff directory?
                Their appointments and records remain, but the profile will be deleted.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
                Cancel
              </button>
              <button disabled={saving} onClick={confirmDelete} className="inline-flex items-center gap-2 rounded-xl bg-[#E74C3C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C0392B] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Staff
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- CREDENTIALS MODAL ---------------- */}
      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="Login Created"
        subtitle="Share these credentials securely"
        icon={<LogIn className="h-5 w-5" />}
      >
        {credentials && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-[#2ECC71]/10 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2ECC71]/20 text-[#1E8C4A]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{credentials.name}</span> can now sign in.
                These credentials are shown once — copy them now.
              </p>
            </div>

            {/* email */}
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Email</p>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F4F6F8] p-3">
                <Mail className="h-4 w-4 shrink-0 text-[#1E88E5]" />
                <span className="flex-1 truncate text-sm font-medium text-slate-700">{credentials.email}</span>
                <button
                  onClick={() => copyToClipboard(credentials.email)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-[#1E88E5]"
                  title="Copy email"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* password */}
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Temporary Password</p>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F4F6F8] p-3">
                <KeyRound className="h-4 w-4 shrink-0 text-[#1E88E5]" />
                <span className="flex-1 truncate font-mono text-sm font-semibold text-slate-700">{credentials.password}</span>
                <button
                  onClick={() => copyToClipboard(credentials.password)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-[#1E88E5]"
                  title="Copy password"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-[#F1C40F]/10 p-3 text-xs text-[#B8860B]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Ask the staff member to sign in and change this password as soon as possible.
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setCredentials(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2ECC71] to-[#58D68D] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#2ECC71]/30 transition hover:from-[#27AE60] hover:to-[#46C57A]"
              >
                <CheckCircle2 className="h-4 w-4" /> Done
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

function StatCard({ label, value, icon: Icon, gradient, delta }: { label: string; value: number; icon: typeof Users; gradient: string; delta: string }) {
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

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#F4F6F8] p-3 text-center">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
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

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
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

function EmptyState({ icon, title, cta }: { icon: React.ReactNode; title: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white py-16 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
        {icon}
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">Try adjusting your search or filters.</p>
      {cta && (
        <button onClick={cta.onClick} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]">
          <UserPlus className="h-4 w-4" /> {cta.label}
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
          {o === "All" ? "All" : o.charAt(0).toUpperCase() + o.slice(1)}
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
