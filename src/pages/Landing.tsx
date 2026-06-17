import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import doctorHero from "/images/doctor-hero.jpg";
import {
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  FlaskConical,
  Pill,
  CalendarDays,
  Users,
  Clock,
  Ambulance,
  Award,
  Star,
  Activity,
  Microscope,
  Lock,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
  Zap,
} from "lucide-react";

/* ---------- data ---------- */
const FEATURES = [
  {
    icon: Stethoscope,
    title: "Expert Specialists",
    desc: "Board-certified doctors across cardiology, pediatrics, neurology & more — available 24/7.",
    color: "from-[#1E88E5] to-[#64B5F6]",
  },
  {
    icon: FlaskConical,
    title: "On-Site Laboratory",
    desc: "Accurate diagnostics with same-day results for blood, malaria, COVID and advanced panels.",
    color: "from-[#2ECC71] to-[#58D68D]",
  },
  {
    icon: Pill,
    title: "24/7 Pharmacy",
    desc: "A fully stocked in-house pharmacy with automated dispensing and home delivery.",
    color: "from-[#F1C40F] to-[#F39C12]",
  },
  {
    icon: ShieldCheck,
    title: "Secure EMR",
    desc: "Your medical records are digitized, encrypted and accessible to your care team instantly.",
    color: "from-[#E74C3C] to-[#EC7063]",
  },
  {
    icon: CalendarDays,
    title: "Easy Appointments",
    desc: "Book, reschedule and get SMS reminders — all from one seamless digital platform.",
    color: "from-violet-500 to-purple-600",
  },
  {
    icon: Ambulance,
    title: "Emergency Ready",
    desc: "Rapid-response emergency unit and ambulance services ready when minutes matter most.",
    color: "from-[#1ABC9C] to-teal-600",
  },
];

const STATS = [
  { icon: Users, value: "10,000+", label: "Patients Served" },
  { icon: Stethoscope, value: "20+", label: "Specialist Doctors" },
  { icon: Award, value: "9+", label: "Years of Excellence" },
  { icon: Activity, value: "99.9%", label: "Care Satisfaction" },
];

const DEPARTMENTS = [
  "Cardiology", "Pediatrics", "Neurology", "Orthopedics",
  "Obstetrics & Gynecology", "Dermatology", "General Medicine", "Emergency Care",
  "Laboratory", "Pharmacy", "Radiology", "ENT",
];

const STEPS = [
  { icon: Users, title: "Register", desc: "Create your patient profile in under 2 minutes." },
  { icon: CalendarDays, title: "Book", desc: "Choose your doctor, department & preferred time." },
  { icon: Stethoscope, title: "Consult", desc: "Meet your specialist and get a diagnosis." },
  { icon: CheckCircle2, title: "Heal", desc: "Collect medication & results — all tracked digitally." },
];

