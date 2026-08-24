"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api } from "@/lib/api-client"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowDown, ArrowUp, ExternalLink, Plus, RotateCcw, Save, Trash2, TriangleAlert,
} from "lucide-react"

/* ────────────────────────────────────────────────────────────────────────────
   The editor speaks the same key names as the model and the public page:
   snake_case, all the way through. The API client camelCases responses for the
   rest of the dashboard, so the one conversion happens on load and nowhere
   else — the previous editor sent camelCase keys inside a multipart body, which
   the API client deliberately does not convert, so the serializer ignored every
   field and each save was accepted while changing nothing.
   ──────────────────────────────────────────────────────────────────────────── */

const toSnake = (key: string) => key.replace(/([A-Z])/g, "_$1").toLowerCase()

/** Server-computed fields. Echoing them back is pointless, so they never go. */
const READ_ONLY = new Set(["id", "updated_at", "logo", "hero_image_resolved"])

type Column = {
  key: string
  label: string
  kind?: "text" | "textarea" | "url"
  placeholder?: string
}

type Field =
  // One literal per member: a union discriminant like `"textarea" | "code"`
  // stops TypeScript narrowing the fallback branch at the bottom of FieldEditor.
  | { key: string; label: string; kind: "text"; help?: string; placeholder?: string }
  | { key: string; label: string; kind: "url"; help?: string; placeholder?: string }
  | { key: string; label: string; kind: "textarea"; help?: string; rows?: number }
  | { key: string; label: string; kind: "code"; help?: string; rows?: number }
  | { key: string; label: string; kind: "number"; help?: string }
  | { key: string; label: string; kind: "switch"; help?: string }
  | { key: string; label: string; kind: "file"; accept: string; help?: string }
  | { key: string; label: string; kind: "strings"; itemLabel: string; help?: string }
  | { key: string; label: string; kind: "rows"; itemLabel: string; columns: Column[]; help?: string }
  | { key: string; label: string; kind: "record"; columns: Column[]; help?: string }

type Section = { id: string; title: string; blurb: string; fields: Field[] }

const LINK_COLUMNS: Column[] = [
  { key: "label", label: "Label" },
  { key: "href", label: "Link", placeholder: "/#about or https://…" },
]

const VALUE_LABEL_COLUMNS: Column[] = [
  { key: "value", label: "Value", placeholder: "100%" },
  { key: "label", label: "Label" },
]

/**
 * Every element the public homepage renders, in the order it appears there.
 * The form builds itself from this list, so a block cannot be quietly left out
 * of the UI — and adding one to the page means adding one entry here.
 */
