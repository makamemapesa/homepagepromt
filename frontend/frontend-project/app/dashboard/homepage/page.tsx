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

interface SectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

interface HomepageContent {
  [key: string]: any
}

export default function HomepageEditorPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const [formData, setFormData] = useState<HomepageContent>({})

  useEffect(() => {
    api.get("/api/homepage-content/")
      .then((r) => {
        setFormData(r.data || {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateNestedField = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }))
  }

  const save = () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return

    const submitData = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      if (value instanceof File) {
        submitData.append(key, value)
      } else if (typeof value === 'object' && value !== null) {
        submitData.append(key, JSON.stringify(value))
      } else {
        submitData.append(key, String(value || ''))
      }
    })

    api.patch("/api/homepage-content/", submitData).then(() => {
      setSaved("ok")
      setTimeout(() => setSaved(null), 2500)
    }).catch((err) => {
      console.error('Save error:', err)
    })
  }

  if (authLoading || loading) return null

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Homepage" description="Manage all homepage content sections and settings." />

      <div className="space-y-6">
        {/* Section 1: Hero/Banner */}
        <Section title="Hero Section" description="Main banner at the top of the homepage">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Hero Title</Label>
              <Input value={formData.heroTitle || ""} onChange={(e) => updateField("heroTitle", e.target.value)} />
            </div>
            <div>
              <Label>Hero Subtitle</Label>
              <Input value={formData.heroSubtitle || ""} onChange={(e) => updateField("heroSubtitle", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Hero Description</Label>
              <Textarea rows={3} value={formData.heroDescription || ""} onChange={(e) => updateField("heroDescription", e.target.value)} />
            </div>
            <div>
              <Label>Primary CTA Text</Label>
              <Input value={formData.heroPrimaryCta || ""} onChange={(e) => updateField("heroPrimaryCta", e.target.value)} />
            </div>
            <div>
              <Label>Primary CTA Link</Label>
              <Input value={formData.heroPrimaryClaLink || ""} onChange={(e) => updateField("heroPrimaryCtaLink", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Secondary CTA Text</Label>
              <Input value={formData.heroSecondaryCta || ""} onChange={(e) => updateField("heroSecondaryCta", e.target.value)} />
            </div>
            <div>
              <Label>Secondary CTA Link</Label>
              <Input value={formData.heroSecondaryCtaLink || ""} onChange={(e) => updateField("heroSecondaryCtaLink", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Hero Video URL</Label>
              <Input value={formData.heroVideoUrl || ""} onChange={(e) => updateField("heroVideoUrl", e.target.value)} placeholder="https://www.youtube.com/embed/..." />
            </div>
            <div>
              <Label>Background Color</Label>
              <Input type="color" value={formData.heroBackgroundColor || "#ffffff"} onChange={(e) => updateField("heroBackgroundColor", e.target.value)} />
            </div>
            <div>
              <Label>Hero Image URL</Label>
              <Input value={formData.heroImage || ""} onChange={(e) => updateField("heroImage", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Hero Image Upload</Label>
              <input type="file" accept="image/*" onChange={(e) => updateField("heroImageUpload", e.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground" />
            </div>
            <div>
              <Label>Hero Video Upload</Label>
              <input type="file" accept="video/*" onChange={(e) => updateField("heroVideoUpload", e.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground" />
            </div>
            <div className="md:col-span-2">
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.announcementBannerEnabled || false} onChange={(e) => updateField("announcementBannerEnabled", e.target.checked)} />
                Enable Announcement Banner
              </Label>
            </div>
            {formData.announcementBannerEnabled && (
              <div className="md:col-span-2">
                <Label>Announcement Banner Text</Label>
                <Input value={formData.announcementBannerText || ""} onChange={(e) => updateField("announcementBannerText", e.target.value)} />
              </div>
            )}
          </div>
        </Section>

        {/* Section 2: Statistics */}
        <Section title="Statistics Section" description="Key school statistics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.showStatisticsSection || false} onChange={(e) => updateField("showStatisticsSection", e.target.checked)} />
                Show Statistics Section
              </Label>
            </div>
            <div>
              <Label>Total Students</Label>
              <Input type="number" value={formData.totalStudents || 0} onChange={(e) => updateField("totalStudents", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Total Teachers</Label>
              <Input type="number" value={formData.totalTeachers || 0} onChange={(e) => updateField("totalTeachers", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Established Year</Label>
              <Input type="number" value={formData.establishedYear || 2020} onChange={(e) => updateField("establishedYear", parseInt(e.target.value) || 2020)} />
            </div>
            <div>
              <Label>Academic Programs Count</Label>
              <Input type="number" value={formData.academicProgramsCount || 3} onChange={(e) => updateField("academicProgramsCount", parseInt(e.target.value) || 3)} />
            </div>
            <div>
              <Label>Custom Label 1</Label>
              <Input value={formData.statisticsCustomLabel1 || ""} onChange={(e) => updateField("statisticsCustomLabel1", e.target.value)} />
            </div>
            <div>
              <Label>Custom Value 1</Label>
              <Input value={formData.statisticsCustomValue1 || ""} onChange={(e) => updateField("statisticsCustomValue1", e.target.value)} />
            </div>
            <div>
              <Label>Custom Label 2</Label>
              <Input value={formData.statisticsCustomLabel2 || ""} onChange={(e) => updateField("statisticsCustomLabel2", e.target.value)} />
            </div>
            <div>
              <Label>Custom Value 2</Label>
              <Input value={formData.statisticsCustomValue2 || ""} onChange={(e) => updateField("statisticsCustomValue2", e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Section 3: About */}
        <Section title="About School" description="School information and highlights">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>About Title</Label>
              <Input value={formData.aboutTitle || ""} onChange={(e) => updateField("aboutTitle", e.target.value)} />
            </div>
            <div>
              <Label>About Description</Label>
              <Textarea rows={4} value={formData.aboutDescription || ""} onChange={(e) => updateField("aboutDescription", e.target.value)} />
            </div>
            <div>
              <Label>About Highlights (JSON array)</Label>
              <Textarea rows={3} value={typeof formData.aboutHighlights === 'string' ? formData.aboutHighlights : JSON.stringify(formData.aboutHighlights || [])} onChange={(e) => {
                try {
                  updateField("aboutHighlights", JSON.parse(e.target.value))
                } catch {
                  updateField("aboutHighlights", e.target.value)
                }
              }} placeholder='["Highlight 1", "Highlight 2"]' />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.whyChooseUsSectionEnabled || false} onChange={(e) => updateField("whyChooseUsSectionEnabled", e.target.checked)} />
                Enable "Why Choose Us" Section
              </Label>
            </div>
            {formData.whyChooseUsSectionEnabled && (
              <div>
                <Label>Why Choose Us Points (JSON)</Label>
                <Textarea rows={3} value={typeof formData.whyChooseUsPoints === 'string' ? formData.whyChooseUsPoints : JSON.stringify(formData.whyChooseUsPoints || [])} onChange={(e) => {
                  try {
                    updateField("whyChooseUsPoints", JSON.parse(e.target.value))
                  } catch {
                    updateField("whyChooseUsPoints", e.target.value)
                  }
                }} placeholder='[{"title": "", "description": ""}]' />
              </div>
            )}
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.schoolStorySectionEnabled || false} onChange={(e) => updateField("schoolStorySectionEnabled", e.target.checked)} />
                Enable School Story Section
              </Label>
            </div>
            {formData.schoolStorySectionEnabled && (
              <>
                <div>
                  <Label>School Story Title</Label>
                  <Input value={formData.schoolStoryTitle || ""} onChange={(e) => updateField("schoolStoryTitle", e.target.value)} />
                </div>
                <div>
                  <Label>School Story Description</Label>
                  <Textarea rows={3} value={formData.schoolStoryDescription || ""} onChange={(e) => updateField("schoolStoryDescription", e.target.value)} />
                </div>
                <div>
                  <Label>School Story Image</Label>
                  <input type="file" accept="image/*" onChange={(e) => updateField("schoolStoryImage", e.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground" />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 4: Academics */}
        <Section title="Academics & Programs" description="Academic sections and programs">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.academicsSectionEnabled || false} onChange={(e) => updateField("academicsSectionEnabled", e.target.checked)} />
                Enable Academics Section
              </Label>
            </div>
            {formData.academicsSectionEnabled && (
              <>
                <div>
                  <Label>Academics Section Title</Label>
                  <Input value={formData.academicsSectionTitle || ""} onChange={(e) => updateField("academicsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Academics Section Subtitle</Label>
                  <Input value={formData.academicsSectionSubtitle || ""} onChange={(e) => updateField("academicsSectionSubtitle", e.target.value)} />
                </div>
                <div>
                  <Label>Featured Subjects (JSON array)</Label>
                  <Textarea rows={2} value={typeof formData.featuredSubjects === 'string' ? formData.featuredSubjects : JSON.stringify(formData.featuredSubjects || [])} onChange={(e) => {
                    try {
                      updateField("featuredSubjects", JSON.parse(e.target.value))
                    } catch {
                      updateField("featuredSubjects", e.target.value)
                    }
                  }} placeholder='["Math", "Science", "English"]' />
                </div>
                <div>
                  <Label>Programs Overview</Label>
                  <Textarea rows={3} value={formData.programsOverview || ""} onChange={(e) => updateField("programsOverview", e.target.value)} />
                </div>
                <div>
                  <Label>Grade Levels Offered (JSON array)</Label>
                  <Textarea rows={2} value={typeof formData.gradeLevelsOffered === 'string' ? formData.gradeLevelsOffered : JSON.stringify(formData.gradeLevelsOffered || [])} onChange={(e) => {
                    try {
                      updateField("gradeLevelsOffered", JSON.parse(e.target.value))
                    } catch {
                      updateField("gradeLevelsOffered", e.target.value)
                    }
                  }} placeholder='["Nursery", "Primary", "Secondary"]' />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 5: Admissions */}
        <Section title="Admissions" description="Application and admission information">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.admissionsSectionEnabled || false} onChange={(e) => updateField("admissionsSectionEnabled", e.target.checked)} />
                Enable Admissions Section
              </Label>
            </div>
            {formData.admissionsSectionEnabled && (
              <>
                <div>
                  <Label>Admissions Title</Label>
                  <Input value={formData.admissionsSectionTitle || ""} onChange={(e) => updateField("admissionsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Admissions Subtitle</Label>
                  <Input value={formData.admissionsSectionSubtitle || ""} onChange={(e) => updateField("admissionsSectionSubtitle", e.target.value)} />
                </div>
                <div>
                  <Label>Current Application Window Info</Label>
                  <Textarea rows={2} value={formData.currentApplicationWindowInfo || ""} onChange={(e) => updateField("currentApplicationWindowInfo", e.target.value)} />
                </div>
                <div>
                  <Label>Admission Requirements (JSON array)</Label>
                  <Textarea rows={2} value={typeof formData.admissionRequirements === 'string' ? formData.admissionRequirements : JSON.stringify(formData.admissionRequirements || [])} onChange={(e) => {
                    try {
                      updateField("admissionRequirements", JSON.parse(e.target.value))
                    } catch {
                      updateField("admissionRequirements", e.target.value)
                    }
                  }} placeholder='["Birth certificate", "Passport", "Academic records"]' />
                </div>
                <div>
                  <Label>Application Button Text</Label>
                  <Input value={formData.applicationButtonText || "Apply Now"} onChange={(e) => updateField("applicationButtonText", e.target.value)} />
                </div>
                <div>
                  <Label>Application Button Link</Label>
                  <Input value={formData.applicationButtonLink || ""} onChange={(e) => updateField("applicationButtonLink", e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label>Admission Timeline (JSON)</Label>
                  <Textarea rows={2} value={typeof formData.admissionTimeline === 'string' ? formData.admissionTimeline : JSON.stringify(formData.admissionTimeline || {})} onChange={(e) => {
                    try {
                      updateField("admissionTimeline", JSON.parse(e.target.value))
                    } catch {
                      updateField("admissionTimeline", e.target.value)
                    }
                  }} placeholder='{"January": "Applications open", "March": "Interviews"}' />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 6: Leadership */}
        <Section title="Leadership & Team" description="Leadership and staff information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.leadershipSectionEnabled || false} onChange={(e) => updateField("leadershipSectionEnabled", e.target.checked)} />
                Enable Leadership Section
              </Label>
            </div>
            <div>
              <Label>Leadership Section Title</Label>
              <Input value={formData.leadershipSectionTitle || "Our Leadership"} onChange={(e) => updateField("leadershipSectionTitle", e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.principalMessageEnabled || false} onChange={(e) => updateField("principalMessageEnabled", e.target.checked)} />
                Enable Principal's Message
              </Label>
            </div>
            <div>
              <Label>Featured Staff Count</Label>
              <Input type="number" value={formData.featuredStaffCount || 5} onChange={(e) => updateField("featuredStaffCount", parseInt(e.target.value) || 5)} />
            </div>
            <div className="md:col-span-2">
              <Label>Staff Directory Link</Label>
              <Input value={formData.staffDirectoryLink || ""} onChange={(e) => updateField("staffDirectoryLink", e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </Section>

        {/* Section 7: Testimonials */}
        <Section title="Testimonials & Success Stories" description="Student and parent feedback">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.testimonialsSectionEnabled || false} onChange={(e) => updateField("testimonialsSectionEnabled", e.target.checked)} />
                Enable Testimonials Section
              </Label>
            </div>
            {formData.testimonialsSectionEnabled && (
              <>
                <div>
                  <Label>Testimonials Title</Label>
                  <Input value={formData.testimonialsSectionTitle || "What Our Community Says"} onChange={(e) => updateField("testimonialsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Testimonials Subtitle</Label>
                  <Input value={formData.testimonialsSectionSubtitle || ""} onChange={(e) => updateField("testimonialsSectionSubtitle", e.target.value)} />
                </div>
                <div>
                  <Label>Testimonials (JSON)</Label>
                  <Textarea rows={3} value={typeof formData.testimonialsList === 'string' ? formData.testimonialsList : JSON.stringify(formData.testimonialsList || [])} onChange={(e) => {
                    try {
                      updateField("testimonialsList", JSON.parse(e.target.value))
                    } catch {
                      updateField("testimonialsList", e.target.value)
                    }
                  }} placeholder='[{"text": "", "author": "", "role": ""}]' />
                </div>
              </>
            )}
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.successStoriesEnabled || false} onChange={(e) => updateField("successStoriesEnabled", e.target.checked)} />
                Enable Success Stories
              </Label>
            </div>
            {formData.successStoriesEnabled && (
              <div>
                <Label>Success Stories (JSON)</Label>
                <Textarea rows={3} value={typeof formData.successStories === 'string' ? formData.successStories : JSON.stringify(formData.successStories || [])} onChange={(e) => {
                  try {
                    updateField("successStories", JSON.parse(e.target.value))
                  } catch {
                    updateField("successStories", e.target.value)
                  }
                }} placeholder='[{"title": "", "description": ""}]' />
              </div>
            )}
          </div>
        </Section>

        {/* Section 8: News */}
        <Section title="News & Updates" description="News articles and announcements">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>News Section Title</Label>
              <Input value={formData.newsSectionTitle || "News & Updates"} onChange={(e) => updateField("newsSectionTitle", e.target.value)} />
            </div>
            <div>
              <Label>News Section Subtitle</Label>
              <Input value={formData.newsSectionSubtitle || ""} onChange={(e) => updateField("newsSectionSubtitle", e.target.value)} />
            </div>
            <div>
              <Label>Max News Items to Display</Label>
              <Input type="number" value={formData.newsMaxDisplay || 3} onChange={(e) => updateField("newsMaxDisplay", parseInt(e.target.value) || 3)} />
            </div>
            <div>
              <Label>News Categories (JSON array)</Label>
              <Textarea rows={2} value={typeof formData.newsCategories === 'string' ? formData.newsCategories : JSON.stringify(formData.newsCategories || [])} onChange={(e) => {
                try {
                  updateField("newsCategories", JSON.parse(e.target.value))
                } catch {
                  updateField("newsCategories", e.target.value)
                }
              }} placeholder='["Announcements", "Achievements", "Events"]' />
            </div>
          </div>
        </Section>

        {/* Section 9: Facilities */}
        <Section title="Facilities & Campus" description="School facilities and campus gallery">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.facilitiesSectionEnabled || false} onChange={(e) => updateField("facilitiesSectionEnabled", e.target.checked)} />
                Enable Facilities Section
              </Label>
            </div>
            {formData.facilitiesSectionEnabled && (
              <>
                <div>
                  <Label>Facilities Section Title</Label>
                  <Input value={formData.facilitiesSectionTitle || "Our Facilities"} onChange={(e) => updateField("facilitiesSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Facilities List (JSON)</Label>
                  <Textarea rows={3} value={typeof formData.facilitiesList === 'string' ? formData.facilitiesList : JSON.stringify(formData.facilitiesList || [])} onChange={(e) => {
                    try {
                      updateField("facilitiesList", JSON.parse(e.target.value))
                    } catch {
                      updateField("facilitiesList", e.target.value)
                    }
                  }} placeholder='[{"name": "", "description": ""}]' />
                </div>
              </>
            )}
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.campusGalleryEnabled || false} onChange={(e) => updateField("campusGalleryEnabled", e.target.checked)} />
                Enable Campus Gallery
              </Label>
            </div>
            {formData.campusGalleryEnabled && (
              <div>
                <Label>Campus Gallery Photos (JSON URLs)</Label>
                <Textarea rows={2} value={typeof formData.campusGalleryPhotos === 'string' ? formData.campusGalleryPhotos : JSON.stringify(formData.campusGalleryPhotos || [])} onChange={(e) => {
                  try {
                    updateField("campusGalleryPhotos", JSON.parse(e.target.value))
                  } catch {
                    updateField("campusGalleryPhotos", e.target.value)
                  }
                }} placeholder='["https://...", "https://..."]' />
              </div>
            )}
          </div>
        </Section>

        {/* Section 10: Fundraising */}
        <Section title="Fundraising & Donations" description="Fundraiser and donation information">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.fundraisingSectionEnabled || false} onChange={(e) => updateField("fundraisingSectionEnabled", e.target.checked)} />
                Enable Fundraising Section
              </Label>
            </div>
            {formData.fundraisingSectionEnabled && (
              <>
                <div>
                  <Label>Fundraising Section Title</Label>
                  <Input value={formData.fundraisingSectionTitle || "Support Our Mission"} onChange={(e) => updateField("fundraisingSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Featured Fundraisers Count</Label>
                  <Input type="number" value={formData.featuredFundraisersCount || 3} onChange={(e) => updateField("featuredFundraisersCount", parseInt(e.target.value) || 3)} />
                </div>
                <div>
                  <Label>Donation CTA Text</Label>
                  <Input value={formData.donationCallToActionText || ""} onChange={(e) => updateField("donationCallToActionText", e.target.value)} />
                </div>
                <div>
                  <Label>Donation CTA Link</Label>
                  <Input value={formData.donationCallToActionLink || ""} onChange={(e) => updateField("donationCallToActionLink", e.target.value)} placeholder="https://..." />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 11: Accreditations */}
        <Section title="Accreditations" description="Certifications and accreditations">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.accreditationsSectionEnabled || false} onChange={(e) => updateField("accreditationsSectionEnabled", e.target.checked)} />
                Enable Accreditations Section
              </Label>
            </div>
            {formData.accreditationsSectionEnabled && (
              <>
                <div>
                  <Label>Accreditations Title</Label>
                  <Input value={formData.accreditationsSectionTitle || "Accreditations"} onChange={(e) => updateField("accreditationsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Accreditations List (JSON)</Label>
                  <Textarea rows={2} value={typeof formData.accreditationsList === 'string' ? formData.accreditationsList : JSON.stringify(formData.accreditationsList || [])} onChange={(e) => {
                    try {
                      updateField("accreditationsList", JSON.parse(e.target.value))
                    } catch {
                      updateField("accreditationsList", e.target.value)
                    }
                  }} placeholder='[{"name": "", "logoUrl": ""}]' />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 12: Contact & Footer */}
        <Section title="Contact & Footer" description="Contact information and footer links">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.contactSectionEnabled || false} onChange={(e) => updateField("contactSectionEnabled", e.target.checked)} />
                Enable Contact Section
              </Label>
            </div>
            {formData.contactSectionEnabled && (
              <>
                <div>
                  <Label>Footer Title</Label>
                  <Input value={formData.footerTitle || "Get In Touch"} onChange={(e) => updateField("footerTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Footer Description</Label>
                  <Textarea rows={2} value={formData.footerDescription || ""} onChange={(e) => updateField("footerDescription", e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.displayContactForm || false} onChange={(e) => updateField("displayContactForm", e.target.checked)} />
                    Display Contact Form
                  </Label>
                </div>
                <div>
                  <Label>Map Location Embed URL</Label>
                  <Input value={formData.mapLocationEmbedUrl || ""} onChange={(e) => updateField("mapLocationEmbedUrl", e.target.value)} placeholder="https://maps.google.com/..." />
                </div>
                <div>
                  <Label>Office Hours (JSON)</Label>
                  <Textarea rows={2} value={typeof formData.officeHours === 'string' ? formData.officeHours : JSON.stringify(formData.officeHours || {})} onChange={(e) => {
                    try {
                      updateField("officeHours", JSON.parse(e.target.value))
                    } catch {
                      updateField("officeHours", e.target.value)
                    }
                  }} placeholder='{"Monday": "8am-4pm", "Tuesday": "8am-4pm"}' />
                </div>
                <div>
                  <Label>Quick Links (JSON)</Label>
                  <Textarea rows={2} value={typeof formData.quickLinks === 'string' ? formData.quickLinks : JSON.stringify(formData.quickLinks || [])} onChange={(e) => {
                    try {
                      updateField("quickLinks", JSON.parse(e.target.value))
                    } catch {
                      updateField("quickLinks", e.target.value)
                    }
                  }} placeholder='[{"title": "", "url": ""}]' />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 13: Social Media */}
        <Section title="Social Media & Messaging" description="Social media links and messaging options">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Social Media Links (JSON)</Label>
              <Textarea rows={2} value={typeof formData.socialMediaLinks === 'string' ? formData.socialMediaLinks : JSON.stringify(formData.socialMediaLinks || {})} onChange={(e) => {
                try {
                  updateField("socialMediaLinks", JSON.parse(e.target.value))
                } catch {
                  updateField("socialMediaLinks", e.target.value)
                }
              }} placeholder='{"facebook": "https://...", "twitter": "https://..."}' />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.shareEnabled || false} onChange={(e) => updateField("shareEnabled", e.target.checked)} />
                Enable Social Sharing Buttons
              </Label>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.whatsappEnabled || false} onChange={(e) => updateField("whatsappEnabled", e.target.checked)} />
                Enable WhatsApp Chat
              </Label>
            </div>
            {formData.whatsappEnabled && (
              <div>
                <Label>WhatsApp Number</Label>
                <Input value={formData.whatsappNumber || ""} onChange={(e) => updateField("whatsappNumber", e.target.value)} placeholder="+1234567890" />
              </div>
            )}
          </div>
        </Section>

        {/* Section 14: SEO */}
        <Section title="SEO & Metadata" description="Search engine optimization">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Meta Title</Label>
              <Input value={formData.metaTitle || ""} onChange={(e) => updateField("metaTitle", e.target.value)} placeholder="Max 60 characters" maxLength={60} />
            </div>
            <div>
              <Label>Meta Description</Label>
              <Input value={formData.metaDescription || ""} onChange={(e) => updateField("metaDescription", e.target.value)} placeholder="Max 160 characters" maxLength={160} />
            </div>
            <div>
              <Label>Meta Keywords</Label>
              <Input value={formData.metaKeywords || ""} onChange={(e) => updateField("metaKeywords", e.target.value)} placeholder="Comma separated keywords" />
            </div>
            <div>
              <Label>OG Title</Label>
              <Input value={formData.ogTitle || ""} onChange={(e) => updateField("ogTitle", e.target.value)} />
            </div>
            <div>
              <Label>OG Description</Label>
              <Input value={formData.ogDescription || ""} onChange={(e) => updateField("ogDescription", e.target.value)} />
            </div>
            <div>
              <Label>OG Image (1200x630px)</Label>
              <input type="file" accept="image/*" onChange={(e) => updateField("ogImage", e.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground" />
            </div>
            <div>
              <Label>Canonical URL</Label>
              <Input value={formData.canonicalUrl || ""} onChange={(e) => updateField("canonicalUrl", e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </Section>

        {/* Section 15: CTAs */}
        <Section title="Call-to-Action Sections" description="Secondary and tertiary CTA sections">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.secondaryCtaSectionEnabled || false} onChange={(e) => updateField("secondaryCtaSectionEnabled", e.target.checked)} />
                Enable Secondary CTA Section
              </Label>
            </div>
            {formData.secondaryCtaSectionEnabled && (
              <>
                <div>
                  <Label>Secondary CTA Title</Label>
                  <Input value={formData.secondaryCtaTitle || ""} onChange={(e) => updateField("secondaryCtaTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Secondary CTA Description</Label>
                  <Textarea rows={2} value={formData.secondaryCtaDescription || ""} onChange={(e) => updateField("secondaryCtaDescription", e.target.value)} />
                </div>
                <div>
                  <Label>Secondary CTA Button Text</Label>
                  <Input value={formData.secondaryCtaButtonText || ""} onChange={(e) => updateField("secondaryCtaButtonText", e.target.value)} />
                </div>
                <div>
                  <Label>Secondary CTA Button Link</Label>
                  <Input value={formData.secondaryCtaButtonLink || ""} onChange={(e) => updateField("secondaryCtaButtonLink", e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label>Secondary CTA Image</Label>
                  <input type="file" accept="image/*" onChange={(e) => updateField("secondaryCtaImage", e.target.files?.[0] || null)} className="block w-full text-sm text-muted-foreground" />
                </div>
              </>
            )}
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.tertiaryCataEnabled || false} onChange={(e) => updateField("tertiaryCataEnabled", e.target.checked)} />
                Enable Tertiary CTA Section
              </Label>
            </div>
            {formData.tertiaryCataEnabled && (
              <>
                <div>
                  <Label>Tertiary CTA Title</Label>
                  <Input value={formData.tertiaryCtaTitle || ""} onChange={(e) => updateField("tertiaryCtaTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Tertiary CTA Description</Label>
                  <Textarea rows={2} value={formData.tertiaryCtaDescription || ""} onChange={(e) => updateField("tertiaryCtaDescription", e.target.value)} />
                </div>
                <div>
                  <Label>Tertiary CTA Button Text</Label>
                  <Input value={formData.tertiaryCtaButtonText || ""} onChange={(e) => updateField("tertiaryCtaButtonText", e.target.value)} />
                </div>
                <div>
                  <Label>Tertiary CTA Button Link</Label>
                  <Input value={formData.tertiaryCtaButtonLink || ""} onChange={(e) => updateField("tertiaryCtaButtonLink", e.target.value)} placeholder="https://..." />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 16: Events */}
        <Section title="Events & Calendar" description="Upcoming events section">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.eventsSectionEnabled || false} onChange={(e) => updateField("eventsSectionEnabled", e.target.checked)} />
                Enable Events Section
              </Label>
            </div>
            {formData.eventsSectionEnabled && (
              <>
                <div>
                  <Label>Events Section Title</Label>
                  <Input value={formData.eventsSectionTitle || "Upcoming Events"} onChange={(e) => updateField("eventsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label>Upcoming Events Count</Label>
                  <Input type="number" value={formData.upcomingEventsCount || 3} onChange={(e) => updateField("upcomingEventsCount", parseInt(e.target.value) || 3)} />
                </div>
                <div>
                  <Label>Link to Full Calendar</Label>
                  <Input value={formData.linkToFullCalendar || ""} onChange={(e) => updateField("linkToFullCalendar", e.target.value)} placeholder="https://..." />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 17: Achievements */}
        <Section title="Achievements & Performance" description="School achievements and performance metrics">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.achievementsSectionEnabled || false} onChange={(e) => updateField("achievementsSectionEnabled", e.target.checked)} />
                Enable Achievements Section
              </Label>
            </div>
            {formData.achievementsSectionEnabled && (
              <>
                <div>
                  <Label>Achievements Section Title</Label>
                  <Input value={formData.achievementsSectionTitle || "Our Achievements"} onChange={(e) => updateField("achievementsSectionTitle", e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.examPerformanceEnabled || false} onChange={(e) => updateField("examPerformanceEnabled", e.target.checked)} />
                    Show Exam Performance
                  </Label>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.universityPlacementsEnabled || false} onChange={(e) => updateField("universityPlacementsEnabled", e.target.checked)} />
                    Show University Placements
                  </Label>
                </div>
                <div>
                  <Label>Awards & Recognitions (JSON)</Label>
                  <Textarea rows={2} value={typeof formData.awardsRecognitionsList === 'string' ? formData.awardsRecognitionsList : JSON.stringify(formData.awardsRecognitionsList || [])} onChange={(e) => {
                    try {
                      updateField("awardsRecognitionsList", JSON.parse(e.target.value))
                    } catch {
                      updateField("awardsRecognitionsList", e.target.value)
                    }
                  }} placeholder='[{"title": "", "year": 2024}]' />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Section 18: Admin Controls */}
        <Section title="Admin Controls" description="Theme, maintenance mode, and advanced settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Homepage Theme</Label>
              <select value={formData.homepageTheme || "light"} onChange={(e) => updateField("homepageTheme", e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.maintenanceModeEnabled || false} onChange={(e) => updateField("maintenanceModeEnabled", e.target.checked)} />
                Maintenance Mode
              </Label>
            </div>
            {formData.maintenanceModeEnabled && (
              <div className="md:col-span-2">
                <Label>Maintenance Mode Message</Label>
                <Textarea rows={2} value={formData.maintenanceModeMessage || ""} onChange={(e) => updateField("maintenanceModeMessage", e.target.value)} />
              </div>
            )}
            <div>
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.showBetaFeatures || false} onChange={(e) => updateField("showBetaFeatures", e.target.checked)} />
                Show Beta Features
              </Label>
            </div>
            <div className="md:col-span-2">
              <Label>Custom CSS</Label>
              <Textarea rows={4} value={formData.customCss || ""} onChange={(e) => updateField("customCss", e.target.value)} placeholder="/* Custom CSS rules */" />
            </div>
            <div className="md:col-span-2">
              <Label>Sections Display Order (JSON)</Label>
              <Textarea rows={2} value={typeof formData.sectionsDisplayOrder === 'string' ? formData.sectionsDisplayOrder : JSON.stringify(formData.sectionsDisplayOrder || [])} onChange={(e) => {
                try {
                  updateField("sectionsDisplayOrder", JSON.parse(e.target.value))
                } catch {
                  updateField("sectionsDisplayOrder", e.target.value)
                }
              }} placeholder='["hero", "statistics", "about", ...]' />
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <div className="flex items-center gap-4 p-4 md:p-6 rounded-lg border border-border bg-card sticky bottom-0">
          <Button onClick={save} className="flex-1">Save All Changes</Button>
          {saved === "ok" && <SavedBanner />}
        </div>
      </div>
    </div>
  )
}
