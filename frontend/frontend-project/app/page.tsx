"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  GraduationCap, Users, BookOpen, Shield, ArrowRight,
  Phone, MapPin, Clock, Award, ChevronRight, Heart,
  Star, Globe, Sparkles, CheckCircle2, FileCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

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

export default function HomePage() {
  const pathname = usePathname()
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [admissionWindow, setAdmissionWindow] = useState<any>(null)
  const [windowClosed, setWindowClosed] = useState(false)
  const [heroTitle, setHeroTitle] = useState("AL NAMAA ACADEMY")
  const [heroSubtitle, setHeroSubtitle] = useState("\u201CExpect Success\u201D \u00A0\u2014\u00A0 Kisauni, Zanzibar")
  const [heroDescription, setHeroDescription] = useState(
    "An officially accredited institution offering Nursery, Primary, and Secondary education — grounded in Islamic values, aligned with the ZEC Framework and NECTA examinations."
  )
  const [heroVideoUrl, setHeroVideoUrl] = useState("https://www.youtube.com/embed/0t9kQG1Dqv0?rel=0&modestbranding=1&color=white")
  const [heroVideoUploadUrl, setHeroVideoUploadUrl] = useState("")
  const [heroImageUrl, setHeroImageUrl] = useState("https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1600&q=85")

  useEffect(() => {
    // -- 1. Scroll reveal -------------------------------------
    const revealObserver = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view") }),
      { threshold: 0.06, rootMargin: "0px 0px -50px 0px" }
    )
    document.querySelectorAll(".reveal,.reveal-left,.reveal-right,.reveal-scale")
      .forEach((el) => revealObserver.observe(el))

    // -- 2. Parallax hero bg + navbar shrink -----------------
    const heroBg = document.getElementById("hero-parallax-bg")
    const onScroll = () => {
      if (heroBg) heroBg.style.transform = `translateY(${window.scrollY * 0.38}px) scale(1.12)`
      const nav = document.querySelector("header")
      if (nav) nav.classList.toggle("nav-scrolled", window.scrollY > 60)
    }
    window.addEventListener("scroll", onScroll, { passive: true })

    // -- 3. Animated number counter ---------------------------
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const target = parseInt(el.dataset.count ?? "0", 10)
          const suffix = el.dataset.suffix ?? ""
          if (!target) return
          const duration = 1600
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

    // -- 4. Mouse spotlight on feature cards -----------------
    const spotlightSection = document.querySelector(".spotlight-section") as HTMLElement | null
    const handleSpotlight = (e: MouseEvent) => {
      spotlightSection?.querySelectorAll(".spotlight-card").forEach((card) => {
        const el = card as HTMLElement
        const rect = el.getBoundingClientRect()
        el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`)
        el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`)
      })
    }
    spotlightSection?.addEventListener("mousemove", handleSpotlight as EventListener)

    // -- 5. 3D tilt on cards ----------------------------------
    const tiltCards = document.querySelectorAll(".tilt-card")
    const onTiltMove = (e: MouseEvent) => {
      const card = e.currentTarget as HTMLElement
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      card.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.03)`
      card.style.boxShadow = `${-x * 18}px ${-y * 18}px 40px oklch(0 0 0 / 0.13)`
    }
    const onTiltLeave = (e: MouseEvent) => {
      const card = e.currentTarget as HTMLElement
      card.style.transform = "perspective(700px) rotateY(0deg) rotateX(0deg) scale(1)"
      card.style.boxShadow = ""
    }
    tiltCards.forEach((card) => {
      ;(card as HTMLElement).addEventListener("mousemove", onTiltMove as EventListener)
      ;(card as HTMLElement).addEventListener("mouseleave", onTiltLeave as EventListener)
    })

    return () => {
      revealObserver.disconnect()
      counterObserver.disconnect()
      window.removeEventListener("scroll", onScroll)
      spotlightSection?.removeEventListener("mousemove", handleSpotlight as EventListener)
      tiltCards.forEach((card) => {
        ;(card as HTMLElement).removeEventListener("mousemove", onTiltMove as EventListener)
        ;(card as HTMLElement).removeEventListener("mouseleave", onTiltLeave as EventListener)
      })
    }
  }, [])

  useEffect(() => {
    fetch(`${BASE_URL}/api/admission-windows/active/`)
      .then(r => { if (!r.ok) throw r; return r.json() })
      .then(data => setAdmissionWindow(data))
      .catch(() => setWindowClosed(true))

    // Fetch managed homepage content and override defaults
    fetch(`${BASE_URL}/api/homepage-content/`)
      .then(r => { if (!r.ok) throw r; return r.json() })
      .then((d) => {
        if (d.hero_title) setHeroTitle(d.hero_title)
        if (d.hero_subtitle) setHeroSubtitle(d.hero_subtitle)
        if (d.hero_description) setHeroDescription(d.hero_description)
        if (d.hero_video_url) setHeroVideoUrl(d.hero_video_url)
        if (d.hero_video_upload) {
          setHeroVideoUploadUrl(
            d.hero_video_upload.startsWith("http")
              ? d.hero_video_upload
              : `${BASE_URL}${d.hero_video_upload}`
          )
        }
        if (d.hero_image_upload) {
          setHeroImageUrl(
            d.hero_image_upload.startsWith("http")
              ? d.hero_image_upload
              : `${BASE_URL}${d.hero_image_upload}`
          )
        } else if (d.hero_image) {
          setHeroImageUrl(d.hero_image)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ---------------------------------------------------
          NAVIGATION � fixed dark header
      ---------------------------------------------------- */}
      <header
        className="fixed top-0 inset-x-0 z-50 border-b border-white/8 backdrop-blur-xl"
        style={{ background: "oklch(0.13 0.03 250 / 0.96)" }}
      >
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/farouk-logo.jpeg" alt="AL NAMAA ACADEMY" width={36} height={36}
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
            <Link href="/results">
              <Button variant="ghost" size="sm"
                className="text-[12px] text-white/60 hover:text-white hover:bg-white/8 h-8 px-3">
                Results
              </Button>
            </Link>
            {/* Apply Now — only shown when an admission window is open */}
            {admissionWindow && (
              <Link href="/apply">
                <Button size="sm"
                  className="text-[12px] h-8 px-4 font-bold shadow-lg text-white gap-1.5"
                  style={{ background: "oklch(0.52 0.18 145)" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                  Apply Now
                </Button>
              </Link>
            )}
            <Link href="/login">
              <Button size="sm"
                className="text-[12px] bg-accent hover:bg-accent/90 text-white h-8 px-4 shadow-lg shadow-accent/20 font-semibold">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------
          HERO � full-bleed dark with left-aligned content
      ---------------------------------------------------- */}
      <section
        className="relative min-h-[85vh] flex items-center overflow-hidden pt-16"
        style={{ background: "oklch(0.11 0.03 250)" }}
      >
        {/* Background image */}
        <Image
          src={heroImageUrl}
          alt="School campus"
          fill priority
          id="hero-parallax-bg"
          className="object-cover opacity-80"
        />
        {/* Gradient panel � left side readable, right very light so image shows clearly */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(110deg, oklch(0.11 0.03 250 / 0.88) 25%, oklch(0.11 0.03 250 / 0.45) 55%, oklch(0.11 0.03 250 / 0.15) 100%)" }}
        />
        {/* Bottom fade out */}
        <div
          className="absolute bottom-0 inset-x-0 h-40"
          style={{ background: "linear-gradient(to top, oklch(0.11 0.03 250 / 0.85), transparent)" }}
        />
        {/* Ambient glow */}
        <div className="blob absolute top-1/3 right-1/3 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: "oklch(0.65 0.18 155 / 0.06)" }} />

        <div className="relative z-10 mx-auto max-w-7xl px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center">
          <div>

            {/* Eyebrow */}
            <div className={`hero-anim-1 inline-flex items-center gap-2.5 mb-7 px-4 py-2 rounded-full border ${
                admissionWindow ? "border-green-500/25" : "border-accent/25"
              }`}
              style={{ background: admissionWindow ? "oklch(0.55 0.18 145 / 0.12)" : "oklch(0.65 0.18 155 / 0.08)" }}>
              {admissionWindow
                ? <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                : <Sparkles className="h-3.5 w-3.5 text-accent" />}
              <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                admissionWindow ? "text-green-400" : windowClosed ? "text-white/40" : "text-accent"
              }`}>
                {admissionWindow
                  ? "Applications Open — Apply Now"
                  : windowClosed
                  ? "Applications Currently Closed"
                  : "Admissions · 2026 / 2027"}
              </span>
            </div>

            {/* Headline */}
            <h1 className="hero-anim-2 font-black text-white leading-[1.04] tracking-tight"
              style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.8rem)", fontFamily: "var(--font-heading)" }}>
              {heroTitle}
            </h1>

            <p className="hero-anim-3 mt-3.5 text-[11px] font-bold text-white/30 tracking-[0.45em] uppercase">
              {heroSubtitle}
            </p>

            <p className="hero-anim-4 mt-7 text-[15px] text-white/60 leading-[1.8] max-w-[520px]">
              {heroDescription}
            </p>

            {/* CTAs */}
            <div className="hero-anim-5 mt-9 flex flex-wrap gap-3">
              <Link href="#admissions">
                <Button
                  className="h-12 px-8 text-sm font-bold shadow-2xl shadow-accent/30 text-white"
                  style={{ background: "var(--accent)" }}>
                  Apply for Admission <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#about">
                <Button variant="outline"
                  className="h-12 px-8 text-sm font-semibold border-white/18 text-white/80 hover:bg-white/8 hover:text-white bg-transparent">
                  Discover More
                </Button>
              </Link>
            </div>

            {/* Stats row */}
            <div className="hero-anim-6 mt-12 flex flex-wrap items-center gap-x-10 gap-y-5 border-t border-white/8 pt-8">
              {[
                { num: "3", label: "Education Levels" },
                { num: "100%", label: "Accredited" },
                { num: "ZEC", label: "Aligned" },
                { num: "NECTA", label: "Exam Board" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-black text-accent" style={{ fontFamily: "var(--font-heading)" }}>{s.num}</p>
                  <p className="text-[11px] text-white/35 mt-0.5 tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right � YouTube video embed */}
          <div className="hero-anim-4 hidden lg:flex flex-col gap-3 pl-10 xl:pl-16">
            <div
              className="relative w-full rounded-2xl overflow-hidden border border-[#00c853]/40 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,200,83,0.15)]"
              style={{ aspectRatio: "16/10" }}
            >
              {videoPlaying ? (
                heroVideoUploadUrl ? (
                  <video
                    src={heroVideoUploadUrl}
                    controls
                    autoPlay
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <iframe
                    src={heroVideoUrl}
                    title="AL NAMAA ACADEMY — Campus Tour"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                )
              ) : (
                <button
                  onClick={() => setVideoPlaying(true)}
                  className="absolute inset-0 w-full h-full group"
                  aria-label="Play campus tour video"
                >
                  {/* Thumbnail */}
                  <img
                    src="https://img.youtube.com/vi/0t9kQG1Dqv0/maxresdefault.jpg"
                    alt="Campus Tour Thumbnail"
                    className="w-full h-full object-cover"
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-200" />
                  {/* Green play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#00c853] shadow-[0_4px_24px_rgba(0,200,83,0.5)] group-hover:scale-110 group-hover:shadow-[0_4px_32px_rgba(0,200,83,0.7)] transition-all duration-200">
                      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white ml-1" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/30 text-center tracking-[0.12em] uppercase">
              Campus Tour &mdash; AL NAMAA ACADEMY
            </p>
          </div>

          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-px h-10 bg-white/40" />
          <span className="text-[9px] text-white/50 tracking-[0.3em] uppercase">Scroll</span>
        </div>
      </section>

      {/* ---------------------------------------------------
          CREDENTIALS STRIP
      ---------------------------------------------------- */}
      <section className="bg-card border-b border-border">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {[
              { label: "Reg. No.",          value: "P 10082026" },
              { label: "ZRB Number",        value: "Z052610299" },
              { label: "TIN",               value: "175-002-324" },
              { label: "Business License",  value: "BSL-SP20025-2026" },
            ].map((item) => (
              <div key={item.label} className="py-4 px-5 group cursor-default hover:bg-secondary/60 transition-colors duration-200">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">{item.label}</p>
                <p className="text-sm font-bold text-foreground tabular-nums mt-0.5 group-hover:text-primary transition-colors">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          ABOUT
      ---------------------------------------------------- */}
      <section id="about" className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left � content */}
            <div className="reveal-left order-2 lg:order-1">
              <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-5">About Our School</p>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-[1.08] text-balance"
                style={{ fontFamily: "var(--font-heading)" }}>
                Excellence Through<br />
                <span className="text-primary">Knowledge &amp; Character</span>
              </h2>
              <div className="mt-6 space-y-4">
                <p className="text-muted-foreground leading-[1.8] text-[15px]">
                  Located in Kisauni, West &ldquo;B&rdquo; District, Zanzibar, AL NAMAA ACADEMY
                  delivers high-quality education grounded in Islamic values. Our model
                  combines rigorous academics with moral and spiritual development.
                </p>
                <p className="text-muted-foreground leading-[1.8] text-[15px]">
                  Serving students from Nursery through Secondary level, we follow the ZEC
                  Framework and NECTA curriculum &mdash; ensuring students are nationally
                  competitive and globally prepared.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["ZEC Framework", "NECTA Aligned", "Islamic Values", "Ministry Accredited", "Holistic Growth"].map((tag) => (
                  <span key={tag}
                    className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-[12px] font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-8">
                <Link href="#admissions">
                  <Button className="h-11 px-7 text-sm font-semibold shadow-lg shadow-primary/15">
                    Apply for Admission <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right � photo collage */}
            <div className="reveal-right order-1 lg:order-2 grid grid-cols-2 gap-3">
              <div className="col-span-2 relative h-64 rounded-2xl overflow-hidden shadow-xl">
                <Image src="https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=80"
                  alt="Students in class" fill className="object-cover hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
              </div>
              <div className="relative h-44 rounded-xl overflow-hidden shadow-lg">
                <Image src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80"
                  alt="Teacher" fill className="object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="relative h-44 rounded-xl overflow-hidden shadow-lg">
                <Image src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80"
                  alt="Students studying" fill className="object-cover hover:scale-105 transition-transform duration-700" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          SUPPORT TEASER
      ---------------------------------------------------- */}
      <section id="support" className="py-12 lg:py-16" style={{ background: "oklch(0.11 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="reveal relative overflow-hidden rounded-3xl border border-accent/20 p-8 lg:p-14"
            style={{ background: "oklch(0.65 0.18 155 / 0.07)" }}>
            <div className="blob absolute -top-10 -right-10 w-72 h-72 rounded-full blur-[100px] pointer-events-none"
              style={{ background: "oklch(0.65 0.18 155 / 0.12)" }} />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-5">Inclusive Education &amp; Sponsorship</p>
                <h2 className="text-3xl lg:text-4xl font-black text-white leading-[1.07] mb-5"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  Educating with Compassion,<br />
                  <span className="text-accent">Building Every Child&rsquo;s Future</span>
                </h2>
                <p className="text-[15px] text-white/50 leading-[1.85]">
                  Through the generosity of donors and partners under the Muzdalifa Community,
                  30% of our students receive 100% full sponsorship — ensuring no child is
                  ever denied access to education because of financial hardship.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/support">
                    <Button className="h-11 px-7 text-sm font-bold shadow-xl shadow-accent/20 text-white"
                      style={{ background: "var(--accent)" }}>
                      Learn About Our Support Programs <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { num: "30%", label: "Students Fully Sponsored", count: 30, suffix: "%" },
                  { num: "100%", label: "Tuition Coverage", count: 100, suffix: "%" },
                  { num: "0", label: "Children Turned Away", count: null },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center text-center p-4 rounded-2xl border border-white/8"
                    style={{ background: "oklch(0.15 0.03 250)" }}>
                    <p
                      className="text-3xl font-black text-accent mb-1"
                      style={{ fontFamily: "var(--font-heading)" }}
                      {...(s.count != null ? { "data-count": String(s.count), "data-suffix": s.suffix ?? "" } : {})}
                    >
                      {s.num}
                    </p>
                    <p className="text-[10px] text-white/40 leading-snug">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          STATS BANNER � dark section
      ---------------------------------------------------- */}
      <section className="py-10" style={{ background: "oklch(0.13 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {[
              { num: "3",     label: "Education Levels",    sub: "Nursery &bull; Primary &bull; Secondary",  count: 3 },
              { num: "100%",  label: "Government Accredited", sub: "Ministry of Education, Zanzibar",         count: 100, suffix: "%" },
              { num: "ZEC",   label: "Curriculum Standard", sub: "Zanzibar Examinations Council",            count: null },
              { num: "NECTA", label: "National Exam Board",  sub: "Tanzania & Zanzibar",                     count: null },

            ].map((stat, i) => (
              <div key={stat.label} className={`reveal delay-${i * 100} border-l-2 border-accent/30 pl-5`}>
                <p
                  className="text-4xl lg:text-5xl font-black text-accent"
                  style={{ fontFamily: "var(--font-heading)" }}
                  {...(stat.count ? { "data-count": String(stat.count), "data-suffix": stat.suffix ?? "" } : {})}
                >
                  {stat.num}
                </p>
                <p className="text-sm font-bold text-white mt-2 leading-tight">{stat.label}</p>
                <p className="text-[11px] text-white/35 mt-1" dangerouslySetInnerHTML={{ __html: stat.sub }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          PROGRAMS
      ---------------------------------------------------- */}
      <section id="programs" className="py-12 lg:py-16 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8">
            <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Academic Programs</p>
            <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-foreground leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              Three Levels of<br />Academic Excellence
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              {
                num: "01", level: "Nursery",   ages: "Early Childhood",     color: "bg-amber-500",
                img: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=700&q=80",
                desc: "Play-based and structured early childhood development. Building social, cognitive, and physical foundations for lifelong learning.",
                phone: "+255 774 221 707",
              },
              {
                num: "02", level: "Primary",   ages: "Foundation Stage",     color: "bg-primary",
                img: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=700&q=80",
                desc: "ZEC-aligned comprehensive curriculum developing literacy, numeracy, critical thinking, and Islamic moral education.",
                phone: "+255 652 898 731",
              },
              {
                num: "03", level: "Secondary", ages: "Advanced Studies",     color: "bg-accent",
                img: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=700&q=80",
                desc: "Rigorous NECTA preparation across sciences, humanities, and technical subjects &mdash; setting the stage for higher education.",
                phone: "+255 777 397 422",
              },
            ].map((prog, i) => (
              <div key={prog.level}
                className={`reveal delay-${i * 150} group tilt-card flex flex-col overflow-hidden rounded-2xl bg-card border border-border hover:shadow-2xl transition-all duration-300`}>
                <div className="relative h-60 overflow-hidden">
                  <Image src={prog.img} alt={prog.level} fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  {/* Number badge */}
                  <div className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm border border-white/10">
                    <span className="text-xs font-black text-white">{prog.num}</span>
                  </div>
                  {/* Level label over bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-xl font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>
                      {prog.level} Education
                    </h3>
                    <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-white text-[11px] font-bold ${prog.color}/80 backdrop-blur-sm`}
                      dangerouslySetInnerHTML={{ __html: prog.ages }} />
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-6">
                  <p className="text-[14px] text-muted-foreground leading-[1.75] flex-1"
                    dangerouslySetInnerHTML={{ __html: prog.desc }} />
                  <div className="mt-5 pt-4 border-t border-border flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{prog.phone}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          WHY CHOOSE US � header + balanced bento grid
      ---------------------------------------------------- */}
      <section className="py-12 lg:py-16 spotlight-section">
        <div className="mx-auto max-w-7xl px-6">

          {/* Top: two-column header row � label+title left, description+badge right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-8">
            <div className="reveal-left">
              <p className="label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Why Choose Us</p>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-[1.06]"
                style={{ fontFamily: "var(--font-heading)" }}>
                Where Values Meet<br />
                <span className="text-primary">Academic Excellence</span>
              </h2>
            </div>
            <div className="reveal-right flex flex-col gap-4 lg:pb-1">
              <p className="text-[15px] text-muted-foreground leading-[1.8]">
                AL NAMAA ACADEMY stands apart through its unique integration of
                Islamic moral education with internationally-recognised academic standards.
              </p>
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary border border-border w-fit">
                <Award className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[11px] font-black text-foreground">Ministry of Education &amp; Vocational Training, Zanzibar</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Reg. No. P&nbsp;10082026 &bull; ZRB: Z052610299</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3�2 balanced feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BookOpen, title: "Academic Excellence",         ic: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30",       border: "hover:border-blue-200 dark:hover:border-blue-800",   desc: "Rigorous ZEC and NECTA-aligned curriculum designed to push students beyond national benchmarks." },
              { icon: Heart,    title: "Islamic Values & Ethics",     ic: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-950/30",       border: "hover:border-rose-200 dark:hover:border-rose-800",   desc: "Faith-centred learning integrating Quran, Islamic studies, and moral development into daily life." },
              { icon: Users,    title: "Holistic Development",        ic: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/20",   border: "hover:border-violet-200 dark:hover:border-violet-800", desc: "Nurturing the intellectual, physical, social, emotional, and spiritual growth of every student." },
              { icon: Shield,   title: "Safe & Modern Campus",        ic: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "hover:border-emerald-200 dark:hover:border-emerald-800", desc: "Purpose-built facilities including laboratories, library, prayer spaces, and sport grounds." },
              { icon: Globe,    title: "Inclusive Environment",       ic: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/20",     border: "hover:border-amber-200 dark:hover:border-amber-800", desc: "Equal opportunity learning where every student is equally valued and supported to succeed." },
              { icon: Award,    title: "Fully Accredited",            ic: "text-primary",     bg: "bg-primary/8 dark:bg-primary/15",      border: "hover:border-primary/30",                            desc: "Officially recognised and regularly inspected by the Ministry of Education, Zanzibar." },
            ].map((item, i) => (
              <div key={i}
                className={`reveal delay-${i * 60} group spotlight-card tilt-card flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card ${item.border} hover:shadow-xl transition-all duration-300`}>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.ic}`} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors leading-snug mb-2"
                    style={{ fontFamily: "var(--font-heading)" }}>
                    {item.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-[1.7]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          VISION & MISSION � dark section
      ---------------------------------------------------- */}
      <section className="py-12 lg:py-16" style={{ background: "oklch(0.13 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 text-center">
            <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Our Purpose</p>
            <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-white leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              Vision &amp; Mission
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="reveal-left group p-8 rounded-2xl border border-white/8 hover:border-accent/25 transition-all duration-300 hover:shadow-2xl"
              style={{ background: "oklch(0.17 0.03 250)" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-6 border border-accent/20"
                style={{ background: "oklch(0.65 0.18 155 / 0.12)" }}>
                <Star className="h-5 w-5 text-accent" />
              </div>
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.25em] mb-2">Vision</p>
              <h3 className="text-xl font-black text-white mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                Pathways to Fulfilment
              </h3>
              <p className="text-white/55 leading-[1.8] text-[14px]">
                To create pathways that assist every student in achieving their academic and
                personal goals &mdash; empowering them to build fulfilling futures and contribute
                meaningfully to the wider community.
              </p>
            </div>
            <div className="reveal-right group p-8 rounded-2xl border border-white/8 hover:border-primary/30 transition-all duration-300 hover:shadow-2xl"
              style={{ background: "oklch(0.17 0.03 250)" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-6 border border-white/10"
                style={{ background: "oklch(0.35 0.12 250 / 0.25)" }}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.25em] mb-2">Mission</p>
              <h3 className="text-xl font-black text-white mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                Excellence in Education
              </h3>
              <p className="text-white/55 leading-[1.8] text-[14px]">
                To educate all students to the highest levels of achievement, preparing them
                to be productive, ethical, and creative members of society equipped with the
                knowledge, skills, and values needed for sustainable development.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          CAMPUS GALLERY
      ---------------------------------------------------- */}
      <section className="py-12 lg:py-16 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Campus Life</p>
              <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-foreground leading-[1.08]"
                style={{ fontFamily: "var(--font-heading)" }}>
                Life at FAMS
              </h2>
            </div>
          </div>
          {/* Asymmetric grid: 1 tall left + 4 small right */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[180px] gap-3">
            {[
              { src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&q=80", alt: "Collaborative Learning", tall: true },
              { src: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80", alt: "Study Session",          tall: false },
              { src: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&q=80", alt: "School Library",         tall: false },
              { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80", alt: "Science Laboratory",    tall: false },
              { src: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&q=80", alt: "School Sports",         tall: false },
              { src: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80", alt: "Teacher &amp; Students", tall: false },
            ].map((img, i) => (
              <div key={img.alt}
                className={`reveal delay-${(i % 4) * 50} group relative overflow-hidden rounded-2xl cursor-pointer
                  ${img.tall ? "row-span-2 col-span-1" : ""}`}>
                <Image src={img.src} alt={img.alt} fill
                  className="object-cover group-hover:scale-108 transition-transform duration-700" style={{ transitionDuration: "700ms" }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-400" />
                <div className="absolute bottom-0 left-0 right-0 flex items-end p-4">
                  <span className="text-[12px] font-bold text-white drop-shadow-lg"
                    dangerouslySetInnerHTML={{ __html: img.alt }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          ADMISSIONS � accent CTA + process steps
      ---------------------------------------------------- */}
      <section id="admissions" className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-6">

          {/* Banner CTA */}
          <div className="relative overflow-hidden rounded-3xl p-8 lg:p-10 mb-8"
            style={{ background: "var(--accent)" }}>
            <div className="blob absolute -top-10 -right-10 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="blob-2 absolute -bottom-10 left-20 w-56 h-56 rounded-full bg-black/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] mb-3">Enroll Now</p>
                <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  Admissions Open<br />for 2026/2027
                </h2>
                <p className="mt-4 text-white/80 text-[14px] leading-[1.75]">
                  Secure your child&apos;s place at AL NAMAA ACADEMY. Applications
                  are now being accepted for all three educational levels.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  "Nursery \u2014 Early Childhood Education",
                  "Primary \u2014 Foundation & Intermediate Learning",
                  "Secondary \u2014 Advanced Academic Studies",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                    <span className="text-sm text-white/90 font-medium">{item}</span>
                  </div>
                ))}
                <div className="mt-3">
                  <Link href="#contact">
                    <Button className="bg-white hover:bg-white/90 h-11 px-7 text-sm font-black shadow-xl"
                      style={{ color: "var(--accent)" }}>
                      Contact Admissions <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── Online Application Status Card ── */}
          <div className={`reveal mt-6 rounded-2xl border bg-card p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between ${
            admissionWindow ? "border-green-500/30" : "border-border"
          }`}>
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                admissionWindow ? "bg-green-500/10" : "bg-secondary"
              }`}>
                <FileCheck className={`h-5 w-5 ${admissionWindow ? "text-green-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-foreground">Online Applications</span>
                  {admissionWindow ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-[11px] font-black text-green-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      OPEN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-black text-muted-foreground">
                      CLOSED
                    </span>
                  )}
                </div>
                {admissionWindow ? (
                  <p className="text-[13px] text-muted-foreground">
                    Accepting applications until{" "}
                    <span className="font-semibold text-foreground">
                      {new Date(admissionWindow.close_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {Number(admissionWindow.application_fee) > 0 && (
                      <> &nbsp;&bull;&nbsp; Application fee:{" "}
                        <span className="font-semibold text-foreground">
                          TZS {Number(admissionWindow.application_fee).toLocaleString()}
                        </span>
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    No application window is currently open. Check back later or contact the admissions office.
                  </p>
                )}
              </div>
            </div>
            {admissionWindow && (
              <Link href="/apply" className="shrink-0">
                <Button className="h-11 px-7 text-sm font-black shadow-lg shadow-primary/15">
                  Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------
          NEWS � full-width featured + 3-col grid below
      ---------------------------------------------------- */}
      <section id="news" className="py-12 lg:py-16 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6">

          {/* Header row */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Latest</p>
              <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-foreground leading-[1.06]"
                style={{ fontFamily: "var(--font-heading)" }}>
                News &amp; Updates
              </h2>
            </div>
          </div>

          {/* Featured � full-width horizontal card */}
          <div className="reveal group grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card hover:shadow-2xl hover:-translate-y-1 transition-all duration-400 cursor-pointer mb-5">
            <div className="relative h-64 lg:h-auto overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1513258496099-48168024aec0?w=900&q=80"
                alt="NECTA results" fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
              <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-white text-[10px] font-black shadow-lg"
                style={{ background: "var(--accent)" }}>
                Featured
              </span>
            </div>
            <div className="p-8 lg:p-10 flex flex-col justify-center">
              <p className="text-[11px] font-bold text-muted-foreground mb-3 tracking-wide">March 10, 2026</p>
              <h3 className="text-2xl lg:text-3xl font-black text-foreground leading-tight group-hover:text-primary transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}>
                Students Excel in NECTA National Examinations
              </h3>
              <p className="mt-4 text-[14px] text-muted-foreground leading-[1.8]">
                Outstanding performance across NECTA examinations, with multiple students achieving
                top national rankings &mdash; a testament to our academic rigour and the dedication of
                our faculty and students.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary">
                Read Full Story <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* 3 equal cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                img: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80",
                cat: "Infrastructure", catColor: "bg-primary",
                date: "February 20, 2026",
                title: "New Science Laboratory Officially Inaugurated",
                excerpt: "State-of-the-art facilities opened, enhancing practical and experimental learning across all science subjects.",
              },
              {
                img: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80",
                cat: "Admissions", catColor: "bg-accent",
                date: "February 10, 2026",
                title: "Admissions Open for the 2026/2027 Academic Session",
                excerpt: "Applications now being accepted for all three educational levels at our Kisauni campus.",
              },
              {
                img: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=600&q=80",
                cat: "Community", catColor: "bg-violet-500",
                date: "January 15, 2026",
                title: "Annual Prize-Giving Day Celebrates Student Achievement",
                excerpt: "Top performers honoured in a ceremony attended by families, faculty, and community leaders.",
              },
            ].map((a, i) => (
              <div key={a.title}
                className={`reveal delay-${i * 100} group overflow-hidden rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col`}>
                <div className="relative h-44 overflow-hidden shrink-0">
                  <Image src={a.img} alt={a.title} fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full ${a.catColor} text-white text-[10px] font-black`}>
                    {a.cat}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-[11px] text-muted-foreground mb-2">{a.date}</p>
                  <h4 className="text-sm font-black text-foreground leading-snug group-hover:text-primary transition-colors flex-1"
                    style={{ fontFamily: "var(--font-heading)" }}>
                    {a.title}
                  </h4>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-[1.65] line-clamp-2">{a.excerpt}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-bold text-primary">
                    Read More <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          CONTACT � full-width header + 2-col balanced
      ---------------------------------------------------- */}
      <section id="contact" className="py-12 lg:py-16">
        <div className="mx-auto max-w-7xl px-6">

          {/* Full-width header */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-8">
            <div className="reveal-left">
              <p className="label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">Contact Us</p>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-[1.06]"
                style={{ fontFamily: "var(--font-heading)" }}>
                Get in Touch &mdash;<br />
                <span className="text-primary">We&apos;re Here to Help</span>
              </h2>
            </div>
            <div className="reveal-right lg:pb-1">
              <p className="text-[15px] text-muted-foreground leading-[1.8]">
                Whether you&apos;re a prospective parent, current student family, or community member,
                our team is ready to assist you with any enquiries about admissions, fees, or general information.
              </p>
            </div>
          </div>

          {/* 2-col: info left, form right � equal height */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

            {/* Left � info panel */}
            <div className="reveal-left rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
              {/* Top accent strip */}
              <div className="px-7 py-6 border-b border-border" style={{ background: "var(--accent)" }}>
                <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.22em] mb-1">Our Campus</p>
                <p className="text-lg font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>
                  Kisauni, West &ldquo;B&rdquo; District
                </p>
                <p className="text-sm text-white/75 mt-0.5">Zanzibar, Tanzania</p>
              </div>

              {/* Contact rows */}
              <div className="flex flex-col flex-1 divide-y divide-border">
                {[
                  { icon: Phone, label: "Nursery Enquiries",  value: "+255 774 221 707" },
                  { icon: Phone, label: "Primary Enquiries",  value: "+255 652 898 731" },
                  { icon: Phone, label: "Secondary Enquiries", value: "+255 777 397 422" },
                  { icon: Clock, label: "Office Hours",        value: "Monday \u2013 Friday \u00b7 8:00 AM \u2013 4:00 PM" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-4 px-7 py-4 hover:bg-secondary/50 transition-colors group">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 group-hover:bg-primary transition-colors duration-300">
                      <c.icon className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">{c.label}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{c.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom CTA strip */}
              <div className="px-7 py-5 border-t border-border bg-secondary/30">
                <p className="text-[12px] text-muted-foreground">
                  Reg. No. P&nbsp;10082026 &bull; ZRB: Z052610299 &bull; TIN: 175-002-324
                </p>
              </div>
            </div>

            {/* Right � form */}
            <div className="reveal-right">
              <div className="rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-foreground/5 h-full flex flex-col">
                <h3 className="text-xl font-black text-foreground mb-6" style={{ fontFamily: "var(--font-heading)" }}>
                  Send an Enquiry
                </h3>
                <form className="space-y-4 flex flex-col flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] block mb-1.5">First Name</label>
                      <Input placeholder="e.g. Fatima" className="h-11 bg-secondary/50" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] block mb-1.5">Last Name</label>
                      <Input placeholder="e.g. Hassan" className="h-11 bg-secondary/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] block mb-1.5">Email Address</label>
                    <Input placeholder="your@email.com" type="email" className="h-11 bg-secondary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] block mb-1.5">Phone Number</label>
                    <Input placeholder="+255 ..." className="h-11 bg-secondary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] block mb-1.5">Subject</label>
                    <Input placeholder="e.g. Admissions enquiry" className="h-11 bg-secondary/50" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] block mb-1.5">Message</label>
                    <textarea
                      rows={5}
                      placeholder="Tell us how we can help..."
                      className="w-full h-[calc(100%-1.5rem)] min-h-[120px] rounded-xl border border-input bg-secondary/50 px-3.5 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none transition-shadow"
                    />
                  </div>
                  <Button className="w-full h-11 font-black text-sm shadow-lg shadow-primary/15 mt-auto">
                    Send Message <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------
          FOOTER
      ---------------------------------------------------- */}
      <footer className="py-14" style={{ background: "oklch(0.10 0.03 250)" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/8">

            {/* Brand column */}
            <div className="md:col-span-4">
              <div className="flex items-center gap-3 mb-5">
                <Image src="/farouk-logo.jpeg" alt="FAMS" width={42} height={42}
                  className="rounded-xl object-cover ring-1 ring-white/10" />
                <div>
                  <p className="text-[13px] font-bold text-white leading-tight">AL NAMAA ACADEMY</p>
                  <p className="text-[10px] text-white/35 mt-0.5">Kisauni, Zanzibar &bull; Est. 2020</p>
                </div>
              </div>
              <p className="text-[12px] text-white/35 leading-[1.8] mb-5">
                &ldquo;Expect Success&rdquo; &mdash; Officially recognised by the Ministry of Education
                and Vocational Training, Zanzibar. Delivering excellence through Islamic values.
              </p>
              <div className="space-y-1 text-[11px] text-white/20">
                <p>Reg. No. P 10082026 &nbsp;|&nbsp; ZRB: Z052610299</p>
                <p>TIN: 175-002-324 &nbsp;|&nbsp; BSL-SP20025-2026/51066</p>
              </div>
            </div>

            {/* School links */}
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.22em] mb-5">School</h4>
              <div className="flex flex-col gap-3">
                {["About Us", "Our Programs", "Admissions", "Campus Life", "News"].map((l) => (
                  <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[12px] text-white/40 hover:text-white transition-colors duration-200">
                    {l}
                  </a>
                ))}
              </div>
            </div>

            {/* Portals */}
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.22em] mb-5">Portals</h4>
              <div className="flex flex-col gap-3">
                {["Student Portal", "Parent Portal", "Staff Portal", "Results Portal", "Admin Login"].map((l) => (
                  <a key={l} href="/login"
                    className="text-[12px] text-white/40 hover:text-white transition-colors duration-200">
                    {l}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact info */}
            <div className="md:col-span-4">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.22em] mb-5">Contact</h4>
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <span className="text-[12px] text-white/40 leading-relaxed">
                    Kisauni, West &ldquo;B&rdquo; District,<br />Zanzibar, Tanzania
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <div className="text-[12px] text-white/40 space-y-1">
                    <p>Nursery: +255 774 221 707</p>
                    <p>Primary: +255 652 898 731</p>
                    <p>Secondary: +255 777 397 422</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="text-[12px] text-white/40">Mon &ndash; Fri: 8:00 AM &ndash; 4:00 PM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-white/20">
              &copy; 2026 AL NAMAA ACADEMY. All rights reserved.
            </p>
            <p className="text-[11px] font-black text-white/15 tracking-[0.3em] uppercase">
              &ldquo;Expect Success&rdquo;
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
