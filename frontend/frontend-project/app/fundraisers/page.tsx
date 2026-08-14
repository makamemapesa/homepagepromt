"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Heart, Target, Users, ArrowRight, CheckCircle2, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const NAV_LINKS = [
  { label: "About",       href: "/#about" },
  { label: "Programs",    href: "/#programs" },
  { label: "Admissions",  href: "/#admissions" },
  { label: "News",        href: "/#news" },
  { label: "Support",     href: "/support" },
  { label: "Team",        href: "/team" },
  { label: "Fundraisers", href: "/fundraisers" },
  { label: "Contact",     href: "/#contact" },
]

const CATEGORY_LABELS: Record<string, string> = {
  building:   "Building",
  education:  "Education",
  orphans:    "Orphan Support",
  equipment:  "Equipment",
  emergency:  "Emergency",
  general:    "General",
}

const CATEGORY_COLORS: Record<string, string> = {
  building:  "#2563eb",
  education: "#7c3aed",
  orphans:   "#db2777",
  equipment: "#0369a1",
  emergency: "#dc2626",
  general:   "var(--accent)",
}

interface Fundraiser {
  id: number
  title: string
  slug: string
  category: string
  description: string
  shortDesc: string
  goalAmount: string
  raisedAmount: string
  donorCount: number
  imageUrl: string | null
  status: string
  isFeatured: boolean
  startDate: string | null
  endDate: string | null
  donateUrl: string
  progressPercent: number
}

function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}
function convertKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(convertKeys)
  if (obj !== null && typeof obj === "object")
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toCamel(k), convertKeys(v)])
    )
  return obj
}

function fmt(n: string | number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  )
}

