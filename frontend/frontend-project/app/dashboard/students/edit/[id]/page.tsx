"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Upload, Save, Heart, ExternalLink, CheckCircle2, Users, UserPlus, PlusCircle, Trash2 } from "lucide-react"
import Link from "next/link"

const DOCS = [
  { key: "passport_photo",       label: "Passport Photograph",     accept: "image/*" },
  { key: "birth_certificate",    label: "Birth Certificate",        accept: ".pdf,image/*" },
  { key: "previous_report",      label: "Previous School Report",   accept: ".pdf,image/*" },
  { key: "transfer_certificate", label: "Transfer Certificate",     accept: ".pdf,image/*" },
  { key: "medical_certificate",  label: "Medical Certificate",      accept: ".pdf,image/*" },
  { key: "other",                label: "Other Documents",          accept: ".pdf,image/*" },
]

export default function EditStudentPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const params = useParams()
  const studentId = params.id as string
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [classes, setClasses] = useState<any[]>([])
  const [donorsData, setDonorsData] = useState<any[]>([])
  const [existingDocs, setExistingDocs] = useState<any[]>([])
  const [docUploading, setDocUploading] = useState<string | null>(null)

  // Parent mode
  const [parentMode, setParentMode] = useState<"new" | "existing">("new")
  const [parentUserId, setParentUserId] = useState("")
  const [parentUsers, setParentUsers] = useState<any[]>([])

  // Donor state
  const [hasDonor, setHasDonor] = useState(false)
  const [selectedDonor, setSelectedDonor] = useState("")
  const [donorNumber, setDonorNumber] = useState("")
  const activeDonors = donorsData.filter((d: any) => d.status === "active")

  // Orphan
  const [isOrphan, setIsOrphan] = useState(false)
  const [hasDisability, setHasDisability] = useState(false)
  const [disabilityDetails, setDisabilityDetails] = useState("")

  // Emergency contacts
  // Guardians beyond the main contact — father, uncle, elder brother. Rows keep
  // their id so editing never detaches an existing parent-portal login.
  const EMPTY_GUARDIAN = { id: null as number | null, fullName: "", relationship: "", phone: "", email: "", occupation: "" }
  const [extraGuardians, setExtraGuardians] = useState<typeof EMPTY_GUARDIAN[]>([])
  const addGuardian = () => setExtraGuardians(prev => [...prev, { ...EMPTY_GUARDIAN }])
  const removeGuardian = (i: number) => setExtraGuardians(prev => prev.filter((_, idx) => idx !== i))
  const setGuardian = (i: number, key: string, value: string) =>
    setExtraGuardians(prev => prev.map((g, idx) => idx === i ? { ...g, [key]: value } : g))
  const [primaryGuardianId, setPrimaryGuardianId] = useState<number | null>(null)
  const [emergencyContacts, setEmergencyContacts] = useState([{ name: "", phone: "", relationship: "" }])
  const addEmergencyContact = () => setEmergencyContacts(prev => [...prev, { name: "", phone: "", relationship: "" }])
  const removeEmergencyContact = (i: number) => setEmergencyContacts(prev => prev.filter((_, idx) => idx !== i))
  const setEC = (i: number, key: string, value: string) => setEmergencyContacts(prev => prev.map((ec, idx) => idx === i ? { ...ec, [key]: value } : ec))

  const [form, setForm] = useState({
    // Personal
    firstName: "", lastName: "", middleName: "",
    dateOfBirth: "", gender: "", bloodGroup: "",
    religion: "", stateOfOrigin: "", address: "",
    // Parent
    parentName: "", relationship: "", parentPhone: "",
    parentEmail: "", occupation: "", officeAddress: "",
    homeAddress: "",
    // Academic
    admissionClass: "", academicSession: "2026",
    admissionDate: "", studentType: "Day",
    previousSchool: "", previousClass: "", regNo: "",
    // Status
    status: "active", feeStatus: "unpaid",
  })

  const setField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    Promise.all([
      api.get(`/api/students/${studentId}/`),
      api.get("/api/classes/"),
      api.get("/api/donors/"),
      api.get("/api/users/"),
    ]).then(([sr, cr, dr, ur]) => {
      const s = sr.data
      const p = s.parent || {}
      setForm({
        firstName:      s.firstName || "",
        lastName:       s.lastName || "",
        middleName:     s.middleName || "",
        dateOfBirth:    s.dateOfBirth || "",
        gender:         s.gender || "",
        bloodGroup:     s.bloodGroup || "",
        religion:       s.religion || "",
        stateOfOrigin:  s.stateOfOrigin || "",
        address:        s.residentialAddress || "",
        parentName:     p.fullName || "",
        relationship:   p.relationship || "",
        parentPhone:    p.phone || "",
        parentEmail:    p.email || "",
        occupation:     p.occupation || "",
        officeAddress:  p.officeAddress || "",
        homeAddress:    p.homeAddress || "",
        admissionClass: String(s.studentClass || ""),
        academicSession: s.academicSession || "2026",
        admissionDate:  s.admissionDate || "",
        studentType:    s.studentType || "Day",
        previousSchool: s.previousSchool || "",
        previousClass:  s.previousClass || "",
        regNo:          s.regNo || "",
        status:         s.status || "active",
        feeStatus:      s.feeStatus || "unpaid",
      })
      setExistingDocs(s.documents || [])
      const allGuardians = Array.isArray(s.guardians) ? s.guardians : (s.parent ? [s.parent] : [])
      const primary = allGuardians.find((g: any) => g.isPrimary) || allGuardians[0] || null
      setPrimaryGuardianId(primary?.id ?? null)
      setExtraGuardians(
        allGuardians
          .filter((g: any) => g.id !== primary?.id)
          .map((g: any) => ({
            id: g.id ?? null,
            fullName: g.fullName || "",
            relationship: g.relationship || "",
            phone: g.phone || "",
            email: g.email || "",
            occupation: g.occupation || "",
          }))
      )
      setIsOrphan(!!s.isOrphan)
      setHasDisability(!!s.hasDisability)
      setDisabilityDetails(s.disabilityDetails || "")
      if (s.donor) {
        setHasDonor(true)
        setSelectedDonor(String(s.donor))
        setDonorNumber(s.donorNumber || "")
      }
      setClasses(getResults(cr.data))
      setDonorsData(getResults(dr.data))
      const allUsers = getResults(ur.data)
      setParentUsers(allUsers.filter((u: any) => u.role === "parent"))
      // If student already has a linked parent account, pre-select it
      if (s.parent?.user) {
        setParentMode("existing")
        setParentUserId(String(s.parent.user))
      }
      // Load existing emergency contacts
      if (s.emergencyContacts && s.emergencyContacts.length > 0) {
        setEmergencyContacts(s.emergencyContacts.map((ec: any) => ({
          name: ec.name || "",
          phone: ec.phone || "",
          relationship: ec.relationship || "",
        })))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [studentId])

  const handleDocUpload = async (docType: string, file: File) => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setDocUploading(docType)
    try {
      const fd = new FormData()
      fd.append("document_type", docType)
      fd.append("file", file)
      const r = await api.post(`/api/students/${studentId}/upload_document/`, fd)
      setExistingDocs(prev => [
        ...prev.filter((d: any) => d.documentType !== docType),
        r.data,
      ])
    } catch (e) {
      console.error("Document upload failed", e)
    } finally {
      setDocUploading(null)
    }
  }

  const handleSubmit = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setSubmitError("")
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.gender) {
      setSubmitError("Please fill in all required personal fields (first name, last name, date of birth, gender).")
      setStep(1); return
    }
    if (hasDisability && !disabilityDetails.trim()) {
      setSubmitError("Please describe the disability and any support the student needs.")
      setStep(1); return
    }
    for (const [i, g] of extraGuardians.entries()) {
      if (!g.fullName.trim() && !g.phone.trim() && !g.relationship) continue
      if (!g.fullName.trim() || !g.phone.trim() || !g.relationship) {
        setSubmitError(`Additional guardian ${i + 1} needs a full name, relationship and phone number.`)
        setStep(2); return
      }
    }
    if (!form.admissionClass || !form.admissionDate || !form.regNo) {
      setSubmitError("Please fill in all required academic fields (class, admission date, reg. number).")
      setStep(3); return
    }
    if (!form.studentType) {
      setSubmitError("Please select a student type.")
      setStep(3); return
    }
    const hasParentData = !!(form.parentName || form.parentPhone || form.relationship)
    if (hasParentData) {
      if (!form.parentName) { setSubmitError("Parent full name is required."); setStep(2); return }
      if (!form.parentPhone) { setSubmitError("Parent phone number is required."); setStep(2); return }
      if (!form.relationship) { setSubmitError("Parent relationship is required."); setStep(2); return }
    }
    setSubmitting(true)
    try {
      const payload: any = {
        firstName:           form.firstName,
        lastName:            form.lastName,
        middleName:          form.middleName,
        dateOfBirth:         form.dateOfBirth,
        gender:              form.gender,
        bloodGroup:          form.bloodGroup,
        religion:            form.religion,
        stateOfOrigin:       form.stateOfOrigin,
        residentialAddress:  form.address,
        isOrphan,
        hasDisability,
        disabilityDetails:   hasDisability ? disabilityDetails.trim() : "",
        studentClass:        Number(form.admissionClass),
        academicSession:     form.academicSession,
        admissionDate:       form.admissionDate,
        studentType:         form.studentType || "Day",
        previousSchool:      form.previousSchool,
        previousClass:       form.previousClass,
        regNo:               form.regNo,
        status:              form.status,
        feeStatus:           form.feeStatus,
      }
      if (hasParentData && form.parentName && form.parentPhone && form.relationship) {
        // Send the whole guardian list — the main contact first, then any
        // others. Rows keep their id so their portal login stays attached,
        // and a guardian dropped from the list is removed.
        payload.guardians = [
          {
            ...(primaryGuardianId ? { id: primaryGuardianId } : {}),
            fullName:      form.parentName,
            relationship:  form.relationship,
            phone:         form.parentPhone,
            email:         form.parentEmail,
            occupation:    form.occupation,
            officeAddress: form.officeAddress,
            homeAddress:   form.homeAddress,
            isPrimary:     true,
          },
          ...extraGuardians
            .filter(g => g.fullName.trim() || g.phone.trim())
            .map(g => ({
              ...(g.id ? { id: g.id } : {}),
              fullName:     g.fullName.trim(),
              relationship: g.relationship,
              phone:        g.phone.trim(),
              email:        g.email.trim(),
              occupation:   g.occupation.trim(),
              isPrimary:    false,
            })),
        ]
        if (parentMode === "existing" && parentUserId) {
          payload.parentUserId = Number(parentUserId)
        }
      }
      const filledContacts = emergencyContacts.filter(ec => ec.name.trim() || ec.phone.trim())
      payload.emergencyContacts = filledContacts
      if (hasDonor && selectedDonor) {
        payload.donor = Number(selectedDonor)
        payload.donorNumber = donorNumber
      }
      await api.patch(`/api/students/${studentId}/`, payload)
      router.push("/dashboard/students")
    } catch (e: any) {
      const d = e?.response?.data
      if (d && typeof d === "object") {
        const fieldLabels: Record<string, string> = {
          reg_no: "Registration Number", first_name: "First Name", last_name: "Last Name",
          date_of_birth: "Date of Birth", gender: "Gender", student_class: "Class",
          student_type: "Student Type", admission_date: "Admission Date",
          academic_session: "Academic Session",
        }
        const lines: string[] = []
        for (const [key, val] of Object.entries(d)) {
          if (key === "parent" && typeof val === "object") {
            for (const [pk, pv] of Object.entries(val as Record<string, any>)) {
              lines.push(`Parent ${pk}: ${Array.isArray(pv) ? pv.join(", ") : pv}`)
            }
          } else {
            lines.push(`${fieldLabels[key] || key}: ${Array.isArray(val) ? val.join(", ") : val}`)
          }
        }
        setSubmitError(lines.join("\n"))
      } else {
        setSubmitError("Update failed. Please check all fields and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !user) return null
  if (!["super_admin", "admin"].includes(user.role)) return null

  if (loading) {
    return (
      <>
        <DashboardHeader title="Edit Student" description="Update student information" />
        <div className="p-6 text-center text-sm text-muted-foreground">Loading student data...</div>
      </>
    )
  }

  return (
    <>
      <DashboardHeader title="Edit Student" description="Update student information" />
      <div className="p-6">
        <Link href="/dashboard/students">
          <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
          </Button>
        </Link>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            {["Personal Info", "Parent/Guardian", "Academic Details", "Documents"].map((label, index) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    step > index + 1 ? "bg-accent text-accent-foreground"
                    : step === index + 1 ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                  }`}>{index + 1}</div>
                  <span className={`text-xs font-medium hidden sm:block ${step === index + 1 ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                {index < 3 && <div className={`flex-1 h-0.5 ${step > index + 1 ? "bg-accent" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Personal Information */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: "var(--font-heading)" }}>Personal Information</CardTitle>
              <CardDescription>Update the student&apos;s personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>First Name *</Label>
                  <Input placeholder="Enter first name" value={form.firstName} onChange={e => setField("firstName", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Last Name *</Label>
                  <Input placeholder="Enter last name" value={form.lastName} onChange={e => setField("lastName", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Middle Name</Label>
                  <Input placeholder="Enter middle name" value={form.middleName} onChange={e => setField("middleName", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Date of Birth *</Label>
                  <Input type="date" value={form.dateOfBirth} onChange={e => setField("dateOfBirth", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Gender *</Label>
                  <Select value={form.gender} onValueChange={v => setField("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Blood Group</Label>
                  <Select value={form.bloodGroup} onValueChange={v => setField("bloodGroup", v)}>
                    <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                    <SelectContent>
                      {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(bg => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Religion</Label>
                  <Select value={form.religion} onValueChange={v => setField("religion", v)}>
                    <SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Islam">Islam</SelectItem>
                      <SelectItem value="Christianity">Christianity</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>State of Origin</Label>
                  <Input placeholder="Enter state of origin" value={form.stateOfOrigin} onChange={e => setField("stateOfOrigin", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Residential Address</Label>
                  <Textarea placeholder="Enter full address" rows={3} value={form.address} onChange={e => setField("address", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                    <Checkbox id="isOrphan" checked={isOrphan} onCheckedChange={v => setIsOrphan(!!v)} />
                    <Label htmlFor="isOrphan" className="cursor-pointer font-normal">This student is an orphan</Label>
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Disability / Special Needs</Label>
                  <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="hasDisability"
                        checked={hasDisability}
                        onCheckedChange={v => {
                          setHasDisability(!!v)
                          if (!v) setDisabilityDetails("")
                        }}
                      />
                      <Label htmlFor="hasDisability" className="cursor-pointer font-normal">
                        This student has a disability or special educational need
                      </Label>
                    </div>
                    {hasDisability && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="disabilityDetails">Details *</Label>
                        <Textarea
                          id="disabilityDetails"
                          rows={3}
                          placeholder="Describe the disability, support needs and any accommodations required"
                          value={disabilityDetails}
                          onChange={e => setDisabilityDetails(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Kept confidential and shared only with staff supporting this student.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setStep(2)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Parent/Guardian */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: "var(--font-heading)" }}>Parent / Guardian Information</CardTitle>
              <CardDescription>Select an existing parent account or update parent details</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mode toggle */}
              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setParentMode("existing")}
                  className={`flex-1 flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                    parentMode === "existing" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${parentMode === "existing" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Select Existing Parent</p>
                    <p className="text-xs text-muted-foreground">Parent already has a system account</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setParentMode("new"); setParentUserId("") }}
                  className={`flex-1 flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                    parentMode === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${parentMode === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Enter / Update Parent Details</p>
                    <p className="text-xs text-muted-foreground">Edit parent info manually</p>
                  </div>
                </button>
              </div>

              {/* Existing parent selector */}
              {parentMode === "existing" && (
                <div className="mb-6">
                  <Label className="mb-2 block">Select Parent Account *</Label>
                  {parentUsers.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                      No parent accounts found. Create one in User Management first.
                    </div>
                  ) : (
                    <Select value={parentUserId} onValueChange={(v) => {
                      setParentUserId(v)
                      const pu = parentUsers.find((u: any) => String(u.id) === v)
                      if (pu) {
                        const pi = pu.parentInfo
                        setForm((f: any) => ({
                          ...f,
                          parentName: pi?.fullName || [pu.firstName, pu.lastName].filter(Boolean).join(" ") || "",
                          relationship: pi?.relationship || "",
                          parentPhone: pi?.phone || "",
                          parentEmail: pi?.email || pu.email || "",
                          occupation: pi?.occupation || "",
                          officeAddress: pi?.officeAddress || "",
                          homeAddress: pi?.homeAddress || "",
                        }))
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Choose a parent account" /></SelectTrigger>
                      <SelectContent>
                        {parentUsers.map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            <span className="font-medium">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}</span>
                            {u.parentInfo && <span className="ml-2 text-xs text-muted-foreground">— {u.parentInfo.phone}</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {parentUserId && (
                    <p className="mt-2 text-xs text-accent">✓ Parent info auto-filled below. Only <strong>Relationship</strong> can be changed.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Full Name</Label>
                  <Input placeholder="Enter parent/guardian name" value={form.parentName} onChange={e => setField("parentName", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.parentName} className={parentMode === "existing" && !!parentUserId && !!form.parentName ? "bg-muted text-muted-foreground" : ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Relationship</Label>
                  <Select value={form.relationship} onValueChange={v => setField("relationship", v)}>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Phone Number</Label>
                  <Input type="tel" placeholder="+234 XXX XXX XXXX" value={form.parentPhone} onChange={e => setField("parentPhone", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.parentPhone} className={parentMode === "existing" && !!parentUserId && !!form.parentPhone ? "bg-muted text-muted-foreground" : ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="Enter email" value={form.parentEmail} onChange={e => setField("parentEmail", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.parentEmail} className={parentMode === "existing" && !!parentUserId && !!form.parentEmail ? "bg-muted text-muted-foreground" : ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Occupation</Label>
                  <Input placeholder="Enter occupation" value={form.occupation} onChange={e => setField("occupation", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.occupation} className={parentMode === "existing" && !!parentUserId && !!form.occupation ? "bg-muted text-muted-foreground" : ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Office Address</Label>
                  <Input placeholder="Enter office address" value={form.officeAddress} onChange={e => setField("officeAddress", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.officeAddress} className={parentMode === "existing" && !!parentUserId && !!form.officeAddress ? "bg-muted text-muted-foreground" : ""} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Home Address</Label>
                  <Textarea placeholder="Enter home address" rows={3} value={form.homeAddress} onChange={e => setField("homeAddress", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.homeAddress} className={parentMode === "existing" && !!parentUserId && !!form.homeAddress ? "bg-muted text-muted-foreground" : ""} />
                </div>
              </div>
              <Separator className="my-6" />

              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Additional Guardians</p>
                  <p className="text-xs text-muted-foreground/80">
                    The father, uncle or elder brother alongside the main contact. Each can be given
                    their own parent-portal login from User Management.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addGuardian}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Add Guardian
                </Button>
              </div>
              {extraGuardians.map((g, i) => (
                <div key={g.id ?? `new-${i}`} className="rounded-lg border border-border p-4 mb-3 relative">
                  <button type="button" onClick={() => removeGuardian(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Guardian {i + 2}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Full Name *</Label>
                      <Input placeholder="e.g. Said Juma" value={g.fullName} onChange={e => setGuardian(i, "fullName", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Relationship *</Label>
                      <Select value={g.relationship} onValueChange={v => setGuardian(i, "relationship", v)}>
                        <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Father">Father</SelectItem>
                          <SelectItem value="Mother">Mother</SelectItem>
                          <SelectItem value="Uncle">Uncle</SelectItem>
                          <SelectItem value="Aunt">Aunt</SelectItem>
                          <SelectItem value="Brother">Brother</SelectItem>
                          <SelectItem value="Sister">Sister</SelectItem>
                          <SelectItem value="Grandfather">Grandfather</SelectItem>
                          <SelectItem value="Grandmother">Grandmother</SelectItem>
                          <SelectItem value="Guardian">Guardian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Phone *</Label>
                      <Input type="tel" placeholder="+255 XXX XXX XXX" value={g.phone} onChange={e => setGuardian(i, "phone", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="Used for their portal login" value={g.email} onChange={e => setGuardian(i, "email", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label>Occupation</Label>
                      <Input placeholder="Enter occupation" value={g.occupation} onChange={e => setGuardian(i, "occupation", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}

              <Separator className="my-6" />
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">Emergency Contacts <span className="text-xs">(if different from parent)</span></p>
                <Button type="button" variant="outline" size="sm" onClick={addEmergencyContact}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Add Contact
                </Button>
              </div>
              {emergencyContacts.map((ec, i) => (
                <div key={i} className="rounded-lg border border-border p-4 mb-3 relative">
                  {emergencyContacts.length > 1 && (
                    <button type="button" onClick={() => removeEmergencyContact(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Contact {i + 1}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label>Name</Label>
                      <Input placeholder="Full name" value={ec.name} onChange={e => setEC(i, "name", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Phone</Label>
                      <Input type="tel" placeholder="+234 XXX XXX XXXX" value={ec.phone} onChange={e => setEC(i, "phone", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Relationship</Label>
                      <Select value={ec.relationship} onValueChange={v => setEC(i, "relationship", v)}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uncle">Uncle</SelectItem>
                          <SelectItem value="aunt">Aunt</SelectItem>
                          <SelectItem value="grandparent">Grandparent</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="neighbour">Neighbour</SelectItem>
                          <SelectItem value="family_friend">Family Friend</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Previous</Button>
                <Button onClick={() => setStep(3)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Academic Details */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: "var(--font-heading)" }}>Academic Details</CardTitle>
              <CardDescription>Update class and academic information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Class *</Label>
                  <Select value={form.admissionClass} onValueChange={v => setField("admissionClass", v)}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((cls: any) => (
                        <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Academic Session *</Label>
                  <Select value={form.academicSession} onValueChange={v => setField("academicSession", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Admission Date *</Label>
                  <Input type="date" value={form.admissionDate} onChange={e => setField("admissionDate", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Student Type *</Label>
                  <Select value={form.studentType} onValueChange={v => setField("studentType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day Student</SelectItem>
                      <SelectItem value="Boarding">Boarding Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setField("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Fee Status</Label>
                  <Select value={form.feeStatus} onValueChange={v => setField("feeStatus", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Previous School</Label>
                  <Input placeholder="Enter previous school name" value={form.previousSchool} onChange={e => setField("previousSchool", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Previous Class</Label>
                  <Input placeholder="Enter previous class" value={form.previousClass} onChange={e => setField("previousClass", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Registration Number *</Label>
                  <Input placeholder="e.g. FISS/2026/157" value={form.regNo} onChange={e => setField("regNo", e.target.value)} />
                </div>
              </div>

              <Separator className="my-6" />

              {/* Donor / Sponsor */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox id="hasDonor" checked={hasDonor} onCheckedChange={v => {
                    setHasDonor(!!v)
                    if (!v) { setSelectedDonor(""); setDonorNumber("") }
                  }} />
                  <Label htmlFor="hasDonor" className="flex cursor-pointer items-center gap-2 font-medium">
                    <Heart className="h-4 w-4 text-pink-500" />
                    This student has a donor / sponsor
                  </Label>
                </div>
                {hasDonor && (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label>Select Donor *</Label>
                      <Select value={selectedDonor} onValueChange={setSelectedDonor}>
                        <SelectTrigger><SelectValue placeholder="Choose a donor" /></SelectTrigger>
                        <SelectContent>
                          {activeDonors.map((d: any) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              <span className="font-medium">{d.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">({d.type})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Donor Number *</Label>
                      <Input placeholder="e.g. DON-2026-042" value={donorNumber} onChange={e => setDonorNumber(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Previous</Button>
                <Button onClick={() => setStep(4)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Documents */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: "var(--font-heading)" }}>Document Uploads</CardTitle>
              <CardDescription>Upload or replace student documents. Changes are saved immediately.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {DOCS.map(({ key, label }) => {
                  const uploaded = existingDocs.filter((d: any) => d.documentType === key)
                  const latest = uploaded[uploaded.length - 1] || null
                  const isUploading = docUploading === key
                  return (
                    <div key={key} className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-colors ${
                      latest ? "border-accent/30 bg-accent/5" : "border-dashed border-border bg-muted/20"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{label}</p>
                        {latest && <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />}
                      </div>
                      {latest ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[11px] text-muted-foreground">
                            Uploaded {new Date(latest.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                          <a href={latest.fileUrl || latest.file} target="_blank" rel="noopener noreferrer" className="w-full">
                            <Button variant="outline" size="sm" className="w-full gap-1.5 h-7 text-xs">
                              <ExternalLink className="h-3 w-3" /> View / Download
                            </Button>
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Not uploaded</p>
                      )}
                      <label className="w-full cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx"
                          disabled={isUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleDocUpload(key, f)
                            e.target.value = ""
                          }}
                        />
                        <div className={`flex items-center justify-center gap-1.5 h-8 text-xs w-full rounded-md border px-3 transition-colors ${
                          isUploading
                            ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
                            : latest
                            ? "border-border bg-background hover:bg-accent hover:text-accent-foreground"
                            : "border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                        }`}>
                          {isUploading
                            ? <><Upload className="h-3 w-3 animate-bounce" /> Uploading...</>
                            : <><Upload className="h-3 w-3" /> {latest ? "Replace" : "Upload"}</>
                          }
                        </div>
                      </label>
                    </div>
                  )
                })}
              </div>

              <Separator className="my-6" />

              <div className="rounded-lg bg-accent/10 border border-accent/20 p-4">
                <p className="text-sm font-medium text-card-foreground mb-1">Ready to Save</p>
                <p className="text-xs text-muted-foreground">
                  Document uploads are saved immediately. Click Save Changes to update all other student information.
                </p>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>Previous</Button>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit} disabled={submitting}>
                  <Save className="mr-2 h-4 w-4" /> {submitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>

              {submitError && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Please fix the following:</p>
                  {submitError.split("\n").map((line, i) => (
                    <p key={i} className="text-xs text-destructive">{line}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
