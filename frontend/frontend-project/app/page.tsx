"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useSiteBranding } from "@/hooks/use-site-branding"
import Image from "next/image"
import {
  GraduationCap, Users, BookOpen, Shield, ArrowRight,
  Phone, MapPin, Clock, Award, ChevronRight, Heart,
  Star, Globe, Sparkles, CheckCircle2, FileCheck,
  Facebook, Twitter, Instagram, Youtube, Linkedin, MessageCircle, Send as SendIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/** Icon choices offered by the homepage editor for feature cards. */
const FEATURE_ICONS: Record<string, any> = {
  book: BookOpen, heart: Heart, users: Users, shield: Shield,
  globe: Globe, award: Award, star: Star, sparkles: Sparkles,
  graduation: GraduationCap, check: CheckCircle2,
}

/** Navigation shown until an administrator edits it under Dashboard → Homepage. */
/** Social networks the footer knows how to render an icon for. */
const SOCIAL_ICONS: Record<string, any> = {
  facebook: Facebook, twitter: Twitter, x: Twitter, instagram: Instagram,
  youtube: Youtube, linkedin: Linkedin, whatsapp: MessageCircle, telegram: SendIcon,
}

/** Category chip colours, cycled in order. Presentation, so not editable. */
const NEWS_CATEGORY_COLORS = ["bg-primary", "bg-accent", "bg-violet-500"]

const FEATURED_NEWS_FALLBACK = {
  image: "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=900&q=80",
  date: "March 10, 2026",
  title: "Students Excel in NECTA National Examinations",
  excerpt:
    "Outstanding performance across NECTA examinations, with multiple students achieving top national rankings \u2014 a testament to our academic rigour and the dedication of our faculty and students.",
  link: "",
}

const NEWS_CARDS_FALLBACK = [
  {
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80",
    category: "Infrastructure",
    date: "February 20, 2026",
    title: "New Science Laboratory Officially Inaugurated",
    excerpt: "State-of-the-art facilities opened, enhancing practical and experimental learning across all science subjects.",
  },
  {
    image: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80",
    category: "Admissions",
    date: "February 10, 2026",
    title: "Admissions Open for the 2026/2027 Academic Session",
    excerpt: "Applications now being accepted for all three educational levels at our Kisauni campus.",
  },
  {
    image: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=600&q=80",
    category: "Community",
    date: "January 15, 2026",
    title: "Annual Prize-Giving Day Celebrates Student Achievement",
    excerpt: "Top performers honoured in a ceremony attended by families, faculty, and community leaders.",
  },
]

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
  const branding = useSiteBranding()
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
  // Everything else on this page is managed under Dashboard → Homepage. Each
  // block falls back to the original copy until an administrator edits it.
  const [content, setContent] = useState<Record<string, any>>({})
  const txt = (key: string, fallback: string) =>
    (content[key] ?? "").toString().trim() || fallback
  const list = <T,>(key: string, fallback: T[]): T[] =>
    Array.isArray(content[key]) && content[key].length ? content[key] : fallback

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
        setContent(d || {})
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

  // Maintenance mode replaces the page outright. Staff still need a way in, so
  // the login link stays — locking the school out of its own dashboard while the
  // homepage is down would be the worst possible time for it.
  if (content.maintenance_mode_enabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ background: "oklch(0.11 0.03 250)" }}>
        <img src={branding.logo} alt={branding.schoolName} style={{ width: 64, height: 64 }}
          className="rounded-2xl object-cover ring-1 ring-white/10" />
        <h1 className="text-3xl font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>
          {branding.schoolName}
        </h1>
        <p className="max-w-md text-[15px] text-white/50 leading-[1.8]">
          {txt("maintenance_mode_message", "Our website is undergoing scheduled maintenance. Please check back shortly.")}
        </p>
        <Link href="/login">
          <Button className="h-11 px-7 text-sm font-bold text-white" style={{ background: "var(--accent)" }}>
            {txt("nav_login_label", "Login")}
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ---------------------------------------------------
          NAVIGATION � fixed dark header
      ---------------------------------------------------- */}
      {/* Administrator-supplied CSS, last in the cascade so it can override
          anything above it. Injected as-is: only an admin can set it. */}
      {content.custom_css ? (
        <style dangerouslySetInnerHTML={{ __html: String(content.custom_css) }} />
      ) : null}

      {content.announcement_banner_enabled && txt("announcement_banner_text", "") ? (
        <div className="fixed top-0 inset-x-0 z-[60] px-6 py-2 text-center text-[12px] font-semibold text-white"
          style={{ background: "var(--accent)" }}>
          {txt("announcement_banner_text", "")}
        </div>
      ) : null}

      <header
        className={`fixed inset-x-0 z-50 border-b border-white/8 backdrop-blur-xl ${
          content.announcement_banner_enabled && txt("announcement_banner_text", "") ? "top-9" : "top-0"
        }`}
        style={{ background: "oklch(0.13 0.03 250 / 0.96)" }}
      >
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img src={branding.logo} alt={branding.schoolName} style={{ width: 36, height: 36 }}
              className="rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-accent/50 transition-all duration-300"
            />
            <div className="hidden sm:block">
              <p className="text-[13px] font-bold text-white leading-tight">{branding.schoolName}</p>
              <p className="text-[10px] text-white/35 tracking-[0.15em] uppercase">{branding.tagline}</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {list<any>("nav_links", NAV_LINKS).map((n) => (
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
                {txt("nav_results_label", "Results")}
              </Button>
            </Link>
            {/* Apply Now — only shown when an admission window is open */}
            {admissionWindow && (
              <Link href="/apply">
                <Button size="sm"
                  className="text-[12px] h-8 px-4 font-bold shadow-lg text-white gap-1.5"
                  style={{ background: "oklch(0.52 0.18 145)" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
                  {txt("nav_apply_label", "Apply Now")}
                </Button>
              </Link>
            )}
            <Link href="/login">
              <Button size="sm"
                className="text-[12px] bg-accent hover:bg-accent/90 text-white h-8 px-4 shadow-lg shadow-accent/20 font-semibold">
                {txt("nav_login_label", "Login")}
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
                  ? txt("hero_applications_open_text", "Applications Open — Apply Now")
                  : windowClosed
                  ? txt("hero_applications_closed_text", "Applications Currently Closed")
                  : txt("hero_badge_text", "Admissions · 2026 / 2027")}
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
                  {txt("hero_primary_cta", "Apply for Admission")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#about">
                <Button variant="outline"
                  className="h-12 px-8 text-sm font-semibold border-white/18 text-white/80 hover:bg-white/8 hover:text-white bg-transparent">
                  {txt("hero_secondary_cta", "Discover More")}
                </Button>
              </Link>
            </div>

            {/* Stats row */}
            <div className="hero-anim-6 mt-12 flex flex-wrap items-center gap-x-10 gap-y-5 border-t border-white/8 pt-8">
              {list<any>("hero_stats", [
                { value: "3", label: "Education Levels" },
                { value: "100%", label: "Accredited" },
                { value: "ZEC", label: "Aligned" },
                { value: "NECTA", label: "Exam Board" },
              ]).map((s, i) => (
                <div key={`${s.label}-${i}`}>
                  <p className="text-2xl font-black text-accent" style={{ fontFamily: "var(--font-heading)" }}>{s.value}</p>
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
                    src={txt("hero_video_thumbnail", "https://img.youtube.com/vi/0t9kQG1Dqv0/maxresdefault.jpg")}
                    alt={txt("hero_video_caption", "Campus Tour")}
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
              {txt("hero_video_caption", "Campus Tour — AL NAMAA ACADEMY")}
            </p>
          </div>

          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-px h-10 bg-white/40" />
          <span className="text-[9px] text-white/50 tracking-[0.3em] uppercase">{txt("hero_scroll_label", "Scroll")}</span>
        </div>
      </section>

      {/* ---------------------------------------------------
          CREDENTIALS STRIP
      ---------------------------------------------------- */}
      <section className="bg-card border-b border-border">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {list<any>("credentials", [
              { label: "Reg. No.",          value: "P 10082026" },
              { label: "ZRB Number",        value: "Z052610299" },
              { label: "TIN",               value: "175-002-324" },
              { label: "Business License",  value: "BSL-SP20025-2026" },
            ]).map((item) => (
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
              <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-5">{txt("about_label", "About Our School")}</p>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-[1.08] text-balance"
                style={{ fontFamily: "var(--font-heading)" }}>
                {txt("about_title", "Excellence Through Knowledge & Character")}
              </h2>
              <div className="mt-6 space-y-4">
                {list<string>("about_paragraphs", [
                  "Located in Kisauni, West “B” District, Zanzibar, AL NAMAA ACADEMY delivers high-quality education grounded in Islamic values. Our model combines rigorous academics with moral and spiritual development.",
                  "Serving students from Nursery through Secondary level, we follow the ZEC Framework and NECTA curriculum — ensuring students are nationally competitive and globally prepared.",
                ]).map((para, i) => (
                  <p key={i} className="text-muted-foreground leading-[1.8] text-[15px]">{para}</p>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {list<string>("about_highlights", ["ZEC Framework", "NECTA Aligned", "Islamic Values", "Ministry Accredited", "Holistic Growth"]).map((tag) => (
                  <span key={tag}
                    className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-[12px] font-semibold text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-8">
                <Link href="#admissions">
                  <Button className="h-11 px-7 text-sm font-semibold shadow-lg shadow-primary/15">
                    {txt("about_cta", "Apply for Admission")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right � photo collage */}
            {/* The first image spans both columns; the rest sit beside each
                other, so the collage keeps its shape at any number of images. */}
            <div className="reveal-right order-1 lg:order-2 grid grid-cols-2 gap-3">
              {list<any>("about_images", [
                { image: "https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=80", alt: "Students in class" },
                { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80", alt: "Teacher" },
                { image: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80", alt: "Students studying" },
              ]).map((img, i) => (
                <div key={`${img.image}-${i}`}
                  className={`relative overflow-hidden ${i === 0
                    ? "col-span-2 h-64 rounded-2xl shadow-xl"
                    : "h-44 rounded-xl shadow-lg"}`}>
                  <Image src={img.image} alt={img.alt || ""} fill
                    className="object-cover hover:scale-105 transition-transform duration-700" />
                  {i === 0 && <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />}
                </div>
              ))}
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
                <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-5">{txt("support_label", "Inclusive Education & Sponsorship")}</p>
                <h2 className="text-3xl lg:text-4xl font-black text-white leading-[1.07] mb-5"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  {txt("support_title", "Educating with Compassion, Building Every Child’s Future")}
                </h2>
                <p className="text-[15px] text-white/50 leading-[1.85]">
                  {txt("support_description", "Through the generosity of donors and partners under the Muzdalifa Community, 30% of our students receive 100% full sponsorship — ensuring no child is ever denied access to education because of financial hardship.")}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/support">
                    <Button className="h-11 px-7 text-sm font-bold shadow-xl shadow-accent/20 text-white"
                      style={{ background: "var(--accent)" }}>
                      {txt("support_cta", "Learn About Our Support Programs")} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {list<any>("support_stats", [
                  { value: "30%", label: "Students Fully Sponsored" },
                  { value: "100%", label: "Tuition Coverage" },
                  { value: "0", label: "Children Turned Away" },
                ]).map((s) => (
                  <div key={s.label} className="flex flex-col items-center text-center p-4 rounded-2xl border border-white/8"
                    style={{ background: "oklch(0.15 0.03 250)" }}>
                    <p
                      className="text-3xl font-black text-accent mb-1"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {s.value}
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
            {list<any>("stats_banner", [
              { value: "3",     label: "Education Levels",      sub: "Nursery • Primary • Secondary" },
              { value: "100%",  label: "Government Accredited", sub: "Ministry of Education, Zanzibar" },
              { value: "ZEC",   label: "Curriculum Standard",   sub: "Zanzibar Examinations Council" },
              { value: "NECTA", label: "National Exam Board",   sub: "Tanzania & Zanzibar" },
            ]).map((stat, i) => (
              <div key={stat.label} className={`reveal delay-${i * 100} border-l-2 border-accent/30 pl-5`}>
                <p
                  className="text-4xl lg:text-5xl font-black text-accent"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {stat.value}
                </p>
                <p className="text-sm font-bold text-white mt-2 leading-tight">{stat.label}</p>
                <p className="text-[11px] text-white/35 mt-1">{stat.sub}</p>
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
            <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">{txt("programs_label", "Academic Programs")}</p>
            <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-foreground leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              {txt("programs_title", "Three Levels of Academic Excellence")}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {list<any>("programs", [
              { number: "01", level: "Nursery", ages: "Early Childhood",
                description: "Play-based and structured early childhood development. Building social, cognitive, and physical foundations for lifelong learning.",
                phone: "+255 774 221 707",
                image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=700&q=80" },
              { number: "02", level: "Primary", ages: "Foundation Stage",
                description: "ZEC-aligned comprehensive curriculum developing literacy, numeracy, critical thinking, and Islamic moral education.",
                phone: "+255 652 898 731",
                image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=700&q=80" },
              { number: "03", level: "Secondary", ages: "Advanced Studies",
                description: "Rigorous NECTA preparation across sciences, humanities, and technical subjects — setting the stage for higher education.",
                phone: "+255 777 397 422",
                image: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=700&q=80" },
            ]).map((prog, i) => (
              <div key={`${prog.level}-${i}`}
                className={`reveal delay-${i * 150} group tilt-card flex flex-col overflow-hidden rounded-2xl bg-card border border-border hover:shadow-2xl transition-all duration-300`}>
                <div className="relative h-60 overflow-hidden">
                  <Image src={prog.image} alt={prog.level} fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  {/* Number badge */}
                  <div className="absolute top-4 right-4 h-9 w-9 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm border border-white/10">
                    <span className="text-xs font-black text-white">{prog.number}</span>
                  </div>
                  {/* Level label over bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-xl font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>
                      {prog.level} Education
                    </h3>
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-primary/80 text-white text-[11px] font-bold backdrop-blur-sm">
                      {prog.ages}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-6">
                  <p className="text-[14px] text-muted-foreground leading-[1.75] flex-1">{prog.description}</p>
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
              <p className="label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">{txt("features_label", "Why Choose Us")}</p>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-[1.06]"
                style={{ fontFamily: "var(--font-heading)" }}>
                {txt("features_title", "Where Values Meet Academic Excellence")}
              </h2>
            </div>
            <div className="reveal-right flex flex-col gap-4 lg:pb-1">
              <p className="text-[15px] text-muted-foreground leading-[1.8]">
                {txt("features_description", "AL NAMAA ACADEMY stands apart through its unique integration of Islamic moral education with internationally-recognised academic standards.")}
              </p>
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary border border-border w-fit">
                <Award className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[11px] font-black text-foreground">{txt("features_badge_title", "Ministry of Education & Vocational Training, Zanzibar")}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{txt("features_badge_subtitle", "Reg. No. P 10082026 • ZRB: Z052610299")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3�2 balanced feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list<any>("features", [
              { icon: "book",   title: "Academic Excellence",     description: "Rigorous ZEC and NECTA-aligned curriculum designed to push students beyond national benchmarks." },
              { icon: "heart",  title: "Islamic Values & Ethics", description: "Faith-centred learning integrating Quran, Islamic studies, and moral development into daily life." },
              { icon: "users",  title: "Holistic Development",    description: "Nurturing the intellectual, physical, social, emotional, and spiritual growth of every student." },
              { icon: "shield", title: "Safe & Modern Campus",    description: "Purpose-built facilities including laboratories, library, prayer spaces, and sport grounds." },
              { icon: "globe",  title: "Inclusive Environment",   description: "Equal opportunity learning where every student is equally valued and supported to succeed." },
              { icon: "award",  title: "Fully Accredited",        description: "Officially recognised and regularly inspected by the Ministry of Education, Zanzibar." },
            ]).map((item, i) => (
              <div key={i}
                className={`reveal delay-${i * 60} group spotlight-card tilt-card flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-xl transition-all duration-300`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8">
                  {(() => { const Icon = FEATURE_ICONS[item.icon] ?? Award; return <Icon className="h-5 w-5 text-primary" /> })()}
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors leading-snug mb-2"
                    style={{ fontFamily: "var(--font-heading)" }}>
                    {item.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-[1.7]">{item.description}</p>
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
            <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">{txt("purpose_label", "Our Purpose")}</p>
            <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-white leading-[1.08]"
              style={{ fontFamily: "var(--font-heading)" }}>
              {txt("purpose_title", "Vision & Mission")}
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="reveal-left group p-8 rounded-2xl border border-white/8 hover:border-accent/25 transition-all duration-300 hover:shadow-2xl"
              style={{ background: "oklch(0.17 0.03 250)" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-6 border border-accent/20"
                style={{ background: "oklch(0.65 0.18 155 / 0.12)" }}>
                <Star className="h-5 w-5 text-accent" />
              </div>
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.25em] mb-2">{txt("vision_eyebrow", "Vision")}</p>
              <h3 className="text-xl font-black text-white mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                {txt("vision_title", "Pathways to Fulfilment")}
              </h3>
              <p className="text-white/55 leading-[1.8] text-[14px]">
                {txt("vision_description", "To create pathways that assist every student in achieving their academic and personal goals — empowering them to build fulfilling futures and contribute meaningfully to the wider community.")}
              </p>
            </div>
            <div className="reveal-right group p-8 rounded-2xl border border-white/8 hover:border-primary/30 transition-all duration-300 hover:shadow-2xl"
              style={{ background: "oklch(0.17 0.03 250)" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-6 border border-white/10"
                style={{ background: "oklch(0.35 0.12 250 / 0.25)" }}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <p className="text-[10px] font-black text-accent uppercase tracking-[0.25em] mb-2">{txt("mission_eyebrow", "Mission")}</p>
              <h3 className="text-xl font-black text-white mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                {txt("mission_title", "Excellence in Education")}
              </h3>
              <p className="text-white/55 leading-[1.8] text-[14px]">
                {txt("mission_description", "To educate all students to the highest levels of achievement, preparing them to be productive, ethical, and creative members of society equipped with the knowledge, skills, and values needed for sustainable development.")}
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
              <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">{txt("gallery_label", "Campus Life")}</p>
              <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-foreground leading-[1.08]"
                style={{ fontFamily: "var(--font-heading)" }}>
                {txt("gallery_title", "Life at AL NAMAA")}
              </h2>
            </div>
          </div>
          {/* Asymmetric grid: 1 tall left + 4 small right */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[180px] gap-3">
            {list<any>("gallery", [
              { image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&q=80", caption: "Collaborative Learning" },
              { image: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80", caption: "Study Session" },
              { image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&q=80", caption: "School Library" },
              { image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80", caption: "Science Laboratory" },
              { image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&q=80", caption: "School Sports" },
              { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80", caption: "Teacher & Students" },
            ]).map((img, i) => (
              <div key={`${img.caption}-${i}`}
                className={`reveal delay-${(i % 4) * 50} group relative overflow-hidden rounded-2xl cursor-pointer
                  ${i === 0 ? "row-span-2 col-span-1" : ""}`}>
                <Image src={img.image} alt={img.caption} fill
                  className="object-cover group-hover:scale-108 transition-transform duration-700" style={{ transitionDuration: "700ms" }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-400" />
                <div className="absolute bottom-0 left-0 right-0 flex items-end p-4">
                  <span className="text-[12px] font-bold text-white drop-shadow-lg">{img.caption}</span>
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
                <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] mb-3">{txt("admissions_label", "Enroll Now")}</p>
                <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}>
                  {txt("admissions_title", "Admissions Open for 2026/2027")}
                </h2>
                <p className="mt-4 text-white/80 text-[14px] leading-[1.75]">
                  {txt("admissions_description", "Secure your child’s place at AL NAMAA ACADEMY. Applications are now being accepted for all three educational levels.")}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {list<string>("admission_levels", [
                  "Nursery \u2014 Early Childhood Education",
                  "Primary \u2014 Foundation & Intermediate Learning",
                  "Secondary \u2014 Advanced Academic Studies",
                ]).map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                    <span className="text-sm text-white/90 font-medium">{item}</span>
                  </div>
                ))}
                <div className="mt-3">
                  <Link href="#contact">
                    <Button className="bg-white hover:bg-white/90 h-11 px-7 text-sm font-black shadow-xl"
                      style={{ color: "var(--accent)" }}>
                      {txt("admissions_cta", "Contact Admissions")} <ArrowRight className="ml-2 h-4 w-4" />
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
                  <span className="text-sm font-black text-foreground">{txt("admissions_status_title", "Online Applications")}</span>
                  {admissionWindow ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-[11px] font-black text-green-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      {txt("admissions_status_open_label", "OPEN")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-black text-muted-foreground">
                      {txt("admissions_status_closed_label", "CLOSED")}
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
                    {txt("admissions_status_closed_message", "No application window is currently open. Check back later or contact the admissions office.")}
                  </p>
                )}
              </div>
            </div>
            {admissionWindow && (
              <Link href="/apply" className="shrink-0">
                <Button className="h-11 px-7 text-sm font-black shadow-lg shadow-primary/15">
                  {txt("admissions_status_apply_label", "Apply Now")} <ArrowRight className="ml-2 h-4 w-4" />
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
              <p className="reveal label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">{txt("news_label", "Latest")}</p>
              <h2 className="reveal delay-100 text-4xl lg:text-5xl font-black text-foreground leading-[1.06]"
                style={{ fontFamily: "var(--font-heading)" }}>
                {txt("news_section_title", "News & Updates")}
              </h2>
            </div>
          </div>

          {/* Featured � full-width horizontal card */}
          {(() => {
            // Clearing every field of the featured post is how an administrator
            // removes the block, so an empty object must render nothing rather
            // than an empty card with a stray "Read Full Story" under it.
            const raw = content.featured_news_post
            const post: any = raw && typeof raw === "object" && Object.keys(raw).length
              ? raw
              : FEATURED_NEWS_FALLBACK
            if (!post.title && !post.image && !post.excerpt) return null
            const card = (
              <div className="reveal group grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card hover:shadow-2xl hover:-translate-y-1 transition-all duration-400 cursor-pointer mb-5">
                <div className="relative h-64 lg:h-auto overflow-hidden">
                  {post.image && (
                    <Image
                      src={post.image}
                      alt={post.title || "Featured story"} fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
                  <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-white text-[10px] font-black shadow-lg"
                    style={{ background: "var(--accent)" }}>
                    {txt("news_featured_badge", "Featured")}
                  </span>
                </div>
                <div className="p-8 lg:p-10 flex flex-col justify-center">
                  <p className="text-[11px] font-bold text-muted-foreground mb-3 tracking-wide">{post.date}</p>
                  <h3 className="text-2xl lg:text-3xl font-black text-foreground leading-tight group-hover:text-primary transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}>
                    {post.title}
                  </h3>
                  <p className="mt-4 text-[14px] text-muted-foreground leading-[1.8]">{post.excerpt}</p>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary">
                    {txt("news_read_full_label", "Read Full Story")} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            )
            return post.link ? <Link href={post.link}>{card}</Link> : card
          })()}

          {/* 3 equal cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {list<any>("news_cards", NEWS_CARDS_FALLBACK)
              .slice(0, Number(content.news_max_display) || 3)
              .map((a: any, i: number) => (
              <div key={`${a.title}-${i}`}
                className={`reveal delay-${i * 100} group overflow-hidden rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col`}>
                <div className="relative h-44 overflow-hidden shrink-0">
                  {a.image && (
                    <Image src={a.image} alt={a.title || ""} fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {a.category && (
                    <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full ${NEWS_CATEGORY_COLORS[i % NEWS_CATEGORY_COLORS.length]} text-white text-[10px] font-black`}>
                      {a.category}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-[11px] text-muted-foreground mb-2">{a.date}</p>
                  <h4 className="text-sm font-black text-foreground leading-snug group-hover:text-primary transition-colors flex-1"
                    style={{ fontFamily: "var(--font-heading)" }}>
                    {a.title}
                  </h4>
                  <p className="text-[12px] text-muted-foreground mt-2 leading-[1.65] line-clamp-2">{a.excerpt}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-bold text-primary">
                    {txt("news_read_more_label", "Read More")} <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
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
              <p className="label-pill text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-4">{txt("contact_section_label", "Contact Us")}</p>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-[1.06]"
                style={{ fontFamily: "var(--font-heading)" }}>
                {txt("contact_heading", "Get in Touch \u2014")}<br />
                <span className="text-primary">{txt("contact_heading_highlight", "We\u2019re Here to Help")}</span>
              </h2>
            </div>
            <div className="reveal-right lg:pb-1">
              <p className="text-[15px] text-muted-foreground leading-[1.8]">
                {txt("contact_intro", "Whether you\u2019re a prospective parent, current student family, or community member, our team is ready to assist you with any enquiries about admissions, fees, or general information.")}
              </p>
            </div>
          </div>

          {/* 2-col: info left, form right � equal height */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

            {/* Left � info panel */}
            <div className="reveal-left rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
              {/* Top accent strip */}
              <div className="px-7 py-6 border-b border-border" style={{ background: "var(--accent)" }}>
                <p className="text-[11px] font-black text-white/70 uppercase tracking-[0.22em] mb-1">{txt("contact_label", "Our Campus")}</p>
                <p className="text-lg font-black text-white" style={{ fontFamily: "var(--font-heading)" }}>
                  {txt("contact_area", "Kisauni, West “B” District")}
                </p>
                <p className="text-sm text-white/75 mt-0.5">{txt("contact_region", "Zanzibar, Tanzania")}</p>
              </div>

              {/* Contact rows */}
              <div className="flex flex-col flex-1 divide-y divide-border">
                {[
                  ...list<any>("contact_phones", [
                    { label: "Nursery Enquiries",   value: "+255 774 221 707" },
                    { label: "Primary Enquiries",   value: "+255 652 898 731" },
                    { label: "Secondary Enquiries", value: "+255 777 397 422" },
                  ]).map((c: any) => ({ ...c, icon: Phone })),
                  { icon: Clock, label: "Office Hours", value: txt("contact_hours", "Monday – Friday · 8:00 AM – 4:00 PM") },
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
                  {txt("contact_registration_line", "Reg. No. P 10082026 • ZRB: Z052610299 • TIN: 175-002-324")}
                </p>
              </div>
            </div>

            {/* Right � form. Hidden entirely when the school would rather take
                enquiries by phone; the info panel then spans the row. */}
            <div className={`reveal-right ${content.display_contact_form === false ? "hidden" : ""}`}>
              <div className="rounded-2xl border border-border bg-card p-7 shadow-2xl shadow-foreground/5 h-full flex flex-col">
                <h3 className="text-xl font-black text-foreground mb-6" style={{ fontFamily: "var(--font-heading)" }}>
                  {txt("contact_form_title", "Send an Enquiry")}
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
                    {txt("contact_form_button", "Send Message")} <ArrowRight className="ml-2 h-4 w-4" />
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
                <img src={branding.logo} alt={branding.schoolName} style={{ width: 42, height: 42 }}
                  className="rounded-xl object-cover ring-1 ring-white/10" />
                <div>
                  <p className="text-[13px] font-bold text-white leading-tight">{branding.schoolName}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{txt("footer_established", "Kisauni, Zanzibar • Est. 2020")}</p>
                </div>
              </div>
              <p className="text-[12px] text-white/35 leading-[1.8] mb-5">
                {txt("footer_description", "“Expect Success” — Officially recognised by the Ministry of Education and Vocational Training, Zanzibar. Delivering excellence through Islamic values.")}
              </p>
              <div className="space-y-1 text-[11px] text-white/20">
                {list<string>("footer_registration_lines", [
                  "Reg. No. P 10082026  |  ZRB: Z052610299",
                  "TIN: 175-002-324  |  BSL-SP20025-2026/51066",
                ]).map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </div>

            {/* School links */}
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.22em] mb-5">{txt("footer_school_links_title", "School")}</h4>
              <div className="flex flex-col gap-3">
                {list<any>("footer_school_links", [
                  { label: "About Us", href: "/#about" },
                  { label: "Our Programs", href: "/#programs" },
                  { label: "Admissions", href: "/#admissions" },
                  { label: "Campus Life", href: "/#gallery" },
                  { label: "News", href: "/#news" },
                ]).map((l, i) => (
                  <a key={`${l.label}-${i}`} href={l.href || "#"}
                    className="text-[12px] text-white/40 hover:text-white transition-colors duration-200">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Portals */}
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.22em] mb-5">{txt("footer_portals_title", "Portals")}</h4>
              <div className="flex flex-col gap-3">
                {list<any>("footer_portal_links", [
                  { label: "Student Portal", href: "/login" },
                  { label: "Parent Portal", href: "/login" },
                  { label: "Staff Portal", href: "/login" },
                  { label: "Results Portal", href: "/results" },
                  { label: "Admin Login", href: "/login" },
                ]).map((l, i) => (
                  <a key={`${l.label}-${i}`} href={l.href || "/login"}
                    className="text-[12px] text-white/40 hover:text-white transition-colors duration-200">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Contact info */}
            <div className="md:col-span-4">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.22em] mb-5">{txt("footer_contact_title", "Contact")}</h4>
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <span className="text-[12px] text-white/40 leading-relaxed">
                    {txt("contact_area", "Kisauni, West “B” District")},<br />{txt("contact_region", "Zanzibar, Tanzania")}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  <div className="text-[12px] text-white/40 space-y-1">
                    {list<any>("contact_phones", [
                      { label: "Nursery Enquiries",   value: "+255 774 221 707" },
                      { label: "Primary Enquiries",   value: "+255 652 898 731" },
                      { label: "Secondary Enquiries", value: "+255 777 397 422" },
                    ]).map((c, i) => <p key={i}>{c.label}: {c.value}</p>)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="text-[12px] text-white/40">{txt("contact_hours", "Monday – Friday · 8:00 AM – 4:00 PM")}</span>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const socials = list<any>("social_media_links", [])
              .filter((sm) => sm && sm.url)
            if (!socials.length) return null
            return (
              <div className="mt-8 flex items-center gap-3">
                {socials.map((sm, i) => {
                  const Icon = SOCIAL_ICONS[String(sm.platform || "").toLowerCase()] ?? Globe
                  return (
                    <a key={`${sm.platform}-${i}`} href={sm.url} target="_blank" rel="noopener noreferrer"
                      aria-label={sm.platform || "Social link"}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-accent/40 transition-colors">
                      <Icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </div>
            )
          })()}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-white/20">
              {txt("footer_copyright", "© 2026 AL NAMAA ACADEMY. All rights reserved.")}
            </p>
            <p className="text-[11px] font-black text-white/15 tracking-[0.3em] uppercase">
              &ldquo;{txt("footer_tagline", "Expect Success")}&rdquo;
            </p>
          </div>
        </div>
      </footer>

      {content.whatsapp_enabled && txt("whatsapp_number", "") ? (
        <a
          href={`https://wa.me/${txt("whatsapp_number", "").replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-110"
          style={{ background: "#25D366" }}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </a>
      ) : null}
    </div>
  )
}
