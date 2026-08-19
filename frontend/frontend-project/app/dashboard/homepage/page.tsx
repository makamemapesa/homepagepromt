"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api } from "@/lib/api-client"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react"
import Link from "next/link"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/** Field spec for the repeatable list editors below. */
type ListField = { key: string; label: string; type?: "text" | "textarea" | "icon" }

const ICON_CHOICES = [
  "book", "heart", "users", "shield", "globe", "award", "star", "sparkles", "graduation", "check",
]

/** Every content block, grouped into the tabs the editor shows. */
const TEXT_FIELDS: Record<string, { key: string; label: string; area?: boolean }[]> = {
  branding: [
    { key: "school_name", label: "School name" },
    { key: "tagline", label: "Tagline (shown under the name)" },
    { key: "logo_url", label: "Logo image URL (used when no file is uploaded)" },
  ],
  hero: [
    { key: "hero_badge_text", label: "Badge text (when admissions are closed)" },
    { key: "hero_title", label: "Headline" },
    { key: "hero_subtitle", label: "Sub-headline" },
    { key: "hero_description", label: "Description", area: true },
    { key: "hero_primary_cta", label: "Primary button label" },
    { key: "hero_secondary_cta", label: "Secondary button label" },
    { key: "hero_image", label: "Background image URL" },
    { key: "hero_video_url", label: "Video embed URL" },
  ],
  about: [
    { key: "about_label", label: "Section label" },
    { key: "about_title", label: "Title" },
  ],
  support: [
    { key: "support_label", label: "Section label" },
    { key: "support_title", label: "Title" },
    { key: "support_description", label: "Description", area: true },
    { key: "support_cta", label: "Button label" },
  ],
  programs: [
    { key: "programs_label", label: "Section label" },
    { key: "programs_title", label: "Title" },
  ],
  features: [
    { key: "features_label", label: "Section label" },
    { key: "features_title", label: "Title" },
    { key: "features_description", label: "Description", area: true },
    { key: "features_badge_title", label: "Accreditation badge title" },
    { key: "features_badge_subtitle", label: "Accreditation badge subtitle" },
  ],
  purpose: [
    { key: "purpose_label", label: "Section label" },
    { key: "purpose_title", label: "Section title" },
    { key: "vision_title", label: "Vision title" },
    { key: "vision_description", label: "Vision text", area: true },
    { key: "mission_title", label: "Mission title" },
    { key: "mission_description", label: "Mission text", area: true },
  ],
  gallery: [
    { key: "gallery_label", label: "Section label" },
    { key: "gallery_title", label: "Title" },
  ],
  admissions: [
    { key: "admissions_label", label: "Section label" },
    { key: "admissions_title", label: "Title" },
    { key: "admissions_description", label: "Description", area: true },
    { key: "admissions_cta", label: "Button label" },
  ],
  news: [
    { key: "news_section_title", label: "Section title" },
    { key: "news_section_subtitle", label: "Section subtitle", area: true },
  ],
  contact: [
    { key: "contact_label", label: "Section label" },
    { key: "contact_area", label: "Campus area" },
    { key: "contact_region", label: "Region / country" },
    { key: "contact_hours", label: "Office hours" },
    { key: "contact_registration_line", label: "Registration line" },
  ],
  footer: [
    { key: "footer_established", label: "Location & established line" },
    { key: "footer_description", label: "Footer description", area: true },
    { key: "footer_copyright", label: "Copyright line" },
  ],
}

