import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Zap,
  Activity,
  Users,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  Star,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import nurseHero from "/images/nurse-hero.jpg";

/* ---------- showcase content ---------- */
const TRUST_STATS = [
  { icon: Users, value: "58,000+", label: "Patients" },
  { icon: Stethoscope, value: "120+", label: "Doctors" },
  { icon: Activity, value: "99.9%", label: "Uptime" },
];

const PERKS = [
  { icon: Zap, title: "Real-time Care", desc: "Live updates across every department." },
  { icon: ShieldCheck, title: "Bank-grade Security", desc: "Your records, fully encrypted." },
  { icon: CheckCircle2, title: "Seamless Workflow", desc: "Book, treat, dispense & bill in one flow." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(
        message.includes("Invalid login credentials")
          ? "Incorrect email or password. Make sure your account is confirmed."
          : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-stretch overflow-hidden bg-slate-950">
      {/* ============================ LEFT — BRANDING SHOWCASE ============================ */}
      <div className="relative hidden w-1/2 lg:block">
        {/* background image */}
        <img src={nurseHero} alt="MediCore care team" className="absolute inset-0 h-full w-full object-cover" />
        {/* gradient + blue glass tint overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E88E5]/90 via-[#1976D2]/80 to-slate-900/85" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

        {/* content */}
        <div className="relative flex h-full flex-col justify-between p-12">
          {/* logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
              <HeartPulse className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-2xl font-extrabold leading-none text-white">
                Medi<span className="text-[#90CAF9]">Core</span>
              </p>
              <p className="text-xs text-blue-100/80">Hospital Management System</p>
            </div>
          </motion.div>

          {/* headline + perks */}
          <div className="max-w-md">
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="text-4xl font-extrabold leading-tight text-white xl:text-5xl"
            >
              The future of healthcare,{" "}
              <span className="bg-gradient-to-r from-[#90CAF9] to-[#2ECC71] bg-clip-text text-transparent">
                in one platform
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="show"
              className="mt-4 text-base leading-relaxed text-blue-50/90"
            >
              Sign in to manage appointments, consultations, lab results, pharmacy
              and billing — all in real time, from anywhere.
            </motion.p>

            <div className="mt-8 space-y-3">
              {PERKS.map((p, i) => (
                <motion.div
                  key={p.title}
                  variants={fadeUp}
                  custom={i + 2}
                  initial="hidden"
                  animate="show"
                  className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-blue-100/70">{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* trust stats */}
          <motion.div
            variants={fadeUp}
            custom={5}
            initial="hidden"
            animate="show"
            className="flex gap-6 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md"
          >
            {TRUST_STATS.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <s.icon className="h-5 w-5 text-[#2ECC71]" />
                <div>
                  <p className="text-lg font-extrabold leading-none text-white">{s.value}</p>
                  <p className="text-[11px] text-blue-100/70">{s.label}</p>
                </div>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-100/80">
              <Star className="h-4 w-4 fill-[#F1C40F] text-[#F1C40F]" />
              <span className="font-bold text-white">4.9</span> rated
            </div>
          </motion.div>
        </div>
      </div>

      {/* ============================ RIGHT — GLASS LOGIN FORM ============================ */}
      {/* ambient gradient blobs for mobile (left panel hidden) */}
      <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-[#1E88E5]/30 blur-3xl lg:hidden" />
      <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#2ECC71]/20 blur-3xl lg:hidden" />

      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        {/* glass card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md rounded-3xl border border-white/40 bg-white/20 p-8 shadow-2xl shadow-[#1E88E5]/20 backdrop-blur-2xl sm:p-10"
        >
          {/* mobile logo */}
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] shadow-lg">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-white">
              Medi<span className="text-[#64B5F6]">Core</span>
            </span>
          </Link>

          <div className="text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2ECC71]/20 px-3 py-1 text-xs font-semibold text-[#A5D6A7] ring-1 ring-inset ring-[#2ECC71]/40">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2ECC71] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2ECC71]" />
              </span>
              Secure Portal
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-blue-50/80">
              Sign in to continue to your dashboard
            </p>
          </div>

          {/* error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mt-5 flex items-start gap-2 rounded-xl border border-[#E74C3C]/40 bg-[#E74C3C]/15 p-3 text-sm text-[#FCA5A5] backdrop-blur-md"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* form */}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {/* email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-blue-50/80">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-blue-100/70" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@medicore.co.ke"
                  className="w-full rounded-xl border border-white/30 bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-blue-100/50 backdrop-blur-md focus:border-[#64B5F6] focus:bg-white/15 focus:ring-2 focus:ring-[#1E88E5]/40"
                />
              </div>
            </div>

            {/* password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold text-blue-50/80">Password</label>
                <button type="button" className="text-xs font-medium text-[#90CAF9] transition hover:text-white">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-blue-100/70" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/30 bg-white/10 py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-blue-100/50 backdrop-blur-md focus:border-[#64B5F6] focus:bg-white/15 focus:ring-2 focus:ring-[#1E88E5]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-100/70 transition hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* remember */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-blue-50/80">
              <input type="checkbox" className="h-4 w-4 rounded border-white/40 bg-white/10 accent-[#1E88E5]" />
              Keep me signed in
            </label>

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1E88E5]/40 transition hover:shadow-xl hover:shadow-[#1E88E5]/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4.5 w-4.5 transition group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-xs text-blue-50/60">Protected by MediCore Security</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>

          {/* security note */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-blue-50/70 backdrop-blur-md">
            <ShieldCheck className="h-4 w-4 text-[#2ECC71]" />
            Your session is encrypted end-to-end with enterprise-grade security.
          </div>

          {/* back to site */}
          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-blue-50/80 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
