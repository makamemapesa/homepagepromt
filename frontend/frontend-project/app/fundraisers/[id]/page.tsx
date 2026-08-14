"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Heart, Target, Users, ArrowLeft, CheckCircle2, Calendar, ExternalLink, X } from "lucide-react"
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

interface Donation {
  id: number
  displayName: string
  amount: string
  message: string
  createdAt: string
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  )
}

export default function FundraiserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null)
  const [recentDonations, setRecentDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Donation form state
  const [donateSuccess, setDonateSuccess] = useState(false)
  const [donating, setDonating] = useState(false)
  const [donateError, setDonateError] = useState("")
  const [donateForm, setDonateForm] = useState({
    name: "", email: "", amount: "", message: "", isAnonymous: false,
  })

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE_URL}/api/fundraisers/${id}/`)
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => setFundraiser(convertKeys(data) as Fundraiser))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fundraiser) return
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
          fundraiser:   fundraiser.id,
          donor_name:   donateForm.isAnonymous ? "Anonymous" : donateForm.name.trim(),
          donor_email:  donateForm.email.trim(),
          amount:       donateForm.amount,
          message:      donateForm.message.trim(),
          is_anonymous: donateForm.isAnonymous,
        }),
      })
      if (!res.ok) throw new Error()
      setDonateSuccess(true)
      // Scroll to success
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100)
    } catch {
      setDonateError("Failed to submit. Please check your connection and try again.")
    } finally {
      setDonating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fb" }}>
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading fundraiser...</p>
        </div>
      </div>
    )
  }

  if (notFound || !fundraiser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fb" }}>
        <div className="text-center">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-900 mb-2">Fundraiser Not Found</h2>
          <p className="text-gray-500 mb-6">The campaign you're looking for doesn't exist.</p>
          <Link href="/fundraisers">
            <Button className="bg-accent hover:bg-accent/90 text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fundraisers
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const color = CATEGORY_COLORS[fundraiser.category] ?? "var(--accent)"
  const isComplete = fundraiser.status === "completed"

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
                  n.href === "/fundraisers" ? "text-accent font-bold" : "text-white/55 hover:text-white"
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

      {/* ── HERO / HEADER ───────────────────────────────────────── */}
      <section className="relative pt-16" style={{ background: "oklch(0.11 0.03 250)" }}>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Link href="/fundraisers" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to All Fundraisers
          </Link>
          
          <span className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-white mb-3"
            style={{ background: color }}>
            {CATEGORY_LABELS[fundraiser.category] ?? fundraiser.category}
          </span>

          <h1 className="font-black text-white mb-3"
            style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(2rem, 4.5vw, 3rem)", lineHeight: 1.1 }}>
            {fundraiser.title}
          </h1>
          
          {fundraiser.shortDesc && (
            <p className="text-[15px] text-white/65 mb-5 leading-relaxed max-w-2xl">
              {fundraiser.shortDesc}
            </p>
          )}

          {/* Progress summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: Target,       label: "Goal",     value: fmt(fundraiser.goalAmount) },
              { icon: Heart,        label: "Raised",   value: fmt(fundraiser.raisedAmount) },
              { icon: Users,        label: "Donors",   value: fundraiser.donorCount },
              { icon: CheckCircle2, label: "Progress", value: `${fundraiser.progressPercent}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-accent" />
                  <p className="text-[11px] text-white/50 uppercase tracking-wide">{label}</p>
                </div>
                <p className="text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <ProgressBar pct={fundraiser.progressPercent} color={color} />
          <p className="text-xs text-white/40 mt-2">
            {fundraiser.progressPercent}% of {fmt(fundraiser.goalAmount)} goal achieved
          </p>
        </div>

        {/* Image banner */}
        {fundraiser.imageUrl && (
          <div className="relative h-64 md:h-80 overflow-hidden">
            <Image src={fundraiser.imageUrl} alt={fundraiser.title} fill className="object-cover opacity-40" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, oklch(0.11 0.03 250), transparent 50%, oklch(0.11 0.03 250))" }} />
          </div>
        )}
      </section>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left: Full description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-2xl font-black text-gray-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                About This Campaign
              </h2>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                {fundraiser.description}
              </div>

              {/* Dates */}
              {(fundraiser.startDate || fundraiser.endDate) && (
                <div className="mt-6 pt-6 border-t flex flex-wrap gap-4 text-sm text-gray-500">
                  {fundraiser.startDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Started: {fmtDate(fundraiser.startDate)}</span>
                    </div>
                  )}
                  {fundraiser.endDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Ends: {fmtDate(fundraiser.endDate)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Donation form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sticky top-20">
              {donateSuccess ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
                  <h3 className="text-xl font-black text-gray-900 mb-2">Thank You!</h3>
                  <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                    Your support has been recorded. May Allah reward you abundantly.
                  </p>
                  <button
                    onClick={() => {
                      setDonateSuccess(false)
                      setDonateForm({ name: "", email: "", amount: "", message: "", isAnonymous: false })
                    }}
                    className="text-sm font-semibold px-5 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Submit Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDonate} className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                      Support This Cause
                    </h3>
                    <p className="text-xs text-gray-500">Every contribution makes a difference</p>
                  </div>

                  {/* Anonymous toggle */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={donateForm.isAnonymous}
                      onChange={e => setDonateForm(f => ({ ...f, isAnonymous: e.target.checked }))}
                      className="h-4 w-4"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Give anonymously</p>
                      <p className="text-xs text-gray-500">Your name won't be shown</p>
                    </div>
                  </label>

                  {/* Name */}
                  {!donateForm.isAnonymous && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
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
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
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
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
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
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                      Message (optional)
                    </label>
                    <textarea
                      value={donateForm.message}
                      onChange={e => setDonateForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Leave a word of encouragement..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none resize-none focus:border-green-500 transition-colors"
                    />
                  </div>

                  {donateError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{donateError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={donating || isComplete}
                    className="w-full h-10 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                    style={{ background: color }}
                  >
                    {donating ? "Submitting…" : isComplete ? "Campaign Completed" : "Submit Support"}
                    <Heart className="h-4 w-4" fill="currentColor" />
                  </button>

                  {fundraiser.donateUrl && (
                    <a href={fundraiser.donateUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <button
                        type="button"
                        className="w-full h-9 rounded-lg text-sm font-semibold border-2 transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
                        style={{ borderColor: color, color }}
                      >
                        External Donation Link <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </a>
                  )}
                </form>
              )}
            </div>
          </div>

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
          <p className="text-[11px] text-white/20">
            © {new Date().getFullYear()} AL NAMAA ACADEMY
          </p>
        </div>
      </footer>

    </div>
  )
}
