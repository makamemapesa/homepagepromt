"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSiteBranding } from "@/hooks/use-site-branding"
import Image from "next/image"
import {
  Heart, Users, GraduationCap, Star, Sparkles, CheckCircle2,
  ArrowRight, Phone, MapPin, Clock, HandHeart, BookOpenCheck,
  Handshake, ShieldCheck, Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"

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

export default function SupportPage() {
  const branding = useSiteBranding()
  const pathname = usePathname()

  useEffect(() => {
    // Scroll-reveal
    const revealObserver = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view") }),
      { threshold: 0.06, rootMargin: "0px 0px -50px 0px" }
    )
    document.querySelectorAll(".reveal,.reveal-left,.reveal-right,.reveal-scale")
      .forEach((el) => revealObserver.observe(el))

    // Animated counters
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const target = parseInt(el.dataset.count ?? "0", 10)
          const suffix = el.dataset.suffix ?? ""
          if (!target) return
          const duration = 1800
          let startTime: number | null = null
          const animate = (ts: number) => {
            if (!startTime) startTime = ts
            const progress = Math.min((ts - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 4)
            el.textContent = Math.floor(eased * target) + suffix
            if (progress < 1) requestAnimationFrame(animate)
            else { el.textContent = target + suffix; el.classList.add("stat-popped") }
          }
          requestAnimationFrame(animate)
          counterObserver.unobserve(el)
        })
      },
      { threshold: 0.5 }
    )
    document.querySelectorAll("[data-count]").forEach((el) => counterObserver.observe(el))

    // Nav shrink on scroll
    const onScroll = () => {
      const nav = document.querySelector("header")
      if (nav) nav.classList.toggle("nav-scrolled", window.scrollY > 60)
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    return () => {
      revealObserver.disconnect()
      counterObserver.disconnect()
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── NAVIGATION ─────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 border-b border-white/8 backdrop-blur-xl"
        style={{ background: "oklch(0.13 0.03 250 / 0.96)" }}
      >
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img src={branding.logo} alt={branding.schoolName} style={{ width: 36, height: 36 }}
              className="rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-accent/50 transition-all duration-300"
            />
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold text-white leading-tight">AL NAMAA ACADEMY</p>
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

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button size="sm"
                className="text-[12px] bg-accent hover:bg-accent/90 text-white h-8 px-4 shadow-lg shadow-accent/20 font-semibold">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section
        className="relative min-h-[70vh] flex items-center overflow-hidden pt-16"
        style={{ background: "oklch(0.11 0.03 250)" }}
      >
        <Image
          src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=85"
          alt="Children supported by school" fill priority
          className="object-cover opacity-55"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(110deg, oklch(0.11 0.03 250 / 0.92) 30%, oklch(0.11 0.03 250 / 0.55) 65%, oklch(0.11 0.03 250 / 0.25) 100%)" }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-40"
          style={{ background: "linear-gradient(to top, oklch(0.11 0.03 250), transparent)" }}
        />
        {/* ambient glow */}
        <div className="blob absolute top-1/3 right-1/4 w-[420px] h-[420px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: "oklch(0.65 0.18 155 / 0.07)" }} />

        <div className="relative z-10 mx-auto max-w-7xl px-6 w-full py-20">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="hero-anim-1 inline-flex items-center gap-2.5 mb-7 px-4 py-2 rounded-full border border-accent/25"
              style={{ background: "oklch(0.65 0.18 155 / 0.10)" }}>
              <Heart className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-black text-accent uppercase tracking-[0.18em]">
                Inclusive Education &amp; Sponsorship
              </span>
            </div>

            <h1 className="hero-anim-2 font-black text-white leading-[1.06]"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)", fontFamily: "var(--font-heading)" }}>
              Educating with<br />
              <span className="text-accent">Compassion</span>
            </h1>
            <p className="hero-anim-3 mt-3 text-[12px] font-bold text-white/30 tracking-[0.4em] uppercase">
              Building Every Child&rsquo;s Future &mdash; AL NAMAA ACADEMY
            </p>

            <p className="hero-anim-4 mt-8 text-[16px] text-white/60 leading-[1.85] max-w-[620px]">
              AL NAMAA ACADEMY is firmly committed to providing inclusive, high-quality, and
              values-based education to all children, regardless of their social or economic challenges.
              Every child has the right to education &mdash; and we make that a reality every single day.
            </p>

            {/* Quick stats */}
            <div className="hero-anim-5 mt-10 flex flex-wrap items-center gap-x-10 gap-y-5 border-t border-white/8 pt-8">
              {[
                { num: "30%",   label: "Students Fully Sponsored",   count: 30, suffix: "%" },
                { num: "100%",  label: "Tuition Coverage",           count: 100, suffix: "%" },
                { num: "0",     label: "Children Turned Away",       count: null },
              ].map((s) => (
                <div key={s.label}>
                  <p
                    className="text-2xl font-black text-accent"
                    style={{ fontFamily: "var(--font-heading)" }}
                    {...(s.count != null ? { "data-count": String(s.count), "data-suffix": s.suffix ?? "" } : {})}
                  >
                    {s.num}
                  </p>
                  <p className="text-[11px] text-white/35 mt-0.5 tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION STATEMENT ──────────────────────────────── */}
      <section className="py-14 lg:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — content */}
            <div className="reveal-left order-2 lg:order-1">
              <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-5">Our Mission</p>
              <h2 className="text-3xl lg:text-4xl font-black text-foreground leading-[1.08]"
                style={{ fontFamily: "var(--font-heading)" }}>
                A School Where Opportunity<br />
                <span className="text-primary">Reaches Those Who Deserve It Most</span>
              </h2>
              <div className="mt-6 space-y-4">
                <p className="text-muted-foreground leading-[1.85] text-[15px]">
                  We strongly believe that education is a bridge to hope, equality, and life transformation.
                  Within our school environment, sponsored students and regular fee-paying students learn
                  together as one family &mdash; creating a culture that promotes excellence and mutual respect.
                </p>
                <p className="text-muted-foreground leading-[1.85] text-[15px]">
                  This inclusive model helps build a generation equipped with knowledge, compassion, and the
                  ability to make a meaningful contribution to society and the nation as a whole.
                </p>
              </div>
              <div className="mt-8">
                <Link href="/#contact">
                  <Button className="h-11 px-7 text-sm font-semibold shadow-lg shadow-primary/15">
                    Contact Us <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right — photo */}
            <div className="reveal-right order-1 lg:order-2 grid grid-cols-2 gap-3">
              <div className="col-span-2 relative h-64 rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80"
                  alt="Children learning" fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
              </div>
              <div className="relative h-44 rounded-xl overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80"
                  alt="Teacher with student" fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="relative h-44 rounded-xl overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80"
                  alt="Students studying" fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5 PILLARS ──────────────────────────────────────── */}
      <section className="py-14 lg:py-18" style={{ background: "oklch(0.13 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <p className="reveal text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">What We Stand For</p>
            <h2 className="reveal delay-100 text-3xl lg:text-4xl font-black text-white leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              The Six Pillars of Our<br />Inclusive Education Model
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Star, num: "01",
                title: "Academic Excellence",
                desc: "Rigorous, ZEC and NECTA-aligned standards that challenge every student to reach their full academic potential — regardless of their background.",
                color: "text-amber-400", bg: "oklch(0.65 0.18 80 / 0.10)",
              },
              {
                icon: Heart, num: "02",
                title: "Strong Moral Values & Positive Character",
                desc: "Faith-centred education integrating Islamic ethics, compassion, integrity, and respect into every aspect of daily school life.",
                color: "text-rose-400", bg: "oklch(0.55 0.20 10 / 0.10)",
              },
              {
                icon: Sparkles, num: "03",
                title: "Self-Confidence & Self-Awareness",
                desc: "Building the inner strength and self-belief that every child needs to stand tall, contribute, and thrive in the world.",
                color: "text-violet-400", bg: "oklch(0.55 0.20 290 / 0.10)",
              },
              {
                icon: Users, num: "04",
                title: "Equal Opportunities for Every Learner",
                desc: "Sponsored and fee-paying students learn side by side as one family. Financial circumstance is never a barrier to a quality education here.",
                color: "text-sky-400", bg: "oklch(0.60 0.15 225 / 0.10)",
              },
              {
                icon: GraduationCap, num: "05",
                title: "Better Preparation for Future Life",
                desc: "Equipping students with the knowledge, critical thinking, and values needed for higher education, careers, and meaningful contributions to society.",
                color: "text-accent", bg: "oklch(0.65 0.18 155 / 0.10)",
              },
              {
                icon: Globe, num: "+",
                title: "One Community, One Future",
                desc: "Our inclusive model creates a generation rooted in compassion — prepared to build a stronger nation and a more equitable world.",
                color: "text-emerald-400", bg: "oklch(0.60 0.15 165 / 0.10)",
              },
            ].map((p, i) => (
              <div key={p.num}
                className={`reveal delay-${i * 70} group flex flex-col gap-5 p-7 rounded-2xl border border-white/8 hover:border-white/16 hover:shadow-2xl transition-all duration-300`}
                style={{ background: "oklch(0.16 0.03 250)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: p.bg }}>
                    <p.icon className={`h-5 w-5 ${p.color}`} />
                  </div>
                  <span className="text-[11px] font-black text-white/15">{p.num}</span>
                </div>
                <div>
                  <h3 className={`text-[14px] font-black text-white leading-snug mb-2 group-hover:${p.color} transition-colors`}
                    style={{ fontFamily: "var(--font-heading)" }}>
                    {p.title}
                  </h3>
                  <p className="text-[13px] text-white/45 leading-[1.75]">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ORPHAN SUPPORT ─────────────────────────────────── */}
      <section className="py-14 lg:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left — image */}
            <div className="reveal-left relative h-[440px] rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=900&q=80"
                alt="Orphan support program" fill
                className="object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              {/* Badge overlay */}
              <div className="absolute bottom-6 left-6 right-6 p-5 rounded-2xl border border-white/15 backdrop-blur-md"
                style={{ background: "oklch(0.10 0.03 250 / 0.75)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "oklch(0.55 0.20 10 / 0.25)" }}>
                    <Heart className="h-4 w-4 text-rose-400" />
                  </div>
                  <span className="text-[11px] font-black text-accent uppercase tracking-[0.2em]">Orphan Support Program</span>
                </div>
                <p className="text-[13px] text-white/65 leading-[1.7]">
                  Providing a safe, nurturing, and inspiring environment for every child in our care.
                </p>
              </div>
            </div>

            {/* Right — content */}
            <div className="reveal-right">
              <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-5">Orphan Support &amp; Inclusive Education</p>
              <h2 className="text-3xl lg:text-4xl font-black text-foreground leading-[1.08] mb-6"
                style={{ fontFamily: "var(--font-heading)" }}>
                A Vital Pillar for<br />
                <span className="text-primary">Vulnerable Children</span>
              </h2>
              <div className="space-y-5 text-[15px] text-muted-foreground leading-[1.85]">
                <p>
                  Over the years, Faruk Aktas Muslim School has remained a vital pillar in supporting
                  orphaned and vulnerable children by providing quality education, spiritual nurturing,
                  social support, and essential developmental services.
                </p>
                <p>
                  Through close collaboration with donors, social institutions, and development partners,
                  many students have been given the opportunity to learn in a safe, stable, and inspiring
                  environment that promotes both academic achievement and holistic personal growth.
                </p>
              </div>

              {/* Support areas */}
              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  { icon: BookOpenCheck, label: "Quality Education"       },
                  { icon: Sparkles,      label: "Spiritual Nurturing"     },
                  { icon: HandHeart,     label: "Social Support"          },
                  { icon: ShieldCheck,   label: "Safe Environment"        },
                  { icon: GraduationCap, label: "Academic Achievement"    },
                  { icon: Globe,         label: "Holistic Personal Growth" },
                ].map((item) => (
                  <div key={item.label}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors">
                    <item.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-[12px] font-semibold text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SPONSORSHIP HIGHLIGHT ──────────────────────────── */}
      <section className="py-14 lg:py-20 relative overflow-hidden"
        style={{ background: "oklch(0.11 0.03 250)" }}>
        {/* Background glow */}
        <div className="blob absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: "oklch(0.65 0.18 155 / 0.08)" }} />

        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="text-center mb-14">
            <p className="reveal text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Muzdalifa Community Partnership</p>
            <h2 className="reveal delay-100 text-3xl lg:text-4xl font-black text-white leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              Sponsorship That<br />
              <span className="text-accent">Changes Lives</span>
            </h2>
          </div>

          {/* Big central stat */}
          <div className="reveal-scale flex flex-col items-center mb-14">
            <div className="relative flex items-end justify-center gap-4 mb-6">
              <span
                className="font-black text-accent leading-none"
                style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(5rem, 14vw, 10rem)" }}
                data-count="30" data-suffix="%">
                30%
              </span>
            </div>
            <p className="text-xl font-black text-white mb-2">of students receive 100% full sponsorship</p>
            <p className="text-[15px] text-white/45 max-w-xl text-center leading-[1.8]">
              Through the generous support of the <span className="text-white font-bold">Muzdalifa Community</span>,
              approximately 30% of the school&rsquo;s students receive complete coverage of tuition fees and
              all other essential educational needs.
            </p>
          </div>

          {/* Three pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            {[
              {
                icon: Handshake,
                title: "Muzdalifa Community",
                desc: "A generous community partner whose sustained commitment has made 100% sponsorship a reality for hundreds of learners.",
              },
              {
                icon: CheckCircle2,
                title: "Full Tuition Coverage",
                desc: "Sponsorship covers tuition fees and all essential educational needs — so no child ever faces a barrier to learning.",
              },
              {
                icon: GraduationCap,
                title: "Equal Achievement",
                desc: "Sponsored students achieve the same academic outcomes as fee-paying peers — because opportunity makes all the difference.",
              },
            ].map((c, i) => (
              <div key={c.title}
                className={`reveal delay-${i * 100} group p-7 rounded-2xl border border-white/8 hover:border-accent/30 transition-all duration-300`}
                style={{ background: "oklch(0.15 0.03 250)" }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-5 border border-accent/20"
                  style={{ background: "oklch(0.65 0.18 155 / 0.12)" }}>
                  <c.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-[15px] font-black text-white mb-3" style={{ fontFamily: "var(--font-heading)" }}>
                  {c.title}
                </h3>
                <p className="text-[13px] text-white/45 leading-[1.75]">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Mission statement banner */}
          <div className="reveal relative overflow-hidden rounded-3xl border border-accent/20 p-8 lg:p-12 text-center"
            style={{ background: "oklch(0.65 0.18 155 / 0.08)" }}>
            <div className="blob absolute -top-10 -left-10 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
              style={{ background: "oklch(0.65 0.18 155 / 0.12)" }} />
            <div className="blob absolute -bottom-10 -right-10 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
              style={{ background: "oklch(0.65 0.18 155 / 0.08)" }} />
            <div className="relative z-10 max-w-3xl mx-auto">
              <CheckCircle2 className="h-10 w-10 text-accent mx-auto mb-6" />
              <h3 className="text-2xl lg:text-3xl font-black text-white leading-snug mb-5"
                style={{ fontFamily: "var(--font-heading)" }}>
                No Child Denied Education<br />Because of Financial Hardship
              </h3>
              <p className="text-[15px] text-white/55 leading-[1.85]">
                This remarkable contribution continues to strengthen the school&rsquo;s mission of ensuring
                that no child is denied access to education because of financial hardship, and that every
                learner is given an equal opportunity to achieve their dreams and life goals.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── HOW YOU CAN HELP ───────────────────────────────── */}
      <section className="py-14 lg:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <p className="reveal text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Get Involved</p>
            <h2 className="reveal delay-100 text-3xl lg:text-4xl font-black text-foreground leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              Partner with Us to Build<br />
              <span className="text-primary">Brighter Futures</span>
            </h2>
            <p className="reveal delay-200 mt-5 text-[15px] text-muted-foreground leading-[1.85] max-w-2xl mx-auto">
              Your support — whether as an individual, an organisation, or a community partner — directly
              transforms a child&rsquo;s life and strengthens our mission of inclusive, compassionate education.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: HandHeart,
                title: "Sponsor a Student",
                desc: "Cover the full or partial tuition of an orphaned or vulnerable student and give them the gift of a quality education.",
                cta: "Contact Us",
                href: "/#contact",
                accent: true,
              },
              {
                icon: Handshake,
                title: "Institutional Partnership",
                desc: "Join organisations like the Muzdalifa Community in building large-scale, sustainable sponsorship programs.",
                cta: "Learn More",
                href: "/#contact",
                accent: false,
              },
              {
                icon: Heart,
                title: "General Donation",
                desc: "Contribute to school resources, infrastructure, materials, or emergency student support funds.",
                cta: "Get in Touch",
                href: "/#contact",
                accent: false,
              },
            ].map((c, i) => (
              <div key={c.title}
                className={`reveal delay-${i * 80} group flex flex-col p-7 rounded-2xl border transition-all duration-300 hover:shadow-xl ${
                  c.accent
                    ? "border-accent/30 hover:border-accent/50 bg-accent/5"
                    : "border-border hover:border-primary/30 bg-card"
                }`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl mb-6 ${
                  c.accent ? "bg-accent/15" : "bg-primary/8"
                }`}>
                  <c.icon className={`h-5 w-5 ${c.accent ? "text-accent" : "text-primary"}`} />
                </div>
                <h3 className="text-[15px] font-black text-foreground mb-3 group-hover:text-primary transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  {c.title}
                </h3>
                <p className="text-[13px] text-muted-foreground leading-[1.75] flex-1 mb-6">{c.desc}</p>
                <Link href={c.href}>
                  <Button
                    variant={c.accent ? "default" : "outline"}
                    className={`w-full h-10 text-sm font-bold ${c.accent ? "shadow-lg shadow-accent/20" : ""}`}>
                    {c.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT STRIP ──────────────────────────────────── */}
      <section className="py-10 border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Have a Question?</p>
              <p className="text-lg font-black text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                Reach out to our admissions &amp; support team
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {[
                { icon: Phone, label: "Nursery",   value: "+255 774 221 707" },
                { icon: Phone, label: "Primary",   value: "+255 652 898 731" },
                { icon: Phone, label: "Secondary", value: "+255 777 397 422" },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
                  <c.icon className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">{c.label}</p>
                    <p className="text-sm font-bold text-foreground">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="py-10" style={{ background: "oklch(0.10 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={branding.logo} alt={branding.schoolName} style={{ width: 36, height: 36 }}
              className="rounded-lg object-cover ring-1 ring-white/10" />
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">Faruk Aktas Muslim School</p>
              <p className="text-[10px] text-white/35 mt-0.5">Kisauni, Zanzibar &bull; Est. 2020</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {[
              { label: "Home",       href: "/" },
              { label: "About",      href: "/#about" },
              { label: "Programs",   href: "/#programs" },
              { label: "Admissions", href: "/#admissions" },
              { label: "Support",    href: "/support" },
              { label: "Contact",    href: "/#contact" },
            ].map((l) => (
              <Link key={l.label} href={l.href}
                className="text-[12px] text-white/35 hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-white/20 text-center md:text-right">
            &copy; {new Date().getFullYear()} Faruk Aktas Muslim School. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  )
}
