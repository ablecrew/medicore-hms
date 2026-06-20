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
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  Droplet,
  ShieldCheck,
  Siren,
  HeartPulse,
  Trash2,
  Pencil,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  Activity,
  BedDouble,
  TrendingUp,
  IdCard,
  CalendarClock,
  Loader2,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

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

interface FormState {
  name: string;
  age: string;
  gender: Gender;
  phone: string;
  national_id: string;
  emergency_contact: string;
  address: string;
  blood_type: string;
  insurance: string;
  allergies: string;
  conditions: string;
  status: PatientStatus;
}

/* ============================ THEME ============================ */

const emptyForm: FormState = {
  name: "",
  age: "",
  gender: "Male",
  phone: "",
  national_id: "",
  emergency_contact: "",
  address: "",
  blood_type: "O+",
  insurance: "NHIF",
  allergies: "",
  conditions: "",
  status: "Active",
};

const STATUS_META: Record<
  PatientStatus,
  { bg: string; text: string; ring: string; dot: string; chip: string }
> = {
  Active: {
    bg: "bg-[#2ECC71]/10",
    text: "text-[#1E8C4A]",
    ring: "ring-[#2ECC71]/30",
    dot: "#2ECC71",
    chip: "bg-[#2ECC71]/10 text-[#1E8C4A] ring-[#2ECC71]/30",
  },
  Admitted: {
    bg: "bg-[#1E88E5]/10",
    text: "text-[#1E88E5]",
    ring: "ring-[#1E88E5]/30",
    dot: "#1E88E5",
    chip: "bg-[#1E88E5]/10 text-[#1E88E5] ring-[#1E88E5]/30",
  },
  Discharged: {
    bg: "bg-[#F1C40F]/15",
    text: "text-[#B8860B]",
    ring: "ring-[#F1C40F]/40",
    dot: "#F1C40F",
    chip: "bg-[#F1C40F]/15 text-[#B8860B] ring-[#F1C40F]/40",
  },
  Inactive: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    ring: "ring-slate-200",
    dot: "#94a3b8",
    chip: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

const genderGradient = (g: Gender) =>
  g === "Female"
    ? "from-pink-500 to-rose-500"
    : g === "Male"
    ? "from-[#1E88E5] to-[#64B5F6]"
    : "from-violet-500 to-purple-500";

/* ============================ HELPERS ============================ */

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const toList = (s: string | null) =>
  (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20";

/* ============================ COMPONENT ============================ */

export default function Patients() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PatientStatus | "All">("All");
  const [genderFilter, setGenderFilter] = useState<Gender | "All">("All");

  // modal state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [viewing, setViewing] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showToast = (
    type: "success" | "error" | "info",
    message: string
  ) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3200);
  };

  /* ---------------- LOAD ---------------- */
  const load = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .schema("medicore")
        .from("patients")
        .select("*")
        .order("registered_at", { ascending: false });
      if (err) throw err;
      setPatients((data as Patient[]) ?? []);
      setError(null);
    } catch (e) {
      console.error("[Patients] load error:", e);
      setError("Failed to load patients. Check the medicore schema is exposed + RLS.");
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
      .channel("medicore-patients")
      .on(
        "postgres_changes",
        { event: "*", schema: "medicore", table: "patients" },
        () => void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /* ---------------- DERIVED ---------------- */
  const filtered = useMemo(() => {
    return patients.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.national_id ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "All" || p.status === statusFilter;
      const matchesGender =
        genderFilter === "All" || p.gender === genderFilter;
      return matchesSearch && matchesStatus && matchesGender;
    });
  }, [patients, search, statusFilter, genderFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total: patients.length,
      admitted: patients.filter((p) => p.status === "Admitted").length,
      active: patients.filter((p) => p.status === "Active").length,
      newThisMonth: patients.filter(
        (p) => new Date(p.registered_at) >= monthStart
      ).length,
    };
  }, [patients]);

  const genderData = useMemo(() => {
    const counts = { Male: 0, Female: 0, Other: 0 };
    patients.forEach((p) => {
      counts[p.gender] = (counts[p.gender] ?? 0) + 1;
    });
    return [
      { name: "Male", value: counts.Male, color: "#1E88E5" },
      { name: "Female", value: counts.Female, color: "#E91E63" },
      { name: "Other", value: counts.Other, color: "#8E44AD" },
    ].filter((d) => d.value > 0);
  }, [patients]);

  const trendData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: patients.filter(
          (p) => p.registered_at?.slice(0, 10) === iso
        ).length,
      });
    }
    return days;
  }, [patients]);

  /* ---------------- FORM HANDLERS ---------------- */
  const openRegister = () => {
    setForm(emptyForm);
    setEditing(null);
    setRegisterOpen(true);
  };

  const openEdit = (p: Patient) => {
    setForm({
      name: p.name,
      age: String(p.age),
      gender: p.gender,
      phone: p.phone,
      national_id: p.national_id ?? "",
      emergency_contact: p.emergency_contact ?? "",
      address: p.address ?? "",
      blood_type: p.blood_type,
      insurance: p.insurance,
      allergies: p.allergies ?? "",
      conditions: p.conditions ?? "",
      status: p.status,
    });
    setEditing(p);
    setViewing(null);
    setRegisterOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      showToast("error", "Name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        age: Number(form.age) || 0,
        gender: form.gender,
        phone: form.phone.trim(),
        national_id: form.national_id.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        address: form.address.trim() || null,
        blood_type: form.blood_type,
        insurance: form.insurance.trim() || "NHIF",
        allergies: form.allergies.trim() || null,
        conditions: form.conditions.trim() || null,
        status: form.status,
      };

      if (editing) {
        const { error: e } = await supabase
          .schema("medicore")
          .from("patients")
          .update(payload)
          .eq("id", editing.id);
        if (e) throw e;
        showToast("success", `${editing.id} updated successfully.`);
      } else {
        const id = `PAT-${String(stats.total + 1).padStart(4, "0")}`;
        const { error: e } = await supabase
          .schema("medicore")
          .from("patients")
          .insert({ ...payload, id });
        if (e) throw e;
        showToast("success", `Patient ${id} registered successfully.`);
      }
      setRegisterOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      console.error("[Patients] save error:", e);
      showToast("error", "Could not save patient. Check permissions.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const { error: e } = await supabase
        .schema("medicore")
        .from("patients")
        .delete()
        .eq("id", deleting.id);
      if (e) throw e;
      showToast("success", `${deleting.name} has been removed.`);
      setDeleting(null);
      await load();
    } catch (e) {
      console.error("[Patients] delete error:", e);
      showToast("error", "Could not delete patient.");
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
              <HeartPulse className="h-3.5 w-3.5" /> Patient Management
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Patient Registry
            </h1>
            <p className="mt-1 text-sm text-blue-50/90">
              Register, search and manage electronic medical records
              {profile?.name ? ` · ${profile.name.split(" ")[0]}` : ""}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={openRegister}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#1E88E5] shadow-lg transition hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4" /> Register Patient
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
        <StatCard
          label="Total Patients"
          value={stats.total}
          icon={Users}
          gradient="from-[#1E88E5] to-[#64B5F6]"
          delta="All records"
        />
        <StatCard
          label="Admitted"
          value={stats.admitted}
          icon={BedDouble}
          gradient="from-[#F1C40F] to-[#F39C12]"
          delta="In care now"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={Activity}
          gradient="from-[#2ECC71] to-[#58D68D]"
          delta="Outpatients"
        />
        <StatCard
          label="New This Month"
          value={stats.newThisMonth}
          icon={TrendingUp}
          gradient="from-violet-500 to-purple-600"
          delta="Registrations"
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="h-4 w-4 text-[#1E88E5]" />
                <span className="bg-gradient-to-r from-[#1E88E5] to-[#2ECC71] bg-clip-text text-transparent">Registration Trend</span>
              </h3>
              <p className="text-sm text-slate-500">New patients · last 7 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E88E5" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#1E88E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="New patients"
                stroke="#1E88E5"
                strokeWidth={2.5}
                fill="url(#regGrad)"
                dot={{ r: 3, fill: "#1E88E5" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md"
        >
          <h3 className="flex items-center gap-2 text-base font-semibold text-transparent">
            <Users className="h-4 w-4 text-violet-600" />
            <span className="bg-gradient-to-r from-violet-500 to-[#1E88E5] bg-clip-text">By Gender</span>
          </h3>
          <p className="mb-2 text-sm text-slate-500">Distribution</p>
          {genderData.length ? (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {genderData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">
                    {stats.total}
                  </span>
                  <span className="text-xs text-slate-400">total</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {genderData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2 text-slate-600">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: d.color }}
                      />
                      {d.name}
                    </span>
                    <span className="font-semibold text-slate-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              No data yet
            </div>
          )}
        </motion.div>
      </div>

      {/* TOOLBAR */}
      <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/50 px-3.5 py-2.5 backdrop-blur-md lg:w-96">
            <Search className="h-4 w-4 text-[#1E88E5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, phone, national ID..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Filter className="h-4 w-4" />
            </div>
            <FilterPills
              options={["All", "Active", "Admitted", "Discharged", "Inactive"]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as PatientStatus | "All")}
            />
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <FilterPills
              options={["All", "Male", "Female", "Other"]}
              value={genderFilter}
              onChange={(v) => setGenderFilter(v as Gender | "All")}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Showing {filtered.length} of {patients.length} patients
        </p>
      </div>

      {/* TABLE / CARDS */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-3xl border border-white/50 bg-white/70 backdrop-blur-md">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E88E5]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/50 bg-white/70 py-16 text-center backdrop-blur-md">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F6F8] text-slate-400">
            <Users className="h-8 w-8" />
          </div>
          <p className="font-semibold text-slate-700">No patients found</p>
          <p className="mt-1 text-sm text-slate-400">
            Try adjusting your search or register a new patient.
          </p>
          <button
            onClick={openRegister}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5]"
          >
            <UserPlus className="h-4 w-4" /> Register Patient
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md lg:block"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Age / Gender</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Blood</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => navigate(`/patients/${p.id}`)}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-[#F4F6F8]/60"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} gradient={genderGradient(p.gender)} />
                          <div>
                            <p className="font-semibold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {p.age} · {p.gender}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {p.phone}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#E74C3C]/10 px-2 py-0.5 text-xs font-semibold text-[#C0392B]">
                          <Droplet className="h-3 w-3" /> {p.blood_type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            tone="blue"
                            title="View EMR"
                            onClick={() => navigate(`/patients/${p.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            tone="amber"
                            title="Edit"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            tone="red"
                            title="Delete"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
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
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} gradient={genderGradient(p.gender)} />
                    <div>
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        {p.id} · {p.age} yrs · {p.gender}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {p.phone}
                  </span>
                  <span className="flex items-center gap-1 text-[#C0392B]">
                    <Droplet className="h-3.5 w-3.5" /> {p.blood_type}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => navigate(`/patients/${p.id}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1E88E5]/10 py-2 text-xs font-semibold text-[#1E88E5]"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#F1C40F]/15 py-2 text-xs font-semibold text-[#B8860B]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E74C3C]/10 px-3 py-2 text-xs font-semibold text-[#C0392B]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ---------------- REGISTER / EDIT MODAL ---------------- */}
      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title={editing ? "Edit Patient" : "Register New Patient"}
        subtitle={
          editing
            ? `${editing.id} · ${editing.name}`
            : "A unique Patient ID is generated automatically"
        }
        icon={<UserPlus className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" required className="sm:col-span-2">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Amara Ochieng"
            />
          </Field>
          <Field label="Age" required>
            <input
              type="number"
              className={inputCls}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="34"
            />
          </Field>
          <Field label="Gender">
            <select
              className={inputCls}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Phone Number" required>
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+254 7XX XXX XXX"
            />
          </Field>
          <Field label="National ID">
            <input
              className={inputCls}
              value={form.national_id}
              onChange={(e) => setForm({ ...form, national_id: e.target.value })}
              placeholder="29481023"
            />
          </Field>
          <Field label="Emergency Contact">
            <input
              className={inputCls}
              value={form.emergency_contact}
              onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
              placeholder="+254 7XX XXX XXX (Relation)"
            />
          </Field>
          <Field label="Address">
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Westlands, Nairobi"
            />
          </Field>
          <Field label="Blood Type">
            <select
              className={inputCls}
              value={form.blood_type}
              onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
            >
              {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Insurance">
            <input
              className={inputCls}
              value={form.insurance}
              onChange={(e) => setForm({ ...form, insurance: e.target.value })}
              placeholder="NHIF / Jubilee"
            />
          </Field>
          <Field label="Status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as PatientStatus })
              }
            >
              <option>Active</option>
              <option>Inactive</option>
              <option>Admitted</option>
              <option>Discharged</option>
            </select>
          </Field>
          <Field label="Allergies (comma separated)" className="sm:col-span-2">
            <input
              className={inputCls}
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              placeholder="Penicillin, Sulfa drugs"
            />
          </Field>
          <Field label="Conditions (comma separated)" className="sm:col-span-2">
            <input
              className={inputCls}
              value={form.conditions}
              onChange={(e) => setForm({ ...form, conditions: e.target.value })}
              placeholder="Hypertension, Asthma"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            onClick={() => setRegisterOpen(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1E88E5]/30 transition hover:from-[#1976D2] hover:to-[#42A5F5] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editing ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {editing ? "Save Changes" : "Register Patient"}
          </button>
        </div>
      </Modal>

      {/* ---------------- VIEW MODAL ---------------- */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Patient Profile"
        subtitle="Electronic Medical Record"
        icon={<Eye className="h-5 w-5" />}
        size="lg"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1E88E5]/5 to-[#64B5F6]/5 p-5 sm:flex-row sm:items-center">
              <Avatar
                name={viewing.name}
                gradient={genderGradient(viewing.gender)}
                size="lg"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{viewing.name}</h3>
                  <StatusBadge status={viewing.status} />
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#E74C3C]/10 px-2 py-0.5 text-xs font-semibold text-[#C0392B]">
                    <Droplet className="h-3 w-3" /> {viewing.blood_type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {viewing.id} · {viewing.gender}, {viewing.age} yrs
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={Phone} label="Phone" value={viewing.phone} />
              <InfoRow icon={IdCard} label="National ID" value={viewing.national_id || "—"} />
              <InfoRow icon={MapPin} label="Address" value={viewing.address || "—"} />
              <InfoRow icon={ShieldCheck} label="Insurance" value={viewing.insurance || "—"} />
              <InfoRow icon={Siren} label="Emergency" value={viewing.emergency_contact || "—"} />
              <InfoRow
                icon={CalendarClock}
                label="Registered"
                value={formatDate(viewing.registered_at)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TagBlock
                title="Allergies"
                items={toList(viewing.allergies)}
                tone="red"
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <TagBlock
                title="Conditions"
                items={toList(viewing.conditions)}
                tone="blue"
                icon={<HeartPulse className="h-4 w-4" />}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setViewing(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={() => openEdit(viewing)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1976D2]"
              >
                <Pencil className="h-4 w-4" /> Edit Record
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- DELETE MODAL ---------------- */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete Patient"
        subtitle="This action cannot be undone"
        icon={<Trash2 className="h-5 w-5" />}
      >
        {deleting && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-[#E74C3C]/5 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E74C3C]/10 text-[#E74C3C]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-600">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-slate-900">{deleting.name}</span>{" "}
                ({deleting.id})? All associated records will be removed.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={confirmDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E74C3C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#C0392B] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Patient
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
              toast.type === "success"
                ? "bg-[#2ECC71]"
                : toast.type === "error"
                ? "bg-[#E74C3C]"
                : "bg-[#1E88E5]"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : toast.type === "error" ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
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
  icon: typeof Users;
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
      className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-lg shadow-[#1E88E5]/5 backdrop-blur-md"
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 transition group-hover:scale-150`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-3xl font-bold tracking-tight text-transparent`}>
            {display.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400">{delta}</p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}

function Avatar({
  name,
  gradient,
  size = "md",
}: {
  name: string;
  gradient: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white`}
      style={{ ...{ width: undefined } }}
    >
      <span className={sizes[size]}>{initials(name)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: PatientStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.chip}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.dot }}
      />
      {status}
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
    <button
      title={title}
      onClick={onClick}
      className={`rounded-lg p-2 transition ${tones[tone]}`}
    >
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

function TagBlock({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[];
  tone: "red" | "blue";
  icon: React.ReactNode;
}) {
  const tones = {
    red: "border-[#E74C3C]/20 bg-[#E74C3C]/5 text-[#C0392B]",
    blue: "border-[#1E88E5]/20 bg-[#1E88E5]/5 text-[#1E88E5]",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((it) => (
            <span
              key={it}
              className="rounded-lg bg-white/70 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-slate-200"
            >
              {it}
            </span>
          ))
        ) : (
          <span className="text-xs opacity-60">None recorded</span>
        )}
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
            value === o
              ? "bg-white text-[#1E88E5] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${
              size === "lg" ? "max-w-2xl" : "max-w-xl"
            }`}
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
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
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