const TESTIMONIALS = [
  {
    name: "Amara Ochieng",
    role: "Patient",
    text: "From booking to the pharmacy, everything was on one platform. The SMS reminders meant I never missed my follow-up. Truly modern healthcare.",
    rating: 5,
  },
  {
    name: "David Otieno",
    role: "Cardiac Patient",
    text: "The doctors had my full history the moment I walked in — allergies, past visits, lab results. I felt genuinely cared for.",
    rating: 5,
  },
  {
    name: "Fatuma Abdi",
    role: "Mother of two",
    text: "Booking pediatric appointments for my kids is now effortless. The staff are warm and the facilities are spotless.",
    rating: 5,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

/* ---------- component ---------- */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-800">
      {/* ============ NAVBAR ============ */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "py-2" : "py-4"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 ${
              scrolled
                ? "border border-white/40 bg-white/70 shadow-lg shadow-[#1E88E5]/10 backdrop-blur-xl"
                : "bg-white/10 backdrop-blur-md"
            }`}
          >
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] shadow-lg shadow-[#1E88E5]/30">
                <HeartPulse className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Medi<span className="text-[#1E88E5]">Core</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              {["Features", "Departments", "How it works", "Reviews"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm font-medium text-slate-600 transition hover:text-[#1E88E5]"
                >
                  {item}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <Link
                to="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-[#1E88E5]"
              >
                Sign in
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1E88E5]/30 transition hover:shadow-xl hover:shadow-[#1E88E5]/40"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button
              onClick={() => setMobileMenu(true)}
              className="rounded-lg p-2 text-slate-700 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* mobile menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenu(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-full w-72 border-l border-white/40 bg-white/90 p-6 backdrop-blur-xl"
            >
              <button onClick={() => setMobileMenu(false)} className="mb-8 rounded-lg p-2 text-slate-500">
                <X className="h-6 w-6" />
              </button>
              <nav className="flex flex-col gap-4">
                {["Features", "Departments", "How it works", "Reviews"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setMobileMenu(false)}
                    className="text-base font-medium text-slate-700"
                  >
                    {item}
                  </a>
                ))}
                <Link to="/login" className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-5 py-3 text-sm font-semibold text-white">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ HERO ============ */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        {/* background image */}
        <div className="absolute inset-0">
          <img
            src={doctorHero}
            alt="Smiling doctor with stethoscope"
            className="h-full w-full object-cover object-center"
          />
          {/* overlays for readability + blue glass tint */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-slate-900/30" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pt-28 sm:px-6">
          <div className="max-w-2xl">
            {/* glass badge */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-md"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2ECC71] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2ECC71]" />
              </span>
              Trusted by 10,000+ patients across Kenya
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="show"
              className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              MediCore Healthcare,{" "}
              <span className="bg-gradient-to-r from-[#64B5F6] to-[#2ECC71] bg-clip-text text-transparent">
                Made Effortless
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="show"
              className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200"
            >
              MediCore brings every part of your hospital journey into one
              intelligent platform — from booking and consultations to lab results,
              pharmacy and billing. Better care, fewer delays, all in real time.
            </motion.p>

            {/* glass CTA */}
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-col gap-4 sm:flex-row"
            >
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E88E5] to-[#64B5F6] px-7 py-4 text-base font-semibold text-white shadow-xl shadow-[#1E88E5]/40 transition hover:scale-[1.03]"
              >
                Access Portal <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
              >
                Explore Services
              </a>
            </motion.div>

            {/* quick trust points */}
            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="show"
              className="mt-10 flex flex-wrap gap-6"
            >
              {[
                { icon: Clock, text: "24/7 Care" },
                { icon: Lock, text: "Secure Records" },
                { icon: Zap, text: "Real-time Tracking" },
              ].map((t) => (
                <div key={t.text} className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <t.icon className="h-4 w-4 text-[#64B5F6]" /> {t.text}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* scroll hint */}
        <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/40 p-1.5"
          >
            <div className="h-2 w-1 rounded-full bg-white/70" />
          </motion.div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="relative -mt-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 gap-4 rounded-3xl border border-white/40 bg-white/60 p-6 shadow-2xl shadow-[#1E88E5]/10 backdrop-blur-xl sm:gap-6 md:grid-cols-4 sm:p-8"
          >
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-white shadow-lg">
                  <s.icon className="h-6 w-6" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            tag="Why MediCore"
            title="Everything you need under one roof"
            subtitle="A unified hospital management system that connects patients, doctors, pharmacy and lab — so care never waits."
          />
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ y: -8 }}
                className="group relative overflow-hidden rounded-3xl border border-[#1E88E5]/10 bg-gradient-to-b from-white to-[#EAF4FE]/40 p-6 shadow-lg shadow-slate-200/50 transition hover:shadow-xl hover:shadow-[#1E88E5]/10"
              >
                <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${f.color} opacity-10 transition group-hover:scale-150`} />
                <div className={`relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${f.color} text-white shadow-lg`}>
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="relative text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DEPARTMENTS ============ */}
      <section id="departments" className="bg-gradient-to-b from-[#EAF4FE]/60 to-white px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            tag="Our Departments"
            title="Specialized care for every need"
            subtitle="From routine check-ups to complex procedures, our departments are staffed by leading specialists."
          />
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {DEPARTMENTS.map((d, i) => (
              <motion.div
                key={d}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-[#1E88E5]/30 hover:text-[#1E88E5]"
              >
                <Microscope className="h-4 w-4 text-[#1E88E5]" /> {d}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            tag="How it works"
            title="Your care journey in 4 simple steps"
            subtitle="A seamless digital experience from the moment you register to the moment you heal."
          />
          <div className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* connecting line */}
            <div className="absolute left-0 top-8 hidden h-0.5 w-full bg-gradient-to-r from-[#1E88E5]/20 via-[#1E88E5]/40 to-[#2ECC71]/20 lg:block" />
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative text-center"
              >
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/50 bg-white/70 shadow-lg backdrop-blur-md">
                  <s.icon className="h-7 w-7 text-[#1E88E5]" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] text-xs font-bold text-white shadow-md">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section id="reviews" className="bg-gradient-to-b from-white to-[#EAF4FE]/60 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            tag="Patient Stories"
            title="Loved by the people we care for"
            subtitle="Real experiences from patients who chose MediCore for their healthcare."
          />
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="rounded-3xl border border-white/50 bg-white/70 p-6 shadow-lg shadow-slate-200/50 backdrop-blur-md"
              >
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-[#F1C40F] text-[#F1C40F]" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-600">"{t.text}"</p>
                <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1E88E5] to-[#64B5F6] font-bold text-white">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="px-4 py-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#64B5F6] p-10 text-center shadow-2xl shadow-[#1E88E5]/30 sm:p-16"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-[#2ECC71]/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Your health deserves a smarter hospital
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-50">
              Join thousands of patients experiencing faster, safer and more connected care with MediCore.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-[#1E88E5] shadow-xl transition hover:scale-[1.03]"
            >
              Get Started Today <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-slate-200 bg-slate-900 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E88E5] to-[#64B5F6]">
                  <HeartPulse className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-extrabold text-white">
                  Medi<span className="text-[#64B5F6]">Core</span>
                </span>
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Modern, connected and compassionate healthcare — all in one intelligent platform.
              </p>
            </div>

            <FooterCol
              title="Services"
              links={["Appointments", "Laboratory", "Pharmacy", "Emergency Care"]}
            />
            <FooterCol
              title="Departments"
              links={["Cardiology", "Pediatrics", "Neurology", "General Medicine"]}
            />

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Contact</h4>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#64B5F6]" /> +254 700 000 000</li>
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#64B5F6]" /> care@medicore.co.ke</li>
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#64B5F6]" /> Westlands, Nairobi</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row">
            <p className="text-xs text-slate-500">© 2026 MediCore Health Systems. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-slate-500">
              <a href="#" className="transition hover:text-slate-300">Privacy Policy</a>
              <a href="#" className="transition hover:text-slate-300">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function SectionHeading({ tag, title, subtitle }: { tag: string; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl text-center"
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-[#1E88E5]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#1E88E5]">
        <Stethoscope className="h-3.5 w-3.5" /> {tag}
      </span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base text-slate-500">{subtitle}</p>
    </motion.div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h4>
      <ul className="space-y-3 text-sm text-slate-400">
        {links.map((l) => (
          <li key={l}>
            <a href="#features" className="transition hover:text-[#64B5F6]">{l}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