export default function FundraisersPage() {
  const pathname = usePathname()
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([])
  const [activeTab, setActiveTab]     = useState("all")
  const [loading, setLoading]         = useState(true)

  // Donation / support modal
  const [donateTarget, setDonateTarget] = useState<Fundraiser | null>(null)
  const [donateSuccess, setDonateSuccess] = useState(false)
  const [donating, setDonating]           = useState(false)
  const [donateError, setDonateError]     = useState("")
  const [donateForm, setDonateForm]       = useState({
    name: "", email: "", amount: "", message: "", isAnonymous: false,
  })

  const openDonate = (f: Fundraiser) => {
    setDonateTarget(f)
    setDonateSuccess(false)
    setDonateError("")
    setDonateForm({ name: "", email: "", amount: "", message: "", isAnonymous: false })
  }

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!donateTarget) return
    if (!donateForm.isAnonymous && !donateForm.name.trim()) {
      setDonateError("Please enter your name or choose \"Give anonymously\".")
      return
    }
    if (!donateForm.amount || Number(donateForm.amount) <= 0) {
      setDonateError("Please enter a valid donation amount.")
      return
    }
    setDonating(true); setDonateError("")
    try {
      const res = await fetch(`${BASE_URL}/api/donations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundraiser:   donateTarget.id,
          donor_name:   donateForm.isAnonymous ? "Anonymous" : donateForm.name.trim(),
          donor_email:  donateForm.email.trim(),
          amount:       donateForm.amount,
          message:      donateForm.message.trim(),
          is_anonymous: donateForm.isAnonymous,
        }),
      })
      if (!res.ok) throw new Error()
      setDonateSuccess(true)
    } catch {
      setDonateError("Failed to submit. Please check your connection and try again.")
    } finally {
      setDonating(false)
    }
  }

  useEffect(() => {
    fetch(`${BASE_URL}/api/fundraisers/`)
      .then(r => r.ok ? r.json() : { results: [] })
      .then(data => {
        const list = data.results ?? data
        setFundraisers(convertKeys(list) as Fundraiser[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories  = ["all", ...Array.from(new Set(fundraisers.map(f => f.category)))]
  const filtered    = activeTab === "all" ? fundraisers : fundraisers.filter(f => f.category === activeTab)
  const featured    = fundraisers.filter(f => f.isFeatured)

  const totalGoal    = fundraisers.reduce((s, f) => s + Number(f.goalAmount), 0)
  const totalRaised  = fundraisers.reduce((s, f) => s + Number(f.raisedAmount), 0)
  const totalDonors  = fundraisers.reduce((s, f) => s + f.donorCount, 0)
  const overallPct   = totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#f8f9fb" }}>

      {/* ── NAV ────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 border-b border-white/8 backdrop-blur-xl"
        style={{ background: "oklch(0.13 0.03 250 / 0.96)" }}
      >
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/farouk-logo.jpeg" alt="AL NAMAA ACADEMY" width={36} height={36}
              className="rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-accent/50 transition-all duration-300" />
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold text-white leading-tight">AL NAMAA ACADEMY</p>
              <p className="text-[10px] text-white/35 tracking-[0.15em] uppercase">Zanzibar • Expect Success</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((n) => (
              <Link key={n.label} href={n.href}
                className={`text-[13px] font-medium transition-colors duration-200 tracking-wide ${
                  pathname === n.href ? "text-accent font-bold" : "text-white/55 hover:text-white"
                }`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/login">
            <Button size="sm"
              className="text-[12px] bg-accent hover:bg-accent/90 text-white h-8 px-4 shadow-lg shadow-accent/20 font-semibold">
              Login
            </Button>
          </Link>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section
        className="relative flex items-center overflow-hidden pt-16"
        style={{ minHeight: "32vh", background: "oklch(0.11 0.03 250)" }}
      >
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(110deg, oklch(0.11 0.03 250 / 0.98) 45%, oklch(0.11 0.03 250 / 0.7) 100%)" }} />
        <div className="relative z-10 mx-auto max-w-7xl px-6 w-full py-12">
          <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-3">Make a Difference</p>
          <h1 className="font-black text-white mb-4"
            style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(2rem, 4.5vw, 3.2rem)", lineHeight: 1.08 }}>
            Support Our <span className="text-accent">Fundraisers</span>
          </h1>
          <p className="text-[14px] text-white/50 max-w-xl leading-relaxed">
            Every donation — big or small — brings us closer to providing quality education,
            safe facilities, and a better future for every child at AL NAMAA.
          </p>
        </div>
      </section>

      {/* ── IMPACT STATS ─────────────────────────────────────────── */}
      {!loading && fundraisers.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Target,       label: "Total Goal",    value: fmt(totalGoal) },
              { icon: Heart,        label: "Total Raised",  value: fmt(totalRaised) },
              { icon: Users,        label: "Total Donors",  value: totalDonors.toLocaleString() },
              { icon: CheckCircle2, label: "Overall Progress", value: `${overallPct}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "oklch(0.65 0.18 155 / 0.08)" }}>
                  <Icon className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <p className="text-[20px] font-black text-gray-900">{value}</p>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FEATURED ─────────────────────────────────────────────── */}
      {!loading && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-6">
          <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Featured Campaigns</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featured.map(f => {
              const color = CATEGORY_COLORS[f.category] ?? "var(--accent)"
              return (
                <div key={f.id}
                  className="relative overflow-hidden rounded-2xl shadow-md flex flex-col"
                  style={{ background: "#1a2236" }}>
                  {f.imageUrl && (
                    <div className="relative h-44 overflow-hidden">
                      <Image src={f.imageUrl} alt={f.title} fill className="object-cover opacity-60" />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, #1a2236 100%)" }} />
                    </div>
                  )}
                  <div className="flex flex-col gap-3 p-6 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full w-fit text-white"
                      style={{ background: color }}>
                      {CATEGORY_LABELS[f.category] ?? f.category}
                    </span>
                    <h3 className="text-[18px] font-black text-white leading-snug"
                      style={{ fontFamily: "var(--font-heading)" }}>
                      {f.title}
                    </h3>
                    <p className="text-[13px] text-white/55 leading-relaxed line-clamp-2">
                      {f.shortDesc || f.description.slice(0, 120)}
                    </p>
                    <div className="mt-auto pt-3 flex flex-col gap-2">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-white/70">Raised: <strong className="text-white">{fmt(f.raisedAmount)}</strong></span>
                        <span className="text-white/50">Goal: {fmt(f.goalAmount)}</span>
                      </div>
                      <ProgressBar pct={f.progressPercent} color={color} />
                      <div className="flex justify-between items-center mt-1 text-[11px] text-white/40">
                        <span>{f.progressPercent}% funded</span>
                        <span>{f.donorCount} donors</span>
                      </div>
                      <Link href={`/fundraisers/${f.id}`} className="mt-2">
                        <Button className="w-full h-9 text-[13px] font-bold text-white rounded-lg"
                          style={{ background: color }}>
                          Learn More & Donate
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── ALL CAMPAIGNS ────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-6 pb-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-1">All Campaigns</p>
            <h2 className="text-2xl lg:text-3xl font-black text-gray-900"
              style={{ fontFamily: "var(--font-heading)" }}>
              Every Cause Matters
            </h2>
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button key={c} onClick={() => setActiveTab(c)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-bold border transition-all duration-200 ${
                    activeTab === c
                      ? "text-white border-transparent shadow-md"
                      : "bg-white border-gray-200 text-gray-500 hover:border-accent/50 hover:text-accent"
                  }`}
                  style={activeTab === c ? { background: "var(--accent)" } : {}}>
                  {c === "all" ? "All" : CATEGORY_LABELS[c] ?? c}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm animate-pulse h-64" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Heart className="h-12 w-12 text-gray-300" />
            <p className="text-gray-500 font-semibold">No fundraisers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(f => {
              const color = CATEGORY_COLORS[f.category] ?? "var(--accent)"
              const isComplete = f.status === "completed"
              return (
                <div key={f.id}
                  className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col">
                  {/* Image / placeholder */}
                  <div className="relative h-40 overflow-hidden flex-shrink-0"
                    style={{ background: "#eef2f7" }}>
                    {f.imageUrl ? (
                      <Image src={f.imageUrl} alt={f.title} fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Heart className="h-12 w-12 text-gray-200" />
                      </div>
                    )}
                    {/* Status badge */}
                    <span className={`absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                      isComplete ? "bg-green-100 text-green-700" : "text-white"
                    }`} style={!isComplete ? { background: color } : {}}>
                      {isComplete ? "Completed ✓" : f.status}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 p-5 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color }}>
                      {CATEGORY_LABELS[f.category] ?? f.category}
                    </span>
                    <h3 className="text-[15px] font-bold text-gray-900 leading-snug"
                      style={{ fontFamily: "var(--font-heading)" }}>
                      {f.title}
                    </h3>
                    <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 flex-1">
                      {f.shortDesc || f.description.slice(0, 100)}
                    </p>

                    <div className="mt-2 flex flex-col gap-1.5">
                      <ProgressBar pct={f.progressPercent} color={color} />
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span><strong className="text-gray-700">{fmt(f.raisedAmount)}</strong> raised</span>
                        <span>{f.progressPercent}% of {fmt(f.goalAmount)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Users className="h-3 w-3" />
                        <span>{f.donorCount} donors</span>
                      </div>
                    </div>

                    <Link href={`/fundraisers/${f.id}`} className="mt-2 block">
                      <Button className="w-full h-8 text-[12px] font-bold text-white rounded-lg"
                        style={{ background: color }}>
                        Learn More & Donate
                      </Button>
                    </Link>
                    {isComplete && (
                      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-green-600 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        Goal Achieved — Thank you!
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── DONATE CTA ───────────────────────────────────────────── */}
      <section className="py-12" style={{ background: "#1a2236" }}>
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--accent)" }} />
          <h2 className="text-2xl lg:text-3xl font-black text-white mb-3"
            style={{ fontFamily: "var(--font-heading)" }}>
            Want to Support a Specific Cause?
          </h2>
          <p className="text-[13px] text-white/50 leading-relaxed mb-6">
            Reach out to us and we will guide you on how to make the biggest impact.
          </p>
          <Link href="/#contact">
            <Button className="h-10 px-8 text-[13px] font-bold text-white rounded-lg"
              style={{ background: "var(--accent)" }}>
              Contact Us <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="py-6" style={{ background: "oklch(0.10 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <Image src="/farouk-logo.jpeg" alt="AL NAMAA ACADEMY" width={34} height={34}
              className="rounded-lg object-cover ring-1 ring-white/10" />
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">AL NAMAA ACADEMY</p>
              <p className="text-[10px] text-white/35 mt-0.5">Kisauni, Zanzibar • Est. 2020</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href}
                className="text-[12px] text-white/35 hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-white/20">
            © {new Date().getFullYear()} AL NAMAA ACADEMY
          </p>
        </div>
      </footer>

      {/* ── DONATE MODAL ──────────────────────────────────────────── */}
      {donateTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setDonateTarget(null) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
                  Support This Campaign
                </p>
                <h3 className="text-lg font-black text-gray-900 leading-snug"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  {donateTarget.title}
                </h3>
              </div>
              <button onClick={() => setDonateTarget(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5 flex-shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>

            {donateSuccess ? (
              <div className="p-10 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
                <h4 className="text-xl font-black text-gray-900 mb-2">Thank you!</h4>
                <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">
                  Your support has been recorded. May Allah reward you abundantly.
                </p>
                <button
                  onClick={() => setDonateTarget(null)}
                  className="px-6 py-2 rounded-lg text-sm font-bold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleDonate} className="p-5 flex flex-col gap-4">
                {/* Anonymous toggle */}
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={donateForm.isAnonymous}
                    onChange={e => setDonateForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                    className="h-4 w-4"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Give anonymously</p>
                    <p className="text-xs text-gray-500">Your name will not be shown publicly</p>
                  </div>
                </label>

                {/* Name */}
                {!donateForm.isAnonymous && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required={!donateForm.isAnonymous}
                      value={donateForm.name}
                      onChange={e => setDonateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Ahmed Mohamed"
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-green-500 transition-colors"
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={donateForm.email}
                    onChange={e => setDonateForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-green-500 transition-colors"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                    Donation Amount (USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
                    <input
                      type="number" min="1" step="any" required
                      value={donateForm.amount}
                      onChange={e => setDonateForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      className="w-full h-10 pl-7 pr-3 rounded-lg border border-gray-200 text-sm outline-none focus:border-green-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
                    Message of Support (optional)
                  </label>
                  <textarea
                    value={donateForm.message}
                    onChange={e => setDonateForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Leave a word of encouragement for the school…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none resize-none focus:border-green-500 transition-colors"
                  />
                </div>

                {donateError && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{donateError}</p>
                )}

                <button
                  type="submit"
                  disabled={donating}
                  className="w-full h-10 rounded-lg text-[13px] font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: "var(--accent)" }}
                >
                  {donating ? "Submitting…" : "Submit Support"}
                  <Heart className="h-4 w-4" fill="currentColor" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
