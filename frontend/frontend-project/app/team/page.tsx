"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Mail, Phone, Linkedin, Users, ArrowRight } from "lucide-react"
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

const DEPT_LABELS: Record<string, string> = {
  leadership:     "Leadership",
  academic:       "Academic",
  administration: "Administration",
  support:        "Support Staff",
  board:          "Board of Directors",
}

interface TeamMember {
  id: number
  firstName: string
  lastName: string
  title: string
  department: string
  bio: string
  email: string
  phone: string
  linkedinUrl: string
  photoUrl: string | null
}

interface CEOMessage {
  id: number
  heading: string
  body: string
  authorName: string
  authorTitle: string
  photoUrl: string | null
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

export default function TeamPage() {
  const pathname = usePathname()
  const [members, setMembers]   = useState<TeamMember[]>([])
  const [ceoMsg, setCeoMsg]     = useState<CEOMessage | null>(null)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const onScroll = () => {
      const nav = document.querySelector("header")
      if (nav) nav.classList.toggle("nav-scrolled", window.scrollY > 60)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/team/members/`).then(r => r.ok ? r.json() : { results: [] }),
      fetch(`${BASE_URL}/api/team/ceo-message/active/`).then(r => r.ok ? r.json() : null),
    ]).then(([membersData, ceoData]) => {
      const list = membersData.results ?? membersData
      setMembers(convertKeys(list) as TeamMember[])
      if (ceoData) setCeoMsg(convertKeys(ceoData) as CEOMessage)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const departments = ["all", ...Array.from(new Set(members.map(m => m.department)))]
  const filtered    = activeTab === "all" ? members : members.filter(m => m.department === activeTab)

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#f8f9fb" }}>

      {/* â”€â”€ NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header
        className="fixed top-0 inset-x-0 z-50 border-b border-white/8 backdrop-blur-xl"
        style={{ background: "oklch(0.13 0.03 250 / 0.96)" }}
      >
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/farouk-logo.jpeg" alt="FAMS" width={36} height={36}
              className="rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-accent/50 transition-all duration-300" />
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold text-white leading-tight">Faruk Aktas Muslim School</p>
              <p className="text-[10px] text-white/35 tracking-[0.15em] uppercase">Zanzibar &bull; Expect Success</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
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

      {/* â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section
        className="relative flex items-center overflow-hidden pt-16"
        style={{ minHeight: "30vh", background: "oklch(0.11 0.03 250)" }}
      >
        <Image
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80"
          alt="Team" fill priority className="object-cover opacity-30"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, oklch(0.11 0.03 250 / 0.96) 40%, oklch(0.11 0.03 250 / 0.6) 100%)" }} />
        <div className="relative z-10 mx-auto max-w-7xl px-6 w-full py-10">
          <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-3">Our People</p>
          <h1 className="font-black text-white mb-4" style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(2rem, 4.5vw, 3.5rem)", lineHeight: 1.08 }}>
            Meet the <span className="text-accent">Team</span> Behind FAMS
          </h1>
          <p className="text-[14px] text-white/50 max-w-lg leading-relaxed">
            Dedicated educators, visionary leaders, and passionate professionals working
            together to build a world-class school community.
          </p>
        </div>
      </section>

      {/* â”€â”€ CEO LETTER BANNER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {ceoMsg && (
        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-2xl shadow-xl"
            style={{ minHeight: 340 }}>

            {/* Left – text panel (bottom on mobile, left on desktop) */}
            <div className="order-2 md:order-1 flex flex-col justify-center gap-3 p-8 lg:p-10"
              style={{ background: "#1a2236" }}>
              {/* Accent bar */}
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--accent)" }} />
              <h2 className="font-black text-white leading-[1.12]"
                style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>
                {ceoMsg.heading}
              </h2>
              <p className="text-accent font-semibold italic text-[15px]">
                â€” {ceoMsg.authorName}
              </p>
              <p className="text-white/55 text-[13px] leading-relaxed line-clamp-3">
                {ceoMsg.body.replace(/<[^>]+>/g, "").slice(0, 160)}â€¦
              </p>
              <Link href="#ceo-full">
                <Button className="mt-2 w-fit h-10 px-7 text-[13px] font-bold text-white rounded-lg"
                  style={{ background: "var(--accent)" }}>
                  Read Full Message <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Right – photo panel (top on mobile, right on desktop) */}
            <div className="order-1 md:order-2 relative min-h-[280px] md:min-h-0 overflow-hidden" style={{ background: "#e8edf3" }}>
              {ceoMsg.photoUrl ? (
                <Image src={ceoMsg.photoUrl} alt={ceoMsg.authorName} fill
                  className="object-cover object-top" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-10">
                  <div className="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-black text-white"
                    style={{ background: "var(--accent)" }}>
                    {ceoMsg.authorName.charAt(0)}
                  </div>
                  <p className="font-bold text-gray-600">{ceoMsg.authorName}</p>
                  <p className="text-[12px] text-gray-400 uppercase tracking-widest">{ceoMsg.authorTitle}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* â”€â”€ FULL CEO MESSAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {ceoMsg && (
        <section id="ceo-full" className="mx-auto max-w-7xl px-6 pb-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
            <p className="text-[11px] font-black text-accent uppercase tracking-[0.2em] mb-6">
              {ceoMsg.authorTitle} &middot; {ceoMsg.authorName}
            </p>
            <div
              className="text-[13px] text-gray-600 leading-[1.65] space-y-2"
              dangerouslySetInnerHTML={{ __html: ceoMsg.body.replace(/\n\n/g, "</p><p class='mt-3'>").replace(/\n/g, " ") }}
            />
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                style={{ background: "var(--accent)" }}>
                {ceoMsg.authorName.charAt(0)}
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-800">{ceoMsg.authorName}</p>
                <p className="text-[11px] text-gray-400 uppercase tracking-widest">{ceoMsg.authorTitle}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* â”€â”€ TEAM GRID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="mx-auto max-w-7xl px-6 py-8 pb-12">

        {/* Section heading + filter tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-6">
          <div>
            <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-2">Our People</p>
            <h2 className="text-3xl lg:text-4xl font-black text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
              Our Dedicated Team
            </h2>
          </div>
          {departments.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => (
                <button key={d} onClick={() => setActiveTab(d)}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-bold border transition-all duration-200 ${
                    activeTab === d
                      ? "text-white border-transparent shadow-md"
                      : "bg-white border-gray-200 text-gray-500 hover:border-accent/50 hover:text-accent"
                  }`}
                  style={activeTab === d ? { background: "var(--accent)" } : {}}>
                  {d === "all" ? "All" : DEPT_LABELS[d] ?? d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm animate-pulse h-80" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Users className="h-14 w-14 text-gray-300" />
            <p className="text-gray-500 font-semibold">No team members found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((member) => (
              <div key={member.id}
                className="group flex flex-col items-center text-center bg-white rounded-2xl shadow-sm border border-gray-100 px-6 pt-8 pb-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">

                {/* Circular photo */}
                <div className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white shadow-md mb-4 flex-shrink-0"
                  style={{ background: "#f0f4f8" }}>
                  {member.photoUrl ? (
                    <Image
                      src={member.photoUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                      fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-black"
                      style={{ color: "var(--accent)", background: "oklch(0.65 0.18 155 / 0.08)" }}>
                      {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name */}
                <h3 className="text-[16px] font-bold text-gray-900 leading-snug mb-0.5"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  {member.firstName} {member.lastName}
                </h3>

                {/* Title */}
                <p className="text-[11px] font-black uppercase tracking-[0.18em] mb-3"
                  style={{ color: "var(--accent)" }}>
                  {member.title}
                </p>

                {/* Divider */}
                <div className="w-8 h-0.5 rounded-full mb-3" style={{ background: "var(--accent)", opacity: 0.35 }} />

                {/* Bio */}
                {member.bio && (
                  <p className="text-[12px] text-gray-500 leading-[1.7] line-clamp-3 flex-1 mb-5">
                    {member.bio}
                  </p>
                )}

                {/* Social icons */}
                <div className="flex items-center gap-2 mt-auto">
                  {member.email && (
                    <a href={`mailto:${member.email}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
                      style={{ background: "var(--accent)" }}>
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {member.phone && (
                    <a href={`tel:${member.phone}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
                      style={{ background: "var(--accent)" }}>
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {member.linkedinUrl && (
                    <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
                      style={{ background: "#0a66c2" }}>
                      <Linkedin className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </section>

      {/* â”€â”€ JOIN CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="py-10" style={{ background: "#1a2236" }}>
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--accent)" }} />
          <h2 className="text-2xl lg:text-3xl font-black text-white mb-3"
            style={{ fontFamily: "var(--font-heading)" }}>
            Passionate About Education?
          </h2>
          <p className="text-[13px] text-white/50 leading-relaxed mb-5">
            We are always looking for dedicated and compassionate individuals to join our school family.
          </p>
          <Link href="/#contact">
            <Button className="h-11 px-8 text-sm font-bold text-white rounded-lg"
              style={{ background: "var(--accent)" }}>
              Get in Touch <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="py-6" style={{ background: "oklch(0.10 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/farouk-logo.jpeg" alt="FAMS" width={36} height={36}
              className="rounded-lg object-cover ring-1 ring-white/10" />
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">Faruk Aktas Muslim School</p>
              <p className="text-[10px] text-white/35 mt-0.5">Kisauni, Zanzibar &bull; Est. 2020</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href}
                className="text-[12px] text-white/35 hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-white/20">
            &copy; {new Date().getFullYear()} Faruk Aktas Muslim School
          </p>
        </div>
      </footer>

    </div>
  )
}