const SECTIONS: Section[] = [
  {
    id: "site",
    title: "Site-wide",
    blurb: "Branding, the announcement bar, and switches that affect the whole page.",
    fields: [
      { key: "school_name", label: "School name", kind: "text", help: "Shown beside the logo in the header and footer." },
      { key: "tagline", label: "Tagline", kind: "text" },
      { key: "logo_upload", label: "Logo (upload)", kind: "file", accept: "image/*", help: "An uploaded logo takes precedence over the URL below." },
      { key: "logo_url", label: "Logo (URL)", kind: "url" },
      { key: "announcement_banner_enabled", label: "Show announcement bar", kind: "switch", help: "A strip above the navigation. Stays hidden while the text is empty." },
      { key: "announcement_banner_text", label: "Announcement text", kind: "text" },
      { key: "maintenance_mode_enabled", label: "Maintenance mode", kind: "switch", help: "Replaces the entire homepage with the notice below. The Login link stays available." },
      { key: "maintenance_mode_message", label: "Maintenance notice", kind: "textarea", rows: 3 },
      { key: "custom_css", label: "Custom CSS", kind: "code", rows: 6, help: "Injected last, so it overrides the page styles. Leave empty unless you know what you are changing." },
    ],
  },
  {
    id: "nav",
    title: "Navigation bar",
    blurb: "The links and buttons across the top of the page.",
    fields: [
      { key: "nav_links", label: "Menu links", kind: "rows", itemLabel: "link", columns: LINK_COLUMNS },
      { key: "nav_results_label", label: "Results button", kind: "text" },
      { key: "nav_apply_label", label: "Apply button", kind: "text", help: "Only appears while an admission window is open." },
      { key: "nav_login_label", label: "Login button", kind: "text" },
    ],
  },
  {
    id: "hero",
    title: "Hero",
    blurb: "The full-height banner: headline, buttons, video and the stats row.",
    fields: [
      { key: "hero_title", label: "Headline", kind: "text" },
      { key: "hero_subtitle", label: "Sub-headline", kind: "text" },
      { key: "hero_description", label: "Description", kind: "textarea", rows: 3 },
      { key: "hero_badge_text", label: "Eyebrow badge", kind: "text", help: "Replaced automatically while applications are open or closed." },
      { key: "hero_applications_open_text", label: "Badge — applications open", kind: "text" },
      { key: "hero_applications_closed_text", label: "Badge — applications closed", kind: "text" },
      { key: "hero_primary_cta", label: "Primary button", kind: "text" },
      { key: "hero_secondary_cta", label: "Secondary button", kind: "text" },
      { key: "hero_image_upload", label: "Background image (upload)", kind: "file", accept: "image/*" },
      { key: "hero_image", label: "Background image (URL)", kind: "url" },
      { key: "hero_video_upload", label: "Video (upload)", kind: "file", accept: "video/*", help: "An uploaded video plays instead of the embed URL." },
      { key: "hero_video_url", label: "Video embed URL", kind: "url", placeholder: "https://www.youtube.com/embed/…" },
      { key: "hero_video_thumbnail", label: "Video thumbnail", kind: "url" },
      { key: "hero_video_caption", label: "Video caption", kind: "text" },
      { key: "hero_scroll_label", label: "Scroll cue", kind: "text" },
      { key: "hero_stats", label: "Stats row", kind: "rows", itemLabel: "stat", columns: VALUE_LABEL_COLUMNS },
    ],
  },
  {
    id: "credentials",
    title: "Credentials strip",
    blurb: "The registration numbers immediately below the hero.",
    fields: [
      {
        key: "credentials", label: "Credentials", kind: "rows", itemLabel: "credential",
        columns: [{ key: "label", label: "Label" }, { key: "value", label: "Value" }],
      },
    ],
  },
  {
    id: "about",
    title: "About",
    blurb: "The two-column introduction and its photo collage.",
    fields: [
      { key: "about_label", label: "Eyebrow", kind: "text" },
      { key: "about_title", label: "Heading", kind: "text" },
      { key: "about_paragraphs", label: "Paragraphs", kind: "strings", itemLabel: "paragraph" },
      { key: "about_highlights", label: "Highlight tags", kind: "strings", itemLabel: "tag" },
      { key: "about_cta", label: "Button", kind: "text" },
      {
        key: "about_images", label: "Photo collage", kind: "rows", itemLabel: "photo",
        help: "The first photo spans the full width; the rest sit beside each other.",
        columns: [{ key: "image", label: "Image URL", kind: "url" }, { key: "alt", label: "Alt text" }],
      },
    ],
  },
  {
    id: "support",
    title: "Sponsorship teaser",
    blurb: "The dark panel about inclusive education and sponsorship.",
    fields: [
      { key: "support_label", label: "Eyebrow", kind: "text" },
      { key: "support_title", label: "Heading", kind: "text" },
      { key: "support_description", label: "Description", kind: "textarea", rows: 3 },
      { key: "support_cta", label: "Button", kind: "text" },
      { key: "support_stats", label: "Stats", kind: "rows", itemLabel: "stat", columns: VALUE_LABEL_COLUMNS },
    ],
  },
  {
    id: "stats",
    title: "Statistics banner",
    blurb: "The four large figures on the dark band.",
    fields: [
      {
        key: "stats_banner", label: "Figures", kind: "rows", itemLabel: "figure",
        columns: [
          { key: "value", label: "Value", placeholder: "100%" },
          { key: "label", label: "Label" },
          { key: "sub", label: "Sub-label" },
        ],
      },
    ],
  },
  {
    id: "programs",
    title: "Academic programmes",
    blurb: "The programme cards and their enquiry numbers.",
    fields: [
      { key: "programs_label", label: "Eyebrow", kind: "text" },
      { key: "programs_title", label: "Heading", kind: "text" },
      {
        key: "programs", label: "Programmes", kind: "rows", itemLabel: "programme",
        columns: [
          { key: "number", label: "Number", placeholder: "01" },
          { key: "level", label: "Level", placeholder: "Nursery" },
          { key: "ages", label: "Stage", placeholder: "Early Childhood" },
          { key: "description", label: "Description", kind: "textarea" },
          { key: "phone", label: "Enquiries phone" },
          { key: "image", label: "Image URL", kind: "url" },
        ],
      },
    ],
  },
  {
    id: "features",
    title: "Why choose us",
    blurb: "The header row, the accreditation badge and the feature cards.",
    fields: [
      { key: "features_label", label: "Eyebrow", kind: "text" },
      { key: "features_title", label: "Heading", kind: "text" },
      { key: "features_description", label: "Description", kind: "textarea", rows: 3 },
      { key: "features_badge_title", label: "Badge title", kind: "text" },
      { key: "features_badge_subtitle", label: "Badge subtitle", kind: "text" },
      {
        key: "features", label: "Feature cards", kind: "rows", itemLabel: "feature",
        help: "Icon accepts: book, heart, users, shield, globe, award, star, sparkles, graduation, check.",
        columns: [
          { key: "icon", label: "Icon", placeholder: "book" },
          { key: "title", label: "Title" },
          { key: "description", label: "Description", kind: "textarea" },
        ],
      },
    ],
  },
  {
    id: "purpose",
    title: "Vision & mission",
    blurb: "The two cards on the dark band.",
    fields: [
      { key: "purpose_label", label: "Eyebrow", kind: "text" },
      { key: "purpose_title", label: "Heading", kind: "text" },
      { key: "vision_eyebrow", label: "Vision — eyebrow", kind: "text" },
      { key: "vision_title", label: "Vision — title", kind: "text" },
      { key: "vision_description", label: "Vision — text", kind: "textarea", rows: 4 },
      { key: "mission_eyebrow", label: "Mission — eyebrow", kind: "text" },
      { key: "mission_title", label: "Mission — title", kind: "text" },
      { key: "mission_description", label: "Mission — text", kind: "textarea", rows: 4 },
    ],
  },
  {
    id: "gallery",
    title: "Campus gallery",
    blurb: "The photo grid. The first photo is rendered double-height.",
    fields: [
      { key: "gallery_label", label: "Eyebrow", kind: "text" },
      { key: "gallery_title", label: "Heading", kind: "text" },
      {
        key: "gallery", label: "Photos", kind: "rows", itemLabel: "photo",
        columns: [
          { key: "image", label: "Image URL", kind: "url" },
          { key: "caption", label: "Caption" },
        ],
      },
    ],
  },
  {
    id: "admissions",
    title: "Admissions",
    blurb: "The banner and the live application-status card beneath it.",
    fields: [
      { key: "admissions_label", label: "Eyebrow", kind: "text" },
      { key: "admissions_title", label: "Heading", kind: "text" },
      { key: "admissions_description", label: "Description", kind: "textarea", rows: 3 },
      { key: "admissions_cta", label: "Button", kind: "text" },
      { key: "admission_levels", label: "Levels listed", kind: "strings", itemLabel: "level" },
      { key: "admissions_status_title", label: "Status card — title", kind: "text" },
      { key: "admissions_status_open_label", label: "Status card — open badge", kind: "text" },
      { key: "admissions_status_closed_label", label: "Status card — closed badge", kind: "text" },
      { key: "admissions_status_closed_message", label: "Status card — closed message", kind: "textarea", rows: 2 },
      { key: "admissions_status_apply_label", label: "Status card — apply button", kind: "text" },
    ],
  },
  {
    id: "news",
    title: "News & updates",
    blurb: "The featured story and the cards below it.",
    fields: [
      { key: "news_label", label: "Eyebrow", kind: "text" },
      { key: "news_section_title", label: "Heading", kind: "text" },
      { key: "news_featured_badge", label: "Featured badge", kind: "text" },
      { key: "news_read_full_label", label: "Featured link text", kind: "text" },
      { key: "news_read_more_label", label: "Card link text", kind: "text" },
      { key: "news_max_display", label: "Cards to show", kind: "number" },
      {
        key: "featured_news_post", label: "Featured story", kind: "record",
        help: "Clear the title, excerpt and image to hide the featured story entirely.",
        columns: [
          { key: "title", label: "Title" },
          { key: "date", label: "Date", placeholder: "March 10, 2026" },
          { key: "excerpt", label: "Excerpt", kind: "textarea" },
          { key: "image", label: "Image URL", kind: "url" },
          { key: "link", label: "Links to", kind: "url", placeholder: "Optional" },
        ],
      },
      {
        key: "news_cards", label: "News cards", kind: "rows", itemLabel: "story",
        columns: [
          { key: "title", label: "Title" },
          { key: "category", label: "Category" },
          { key: "date", label: "Date" },
          { key: "excerpt", label: "Excerpt", kind: "textarea" },
          { key: "image", label: "Image URL", kind: "url" },
        ],
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blurb: "The heading, the campus info panel and the enquiry form.",
    fields: [
      { key: "contact_section_label", label: "Eyebrow", kind: "text" },
      { key: "contact_heading", label: "Heading (first line)", kind: "text" },
      { key: "contact_heading_highlight", label: "Heading (highlighted line)", kind: "text" },
      { key: "contact_intro", label: "Intro paragraph", kind: "textarea", rows: 3 },
      { key: "contact_label", label: "Panel eyebrow", kind: "text" },
      { key: "contact_area", label: "Area", kind: "text" },
      { key: "contact_region", label: "Region", kind: "text" },
      {
        key: "contact_phones", label: "Phone numbers", kind: "rows", itemLabel: "number",
        columns: [{ key: "label", label: "Label" }, { key: "value", label: "Number" }],
      },
      { key: "contact_hours", label: "Office hours", kind: "text" },
      { key: "contact_registration_line", label: "Registration line", kind: "text" },
      { key: "display_contact_form", label: "Show enquiry form", kind: "switch" },
      { key: "contact_form_title", label: "Form title", kind: "text" },
      { key: "contact_form_button", label: "Form button", kind: "text" },
    ],
  },
  {
    id: "footer",
    title: "Footer",
    blurb: "Every column, the social icons and the copyright line.",
    fields: [
      { key: "footer_established", label: "Established line", kind: "text" },
      { key: "footer_description", label: "Description", kind: "textarea", rows: 3 },
      { key: "footer_registration_lines", label: "Registration lines", kind: "strings", itemLabel: "line" },
      { key: "footer_school_links_title", label: "School column — heading", kind: "text" },
      { key: "footer_school_links", label: "School column — links", kind: "rows", itemLabel: "link", columns: LINK_COLUMNS },
      { key: "footer_portals_title", label: "Portals column — heading", kind: "text" },
      { key: "footer_portal_links", label: "Portals column — links", kind: "rows", itemLabel: "link", columns: LINK_COLUMNS },
      { key: "footer_contact_title", label: "Contact column — heading", kind: "text" },
      {
        key: "social_media_links", label: "Social icons", kind: "rows", itemLabel: "profile",
        help: "Platform accepts: facebook, twitter, instagram, youtube, linkedin, whatsapp, telegram.",
        columns: [
          { key: "platform", label: "Platform", placeholder: "facebook" },
          { key: "url", label: "Profile URL", kind: "url" },
        ],
      },
      { key: "footer_copyright", label: "Copyright line", kind: "text" },
      { key: "footer_tagline", label: "Tagline", kind: "text" },
    ],
  },
  {
    id: "floating",
    title: "Floating WhatsApp button",
    blurb: "The round button that follows the visitor down the page.",
    fields: [
      { key: "whatsapp_enabled", label: "Show WhatsApp button", kind: "switch" },
      { key: "whatsapp_number", label: "WhatsApp number", kind: "text", placeholder: "+255 774 221 707" },
    ],
  },
]

const ALL_KEYS = SECTIONS.flatMap(s => s.fields.map(f => f.key))

/** Deep-equal enough for form values: strings, numbers, booleans, JSON blobs. */
function sameValue(a: any, b: any) {
  if (a instanceof File || b instanceof File) return false
  if (typeof a === "object" && a !== null) return JSON.stringify(a) === JSON.stringify(b)
  if (a === null || a === undefined) return b === null || b === undefined || b === ""
  return a === b
}

function toSnakeKeys(payload: any): Record<string, any> {
  const out: Record<string, any> = {}
  Object.entries(payload || {}).forEach(([k, v]) => { out[toSnake(k)] = v })
  return out
}

export default function HomepageEditorPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initial, setInitial] = useState<Record<string, any>>({})
  const [form, setForm] = useState<Record<string, any>>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  useEffect(() => {
    api.get("/api/homepage-content/")
      .then(r => {
        const snake = toSnakeKeys(r.data)
        setInitial(snake)
        setForm(snake)
        setLoadError("")
      })
      .catch(() => setLoadError("Could not load the homepage content. Nothing can be edited until it loads."))
      .finally(() => setLoading(false))
  }, [])

  const dirtyKeys = useMemo(
    () => ALL_KEYS.filter(key => !sameValue(form[key], initial[key])),
    [form, initial]
  )

  const setField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    if (!dirtyKeys.length) return

    const body = new FormData()
    for (const key of dirtyKeys) {
      if (READ_ONLY.has(key)) continue
      const value = form[key]
      if (value instanceof File) { body.append(key, value); continue }
      if (value === null || value === undefined) continue
      // Booleans and numbers must cross the wire as themselves. The previous
      // editor sent String(value || "") for everything, which turned `false`
      // and `0` into an empty string that the serializer rejects outright.
      if (typeof value === "boolean") { body.append(key, value ? "true" : "false"); continue }
      if (typeof value === "number") { body.append(key, String(value)); continue }
      if (typeof value === "object") { body.append(key, JSON.stringify(value)); continue }
      body.append(key, String(value))
    }

    setSaving(true); setErrors([]); setSavedAt(null)
    try {
      const res = await api.patch("/api/homepage-content/", body)
      // Re-seed from the response rather than from local state, so what the form
      // shows afterwards is what the homepage will actually serve.
      const snake = toSnakeKeys(res.data)
      setInitial(snake)
      setForm(snake)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err: any) {
      const data = err?.response?.data
      if (err?.response?.status === 403) {
        setErrors(["You are not allowed to edit the homepage."])
      } else if (data && typeof data === "object") {
        setErrors(Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`))
      } else {
        setErrors(["Could not save. Nothing was changed."])
      }
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user) return null
  if (!["super_admin", "admin"].includes(user.role)) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        title="Homepage"
        description="Every block on the public homepage, in the order it appears there."
      />

      {/* Sticky action bar, so Save follows you down a very long form. */}
      <div className="sticky top-0 z-30 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {dirtyKeys.length > 0 ? (
              <Badge variant="outline" className="border-yellow-400/30 bg-yellow-500/10 text-yellow-700">
                {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">No unsaved changes</Badge>
            )}
            {savedAt && <span className="text-xs text-accent">Applied to the homepage at {savedAt}</span>}
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />View homepage
              </Button>
            </a>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              disabled={!dirtyKeys.length || saving}
              onClick={() => setForm(initial)}
            >
              <RotateCcw className="h-4 w-4" />Discard
            </Button>
            <Button size="sm" className="gap-1.5" disabled={!dirtyKeys.length || saving} onClick={save}>
              <Save className="h-4 w-4" />{saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
        {errors.length > 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs text-destructive">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          </div>
        )}
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading homepage content…</p>
      ) : (
        <Accordion type="multiple" defaultValue={["hero"]} className="space-y-3">
          {SECTIONS.map(section => {
            const touched = section.fields.filter(f => dirtyKeys.includes(f.key)).length
            return (
              <AccordionItem key={section.id} value={section.id} className="rounded-lg border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
                    <div>
                      <p className="font-semibold">{section.title}</p>
                      <p className="text-xs font-normal text-muted-foreground">{section.blurb}</p>
                    </div>
                    {touched > 0 && (
                      <Badge variant="outline" className="shrink-0 border-yellow-400/30 bg-yellow-500/10 text-yellow-700">
                        {touched} edited
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <div className="grid grid-cols-1 gap-5">
                    {section.fields.map(field => (
                      <FieldEditor
                        key={field.key}
                        field={field}
                        value={form[field.key]}
                        dirty={dirtyKeys.includes(field.key)}
                        onChange={v => setField(field.key, v)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

/* ── Field renderers ──────────────────────────────────────────────────────── */

function FieldEditor({ field, value, dirty, onChange }: {
  field: Field
  value: any
  dirty: boolean
  onChange: (value: any) => void
}) {
  const label = (
    <div className="flex items-center gap-2">
      <Label className={dirty ? "text-yellow-700" : ""}>{field.label}</Label>
      {dirty && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
    </div>
  )
  const help = field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null

  if (field.kind === "switch") {
    return (
      <div className="flex items-start justify-between gap-4 rounded-md border p-3">
        <div className="space-y-1">{label}{help}</div>
        <Switch checked={value === true} onCheckedChange={onChange} />
      </div>
    )
  }

  if (field.kind === "file") {
    return (
      <div className="space-y-1.5">
        {label}
        <Input type="file" accept={field.accept}
          onChange={e => onChange(e.target.files?.[0] ?? null)} />
        {value instanceof File ? (
          <p className="text-xs text-accent">{value.name} — uploaded when you click Save Changes.</p>
        ) : typeof value === "string" && value ? (
          <p className="break-all text-xs text-muted-foreground">Current: {value}</p>
        ) : null}
        {help}
      </div>
    )
  }

  if (field.kind === "textarea" || field.kind === "code") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          rows={field.rows ?? 3}
          className={field.kind === "code" ? "font-mono text-xs" : ""}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
        />
        {help}
      </div>
    )
  }

  if (field.kind === "number") {
    return (
      <div className="space-y-1.5">
        {label}
        <Input
          type="number"
          className="max-w-[160px]"
          value={value ?? ""}
          // An empty box is not zero — send nothing rather than guess at one.
          onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {help}
      </div>
    )
  }

  if (field.kind === "strings") {
    return <StringListEditor field={field} value={value} label={label} help={help} onChange={onChange} />
  }

  if (field.kind === "rows") {
    return <RowListEditor field={field} value={value} label={label} help={help} onChange={onChange} />
  }

  if (field.kind === "record") {
    const record = value && typeof value === "object" && !Array.isArray(value) ? value : {}
    return (
      <div className="space-y-2">
        {label}{help}
        <Card><CardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2">
          {field.columns.map(col => (
            <ColumnInput key={col.key} column={col} value={record[col.key]}
              onChange={v => onChange({ ...record, [col.key]: v })} />
          ))}
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {label}
      <Input
        placeholder={field.placeholder}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
      />
      {help}
    </div>
  )
}

function ColumnInput({ column, value, onChange }: {
  column: Column
  value: any
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{column.label}</Label>
      {column.kind === "textarea" ? (
        <Textarea rows={2} value={value ?? ""} placeholder={column.placeholder}
          onChange={e => onChange(e.target.value)} />
      ) : (
        <Input value={value ?? ""} placeholder={column.placeholder}
          onChange={e => onChange(e.target.value)} />
      )}
    </div>
  )
}

/** Shared add / remove / reorder controls for both list editors. */
function ListControls({ index, count, onMove, onRemove }: {
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
        disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
        disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
        onClick={() => onRemove(index)} aria-label="Remove">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function useListOps(items: any[], onChange: (next: any[]) => void) {
  return {
    move: (from: number, to: number) => {
      const next = [...items]
      const [row] = next.splice(from, 1)
      next.splice(to, 0, row)
      onChange(next)
    },
    remove: (index: number) => onChange(items.filter((_, i) => i !== index)),
    update: (index: number, row: any) => onChange(items.map((r, i) => (i === index ? row : r))),
  }
}

function EmptyListNote({ itemLabel }: { itemLabel: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Empty — the homepage falls back to its built-in {itemLabel}s until you add one.
    </p>
  )
}

function StringListEditor({ field, value, label, help, onChange }: {
  field: Extract<Field, { kind: "strings" }>
  value: any
  label: React.ReactNode
  help: React.ReactNode
  onChange: (value: string[]) => void
}) {
  const items: string[] = Array.isArray(value) ? value : []
  const ops = useListOps(items, onChange as (next: any[]) => void)

  return (
    <div className="space-y-2">
      {label}{help}
      {items.length === 0 && <EmptyListNote itemLabel={field.itemLabel} />}
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <Textarea rows={2} className="flex-1" value={item}
            onChange={e => ops.update(i, e.target.value)} />
          <ListControls index={i} count={items.length} onMove={ops.move} onRemove={ops.remove} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5"
        onClick={() => onChange([...items, ""])}>
        <Plus className="h-3.5 w-3.5" />Add {field.itemLabel}
      </Button>
    </div>
  )
}

function RowListEditor({ field, value, label, help, onChange }: {
  field: Extract<Field, { kind: "rows" }>
  value: any
  label: React.ReactNode
  help: React.ReactNode
  onChange: (value: any[]) => void
}) {
  const items: any[] = Array.isArray(value) ? value : []
  const ops = useListOps(items, onChange)
  const blank = Object.fromEntries(field.columns.map(c => [c.key, ""]))

  return (
    <div className="space-y-2">
      {label}{help}
      {items.length === 0 && <EmptyListNote itemLabel={field.itemLabel} />}
      {items.map((row, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3 pt-4">
            <span className="mt-2 w-5 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
              {field.columns.map(col => (
                <ColumnInput key={col.key} column={col} value={row?.[col.key]}
                  onChange={v => ops.update(i, { ...row, [col.key]: v })} />
              ))}
            </div>
            <ListControls index={i} count={items.length} onMove={ops.move} onRemove={ops.remove} />
          </CardContent>
        </Card>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5"
        onClick={() => onChange([...items, blank])}>
        <Plus className="h-3.5 w-3.5" />Add {field.itemLabel}
      </Button>
    </div>
  )
}
