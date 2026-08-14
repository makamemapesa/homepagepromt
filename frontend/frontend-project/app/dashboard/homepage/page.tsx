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

function SavedBanner() {
  return (
    <div className="flex items-center gap-2 text-sm text-accent">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>Saved</span>
    </div>
  )
}

export default function HomepageEditorPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)

  const [heroTitle, setHeroTitle] = useState("")
  const [heroSubtitle, setHeroSubtitle] = useState("")
  const [heroDescription, setHeroDescription] = useState("")
  const [heroPrimaryCta, setHeroPrimaryCta] = useState("")
  const [heroSecondaryCta, setHeroSecondaryCta] = useState("")
  const [heroVideoUrl, setHeroVideoUrl] = useState("")
  const [heroImage, setHeroImage] = useState("")
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [aboutTitle, setAboutTitle] = useState("")
  const [aboutDescription, setAboutDescription] = useState("")
  const [aboutHighlights, setAboutHighlights] = useState("")
  const [visionTitle, setVisionTitle] = useState("")
  const [visionDescription, setVisionDescription] = useState("")
  const [missionTitle, setMissionTitle] = useState("")
  const [missionDescription, setMissionDescription] = useState("")
  const [newsSectionTitle, setNewsSectionTitle] = useState("")
  const [newsSectionSubtitle, setNewsSectionSubtitle] = useState("")
  const [featuredNewsPost, setFeaturedNewsPost] = useState({ title: "", excerpt: "", date: "", image: "", category: "Featured" })
  const [newsCards, setNewsCards] = useState([
    { title: "", excerpt: "", date: "", image: "", category: "" },
    { title: "", excerpt: "", date: "", image: "", category: "" },
    { title: "", excerpt: "", date: "", image: "", category: "" },
  ])

  useEffect(() => {
    api.get("/api/homepage-content/")
      .then((r) => {
        const d = r.data
        setHeroTitle(d.heroTitle || "")
        setHeroSubtitle(d.heroSubtitle || "")
        setHeroDescription(d.heroDescription || "")
        setHeroPrimaryCta(d.heroPrimaryCta || "Apply for Admission")
        setHeroSecondaryCta(d.heroSecondaryCta || "Discover More")
        setHeroVideoUrl(d.heroVideoUrl || "")
        setHeroImage(d.heroImage || "")
        setPreviewUrl(d.heroImageUpload || d.heroImage || "")
        setAboutTitle(d.aboutTitle || "")
        setAboutDescription(d.aboutDescription || "")
        setAboutHighlights(Array.isArray(d.aboutHighlights) ? d.aboutHighlights.join(", ") : "")
        setVisionTitle(d.visionTitle || "")
        setVisionDescription(d.visionDescription || "")
        setMissionTitle(d.missionTitle || "")
        setMissionDescription(d.missionDescription || "")
        setNewsSectionTitle(d.newsSectionTitle || "News & Updates")
        setNewsSectionSubtitle(d.newsSectionSubtitle || "Latest school stories, achievements and announcements")
        setFeaturedNewsPost({
          title: d.featuredNewsPost?.title || "",
          excerpt: d.featuredNewsPost?.excerpt || "",
          date: d.featuredNewsPost?.date || "",
          image: d.featuredNewsPost?.image || "",
          category: d.featuredNewsPost?.category || "Featured",
        })
        setNewsCards(Array.isArray(d.newsCards) && d.newsCards.length > 0 ? d.newsCards : [
          { title: "", excerpt: "", date: "", image: "", category: "" },
          { title: "", excerpt: "", date: "", image: "", category: "" },
          { title: "", excerpt: "", date: "", image: "", category: "" },
        ])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    // basic client-side validation
    if (!heroTitle || heroTitle.trim().length < 3) {
      alert("Hero title must be at least 3 characters")
      return
    }

    const formData = new FormData()
    formData.append("hero_title", heroTitle)
    formData.append("hero_subtitle", heroSubtitle)
    formData.append("hero_description", heroDescription)
    formData.append("hero_primary_cta", heroPrimaryCta)
    formData.append("hero_secondary_cta", heroSecondaryCta)
    formData.append("hero_video_url", heroVideoUrl)
    formData.append("hero_image", heroImage)
    if (heroImageFile) formData.append("hero_image_upload", heroImageFile)
    if (heroVideoFile) formData.append("hero_video_upload", heroVideoFile)
    formData.append("about_title", aboutTitle)
    formData.append("about_description", aboutDescription)
    formData.append(
      "about_highlights",
      JSON.stringify(aboutHighlights.split(",").map((s) => s.trim()).filter(Boolean))
    )
    formData.append("vision_title", visionTitle)
    formData.append("vision_description", visionDescription)
    formData.append("mission_title", missionTitle)
    formData.append("mission_description", missionDescription)
    formData.append("news_section_title", newsSectionTitle)
    formData.append("news_section_subtitle", newsSectionSubtitle)
    formData.append("featured_news_post", JSON.stringify(featuredNewsPost))
    formData.append("news_cards", JSON.stringify(newsCards))

    api.patch("/api/homepage-content/", formData).then(() => {
      setSaved("ok")
      setTimeout(() => setSaved(null), 2500)
    }).catch(() => {})
  }

  if (authLoading || loading) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Homepage" description="Manage public homepage content shown on the website." />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Label>Hero Title</Label>
          <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} />

          <Label>Hero Subtitle</Label>
          <Input value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} />

          <Label>Hero Description</Label>
          <Textarea rows={4} value={heroDescription} onChange={(e) => setHeroDescription(e.target.value)} />

          <Label>Hero Primary CTA</Label>
          <Input value={heroPrimaryCta} onChange={(e) => setHeroPrimaryCta(e.target.value)} />

          <Label>Hero Secondary CTA</Label>
          <Input value={heroSecondaryCta} onChange={(e) => setHeroSecondaryCta(e.target.value)} />

          <Label>Hero Video URL</Label>
          <Input value={heroVideoUrl} onChange={(e) => setHeroVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." />

          <Label>Hero Image URL (optional)</Label>
          <Input value={heroImage} onChange={(e) => { setHeroImage(e.target.value); setPreviewUrl(e.target.value) }} placeholder="https://.../hero.jpg" />

          <Label>Hero Image Upload</Label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setHeroImageFile(file)
              if (file) {
                const url = URL.createObjectURL(file)
                setPreviewUrl(url)
              }
            }}
            className="block w-full text-sm text-muted-foreground"
          />

          <Label>Hero Video Upload</Label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setHeroVideoFile(file)
            }}
            className="block w-full text-sm text-muted-foreground"
          />

          {previewUrl && (
            <div className="mt-2">
              <p className="text-sm font-medium">Preview</p>
              <img src={previewUrl} alt="hero preview" className="mt-2 w-full max-h-44 object-cover rounded-md border" />
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <Button onClick={save}>Save Changes</Button>
            {saved === "ok" && <SavedBanner />}
          </div>
        </div>

        <div className="space-y-4">
          <Label>About Title</Label>
          <Input value={aboutTitle} onChange={(e) => setAboutTitle(e.target.value)} />

          <Label>About Description</Label>
          <Textarea rows={4} value={aboutDescription} onChange={(e) => setAboutDescription(e.target.value)} />

          <Label>About Highlights (comma separated)</Label>
          <Input value={aboutHighlights} onChange={(e) => setAboutHighlights(e.target.value)} />

          <Label>Vision Title</Label>
          <Input value={visionTitle} onChange={(e) => setVisionTitle(e.target.value)} />

          <Label>Vision Description</Label>
          <Textarea rows={3} value={visionDescription} onChange={(e) => setVisionDescription(e.target.value)} />

          <Label>Mission Title</Label>
          <Input value={missionTitle} onChange={(e) => setMissionTitle(e.target.value)} />

          <Label>Mission Description</Label>
          <Textarea rows={3} value={missionDescription} onChange={(e) => setMissionDescription(e.target.value)} />
          
          <div className="rounded-xl border border-border p-4 bg-card">
            <p className="text-sm font-bold mb-3">News Section</p>
            <Label>Section Title</Label>
            <Input value={newsSectionTitle} onChange={(e) => setNewsSectionTitle(e.target.value)} />

            <Label>Section Subtitle</Label>
            <Textarea rows={2} value={newsSectionSubtitle} onChange={(e) => setNewsSectionSubtitle(e.target.value)} />

            <div className="mt-4 rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold mb-3">Featured News Post</p>
              <Label>Headline</Label>
              <Input value={featuredNewsPost.title} onChange={(e) => setFeaturedNewsPost(prev => ({ ...prev, title: e.target.value }))} />
              <Label className="mt-3">Excerpt</Label>
              <Textarea rows={3} value={featuredNewsPost.excerpt} onChange={(e) => setFeaturedNewsPost(prev => ({ ...prev, excerpt: e.target.value }))} />
              <Label className="mt-3">Date</Label>
              <Input value={featuredNewsPost.date} onChange={(e) => setFeaturedNewsPost(prev => ({ ...prev, date: e.target.value }))} placeholder="e.g. March 10, 2026" />
              <Label className="mt-3">Image URL</Label>
              <Input value={featuredNewsPost.image} onChange={(e) => setFeaturedNewsPost(prev => ({ ...prev, image: e.target.value }))} placeholder="https://.../featured.jpg" />
              <Label className="mt-3">Category</Label>
              <Input value={featuredNewsPost.category} onChange={(e) => setFeaturedNewsPost(prev => ({ ...prev, category: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