const LIST_SPECS: Record<string, ListField[]> = {
  hero_stats: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }],
  credentials: [{ key: "label", label: "Label" }, { key: "value", label: "Value" }],
  support_stats: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }],
  stats_banner: [{ key: "value", label: "Value" }, { key: "label", label: "Label" }, { key: "sub", label: "Sub-text" }],
  programs: [
    { key: "number", label: "Number" }, { key: "level", label: "Level" },
    { key: "ages", label: "Stage" }, { key: "phone", label: "Phone" },
    { key: "image", label: "Image URL" }, { key: "description", label: "Description", type: "textarea" },
  ],
  features: [
    { key: "icon", label: "Icon", type: "icon" }, { key: "title", label: "Title" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  gallery: [{ key: "image", label: "Image URL" }, { key: "caption", label: "Caption" }],
  contact_phones: [{ key: "label", label: "Label" }, { key: "value", label: "Number" }],
  news_cards: [
    { key: "title", label: "Headline" }, { key: "category", label: "Category" },
    { key: "date", label: "Date" }, { key: "image", label: "Image URL" },
    { key: "excerpt", label: "Excerpt", type: "textarea" },
  ],
}

const STRING_LISTS = ["about_paragraphs", "about_highlights", "admission_levels", "footer_registration_lines"]
const OBJECT_LISTS = Object.keys(LIST_SPECS)

export default function HomepageEditorPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const [content, setContent] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState("")

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const load = () => {
    // Read with a plain fetch so the payload keeps the snake_case keys the API
    // stores — the editor then sends back exactly what it received.
    fetch(`${BASE_URL}/api/homepage-content/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setContent(d)
          setLogoPreview(d.logo || "")
        }
      })
      .catch(() => setError("Could not load the homepage content."))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (authLoading || !user || !["super_admin", "admin"].includes(user.role)) return null

  const set = (key: string, value: any) => {
    setContent((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const setListItem = (key: string, index: number, field: string, value: any) =>
    set(key, (content[key] || []).map((row: any, i: number) => (i === index ? { ...row, [field]: value } : row)))

  const addListItem = (key: string, blank: any) => set(key, [...(content[key] || []), blank])
  const removeListItem = (key: string, index: number) =>
    set(key, (content[key] || []).filter((_: any, i: number) => i !== index))

  const save = () => {
    setSaving(true)
    setError("")
    const form = new FormData()

    Object.values(TEXT_FIELDS).flat().forEach(({ key }) => {
      form.append(key, content[key] ?? "")
    })
    STRING_LISTS.forEach((key) => {
      const rows = (content[key] || []).map((v: string) => (v ?? "").toString()).filter(Boolean)
      form.append(key, JSON.stringify(rows))
    })
    OBJECT_LISTS.forEach((key) => {
      form.append(key, JSON.stringify(content[key] || []))
    })
    form.append("featured_news_post", JSON.stringify(content.featured_news_post || {}))
    if (logoFile) form.append("logo_upload", logoFile)
    if (heroImageFile) form.append("hero_image_upload", heroImageFile)
    if (heroVideoFile) form.append("hero_video_upload", heroVideoFile)

    api.patch("/api/homepage-content/", form)
      .then(() => {
        setSaved(true)
        setLogoFile(null); setHeroImageFile(null); setHeroVideoFile(null)
        load()
        setTimeout(() => setSaved(false), 4000)
      })
      .catch((e) => {
        const data = e?.response?.data
        const first = data && typeof data === "object" ? Object.entries(data)[0] : null
        setError(first ? `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}` : "Could not save. Please try again.")
      })
      .finally(() => setSaving(false))
  }

  const TextFields = ({ group }: { group: string }) => (
    <div className="grid gap-4 md:grid-cols-2">
      {TEXT_FIELDS[group].map((f) => (
        <div key={f.key} className={`flex flex-col gap-1.5 ${f.area ? "md:col-span-2" : ""}`}>
          <Label>{f.label}</Label>
          {f.area ? (
            <Textarea rows={3} value={content[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          ) : (
            <Input value={content[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  )

  const StringList = ({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => addListItem(name, "")}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {(content[name] || []).map((value: string, i: number) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea
            rows={2}
            placeholder={placeholder}
            value={value ?? ""}
            onChange={(e) => set(name, (content[name] || []).map((v: string, idx: number) => (idx === i ? e.target.value : v)))}
          />
          <Button type="button" variant="ghost" size="icon" className="mt-1 text-destructive"
            onClick={() => removeListItem(name, i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {(content[name] || []).length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing yet — the page shows its built-in text until you add some.</p>
      )}
    </div>
  )

  const ObjectList = ({ name, label, itemName }: { name: string; label: string; itemName: string }) => {
    const spec = LIST_SPECS[name]
    const blank = Object.fromEntries(spec.map((f) => [f.key, ""]))
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => addListItem(name, blank)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add {itemName}
          </Button>
        </div>
        {(content[name] || []).map((row: any, i: number) => (
          <div key={i} className="relative rounded-lg border border-border p-4">
            <button type="button" onClick={() => removeListItem(name, i)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {itemName} {i + 1}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {spec.map((f) => (
                <div key={f.key} className={`flex flex-col gap-1.5 ${f.type === "textarea" ? "md:col-span-2" : ""}`}>
                  <Label className="text-xs">{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea rows={2} value={row[f.key] ?? ""} onChange={(e) => setListItem(name, i, f.key, e.target.value)} />
                  ) : f.type === "icon" ? (
                    <Select value={row[f.key] || "award"} onValueChange={(v) => setListItem(name, i, f.key, v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICON_CHOICES.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={row[f.key] ?? ""} onChange={(e) => setListItem(name, i, f.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {(content[name] || []).length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing yet — the page shows its built-in items until you add some.</p>
        )}
      </div>
    )
  }

  const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )

  if (loading) {
    return (
      <>
        <DashboardHeader title="Homepage" description="Manage everything shown on the public website." />
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      </>
    )
  }

  return (
    <>
      <DashboardHeader
        title="Homepage"
        description="Manage everything shown on the public website. Changes go live as soon as you save."
      />

      <div className="p-4 md:p-6 space-y-4">
        {/* Save bar */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-accent">
                <CheckCircle2 className="h-4 w-4" /> Saved — the site is updated
              </span>
            )}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
          <Link href="/" target="_blank">
            <Button variant="outline" size="sm">
              View live homepage <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="branding">
          <TabsList className="flex w-full flex-wrap justify-start gap-1">
            {["branding", "hero", "about", "support", "programs", "features",
              "purpose", "gallery", "admissions", "news", "contact", "footer"].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="branding" className="mt-4 space-y-4">
            <Section title="Logo & name" description="Shown in the website header and footer, on the login screen and in the dashboard sidebar.">
              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={logoPreview || "/farouk-logo.jpeg"}
                    alt="Logo preview"
                    className="h-20 w-20 rounded-xl border border-border object-cover"
                  />
                  <span className="text-[11px] text-muted-foreground">Current logo</span>
                </div>
                <div className="flex-1 min-w-[240px] space-y-1.5">
                  <Label>Upload a new logo</Label>
                  <Input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setLogoFile(file)
                    if (file) setLogoPreview(URL.createObjectURL(file))
                    setSaved(false)
                  }} />
                  <p className="text-[11px] text-muted-foreground">
                    A square image works best. An uploaded file takes priority over the URL below.
                  </p>
                </div>
              </div>
              <TextFields group="branding" />
            </Section>
          </TabsContent>

          <TabsContent value="hero" className="mt-4 space-y-4">
            <Section title="Hero section">
              <TextFields group="hero" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Upload background image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => { setHeroImageFile(e.target.files?.[0] || null); setSaved(false) }} />
                </div>
                <div className="space-y-1.5">
                  <Label>Upload video</Label>
                  <Input type="file" accept="video/*" onChange={(e) => { setHeroVideoFile(e.target.files?.[0] || null); setSaved(false) }} />
                </div>
              </div>
              <ObjectList name="hero_stats" label="Hero statistics" itemName="Stat" />
            </Section>
            <Section title="Credentials strip" description="The registration numbers shown just below the hero.">
              <ObjectList name="credentials" label="Credentials" itemName="Credential" />
            </Section>
            <Section title="Statistics banner" description="The dark band of headline numbers.">
              <ObjectList name="stats_banner" label="Banner statistics" itemName="Stat" />
            </Section>
          </TabsContent>

          <TabsContent value="about" className="mt-4">
            <Section title="About section">
              <TextFields group="about" />
              <StringList name="about_paragraphs" label="Paragraphs" placeholder="A paragraph of the about text" />
              <StringList name="about_highlights" label="Tags" placeholder="e.g. NECTA Aligned" />
            </Section>
          </TabsContent>

          <TabsContent value="support" className="mt-4">
            <Section title="Sponsorship section">
              <TextFields group="support" />
              <ObjectList name="support_stats" label="Sponsorship statistics" itemName="Stat" />
            </Section>
          </TabsContent>

          <TabsContent value="programs" className="mt-4">
            <Section title="Academic programs">
              <TextFields group="programs" />
              <ObjectList name="programs" label="Programme cards" itemName="Programme" />
            </Section>
          </TabsContent>

          <TabsContent value="features" className="mt-4">
            <Section title="Why choose us">
              <TextFields group="features" />
              <ObjectList name="features" label="Feature cards" itemName="Feature" />
            </Section>
          </TabsContent>

          <TabsContent value="purpose" className="mt-4">
            <Section title="Vision & mission">
              <TextFields group="purpose" />
            </Section>
          </TabsContent>

          <TabsContent value="gallery" className="mt-4">
            <Section title="Campus gallery">
              <TextFields group="gallery" />
              <ObjectList name="gallery" label="Gallery images" itemName="Image" />
            </Section>
          </TabsContent>

          <TabsContent value="admissions" className="mt-4">
            <Section title="Admissions banner">
              <TextFields group="admissions" />
              <StringList name="admission_levels" label="Levels offered" placeholder="e.g. Primary — Foundation Learning" />
            </Section>
          </TabsContent>

          <TabsContent value="news" className="mt-4">
            <Section title="News & updates">
              <TextFields group="news" />
              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Featured post</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {[["title", "Headline"], ["category", "Category"], ["date", "Date"], ["image", "Image URL"]].map(([k, l]) => (
                    <div key={k} className="flex flex-col gap-1.5">
                      <Label className="text-xs">{l}</Label>
                      <Input
                        value={content.featured_news_post?.[k] ?? ""}
                        onChange={(e) => set("featured_news_post", { ...(content.featured_news_post || {}), [k]: e.target.value })}
                      />
                    </div>
                  ))}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label className="text-xs">Excerpt</Label>
                    <Textarea rows={3}
                      value={content.featured_news_post?.excerpt ?? ""}
                      onChange={(e) => set("featured_news_post", { ...(content.featured_news_post || {}), excerpt: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <ObjectList name="news_cards" label="News cards" itemName="Story" />
            </Section>
          </TabsContent>

          <TabsContent value="contact" className="mt-4">
            <Section title="Contact details">
              <TextFields group="contact" />
              <ObjectList name="contact_phones" label="Phone numbers" itemName="Number" />
            </Section>
          </TabsContent>

          <TabsContent value="footer" className="mt-4">
            <Section title="Footer">
              <TextFields group="footer" />
              <StringList name="footer_registration_lines" label="Registration lines" placeholder="e.g. TIN: 175-002-324" />
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
