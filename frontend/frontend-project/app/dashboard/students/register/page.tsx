"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Upload, Save, Heart, Users, UserPlus, PlusCircle, Trash2 } from "lucide-react"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"

export default function RegisterStudentPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  useEffect(() => {
    if (!authLoading && user && !["super_admin", "admin"].includes(user.role)) router.replace("/dashboard")
  }, [user, authLoading, router])

  const [step, setStep] = useState(1)
  const [hasDonor, setHasDonor] = useState(false)
  const [selectedDonor, setSelectedDonor] = useState("")
  const [donorsData, setDonorsData] = useState<any[]>([])
  const [parentMode, setParentMode] = useState<"new" | "existing">("new")
  const [parentUserId, setParentUserId] = useState("")
  const [parentUsers, setParentUsers] = useState<any[]>([])

  const activeDonors = donorsData.filter((d: any) => d.status === "active")

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    api.get("/api/donors/").then(r => setDonorsData(getResults(r.data))).catch(() => {})
    api.get("/api/users/").then(r => {
      const all = getResults(r.data)
      setParentUsers(all.filter((u: any) => u.role === "parent"))
    }).catch(() => {})
  }, [user, authLoading])
  const [donorNumber, setDonorNumber] = useState("")
  const [isOrphan, setIsOrphan] = useState(false)
  const [form, setForm] = useState({
    firstName: "", lastName: "", middleName: "", dateOfBirth: "",
    gender: "", bloodGroup: "", religion: "", stateOfOrigin: "", address: "",
    parentName: "", relationship: "", parentPhone: "", parentEmail: "",
    occupation: "", officeAddress: "", homeAddress: "",
    admissionClass: "", academicSession: "2026", admissionDate: "",
    studentType: "Day", previousSchool: "", previousClass: "", regNo: "",
  })
  const [emergencyContacts, setEmergencyContacts] = useState([{ name: "", phone: "", relationship: "" }])
  const addEmergencyContact = () => setEmergencyContacts(prev => [...prev, { name: "", phone: "", relationship: "" }])
  const removeEmergencyContact = (i: number) => setEmergencyContacts(prev => prev.filter((_, idx) => idx !== i))
  const setEC = (i: number, key: string, value: string) => setEmergencyContacts(prev => prev.map((ec, idx) => idx === i ? { ...ec, [key]: value } : ec))
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin"].includes(user.role)) return
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  const setField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const DOCS = [
    { key: "passport_photo", label: "Passport Photograph *", accept: "image/*" },
    { key: "birth_certificate", label: "Birth Certificate *", accept: ".pdf,image/*" },
    { key: "previous_report", label: "Previous School Report", accept: ".pdf,image/*" },
    { key: "transfer_certificate", label: "Transfer Certificate", accept: ".pdf,image/*" },
    { key: "medical_certificate", label: "Medical Certificate", accept: ".pdf,image/*" },
    { key: "other", label: "Other Documents", accept: ".pdf,image/*" },
  ]

  const handleSubmit = async () => {
    if (!user || !["super_admin", "admin"].includes(user.role)) return
    setSubmitError("")
    // Basic validation
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.gender) {
      setSubmitError("Please fill in all required personal fields (first name, last name, date of birth, gender).")
      setStep(1)
      return
    }
    if (!form.admissionClass || !form.admissionDate || !form.regNo) {
      setSubmitError("Please fill in all required academic fields (class, admission date, reg. number).")
      setStep(3)
      return
    }
    if (!form.studentType) {
      setSubmitError("Please select a student type (Day or Boarding).")
      setStep(3)
      return
    }
    // If any parent field is provided, all 3 required parent fields must be filled
    const hasParentData = !!(form.parentName || form.parentPhone || form.relationship)
    if (hasParentData) {
      if (!form.parentName) {
        setSubmitError("Parent/Guardian full name is required.")
        setStep(2)
        return
      }
      if (!form.parentPhone) {
        setSubmitError("Parent/Guardian phone number is required.")
        setStep(2)
        return
      }
      if (!form.relationship) {
        setSubmitError("Parent/Guardian relationship is required.")
        setStep(2)
        return
      }
    }
    setSubmitting(true)
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        religion: form.religion,
        stateOfOrigin: form.stateOfOrigin,
        residentialAddress: form.address,
        isOrphan,
        studentClass: Number(form.admissionClass),
        academicSession: form.academicSession,
        admissionDate: form.admissionDate,
        studentType: form.studentType || "Day",
        previousSchool: form.previousSchool,
        previousClass: form.previousClass,
        regNo: form.regNo,
      }
      // Only include parent if all 3 required fields are filled
      if (hasParentData && form.parentName && form.parentPhone && form.relationship) {
        payload.parent = {
          fullName: form.parentName,
          relationship: form.relationship,
          phone: form.parentPhone,
          email: form.parentEmail,
          occupation: form.occupation,
          officeAddress: form.officeAddress,
          homeAddress: form.homeAddress,
        }
        if (parentMode === "existing" && parentUserId) {
          payload.parentUserId = Number(parentUserId)
        }
      }
      const filledContacts = emergencyContacts.filter(ec => ec.name.trim() || ec.phone.trim())
      if (filledContacts.length > 0) payload.emergencyContacts = filledContacts
      if (hasDonor && selectedDonor) {
        payload.donor = Number(selectedDonor)
        payload.donorNumber = donorNumber
      }
      console.log("[Register] Submitting payload:", JSON.stringify(payload, null, 2))
      const res = await api.post("/api/students/", payload)
      const studentId = res.data.id
      for (const [key, file] of Object.entries(files)) {
        if (!file) continue
        const fd = new FormData()
        fd.append("document_type", key)
        fd.append("file", file)
        await api.post(`/api/students/${studentId}/upload_document/`, fd)
      }
      router.push("/dashboard/students")
    } catch (e: any) {
      const d = e?.response?.data
      console.error("[Register] Error response:", JSON.stringify(d, null, 2))
      if (d && typeof d === "object") {
        // Parse DRF field errors into a readable list
        const lines: string[] = []
        const fieldLabels: Record<string, string> = {
          reg_no: "Registration Number", first_name: "First Name", last_name: "Last Name",
          date_of_birth: "Date of Birth", gender: "Gender", student_class: "Class",
          student_type: "Student Type", admission_date: "Admission Date",
          academic_session: "Academic Session", blood_group: "Blood Group",
          non_field_errors: "Error",
        }
        for (const [key, val] of Object.entries(d)) {
          const label = fieldLabels[key] || key
          if (key === "parent" && typeof val === "object") {
            for (const [pk, pv] of Object.entries(val as Record<string, any>)) {
              lines.push(`Parent ${pk}: ${Array.isArray(pv) ? pv.join(", ") : pv}`)
            }
          } else {
            lines.push(`${label}: ${Array.isArray(val) ? val.join(", ") : val}`)
          }
        }
        setSubmitError(lines.join("\n"))
      } else {
        setSubmitError("Registration failed. Please check all fields and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !user) return null
  if (!["super_admin", "admin"].includes(user.role)) return null

  return (
    <>
      <DashboardHeader
        title="Student Registration"
        description="Register a new student into the system"
      />

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
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      step > index + 1
                        ? "bg-accent text-accent-foreground"
                        : step === index + 1
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${step === index + 1 ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 ${step > index + 1 ? "bg-accent" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Personal Information */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: "var(--font-heading)" }}>Personal Information</CardTitle>
              <CardDescription>Enter the student&apos;s personal details</CardDescription>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Blood Group</Label>
                  <Select value={form.bloodGroup} onValueChange={v => setField("bloodGroup", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Religion</Label>
                  <Select value={form.religion} onValueChange={v => setField("religion", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select religion" />
                    </SelectTrigger>
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
                  <Label>Residential Address *</Label>
                  <Textarea placeholder="Enter full address" rows={3} value={form.address} onChange={e => setField("address", e.target.value)} />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Orphan Status</Label>
                  <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                    <Checkbox
                      id="isOrphan"
                      checked={isOrphan}
                      onCheckedChange={(v) => setIsOrphan(!!v)}
                    />
                    <Label htmlFor="isOrphan" className="cursor-pointer font-normal">
                      This student is an orphan
                    </Label>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setStep(2)}>
                  Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Parent/Guardian */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: "var(--font-heading)" }}>Parent / Guardian Information</CardTitle>
              <CardDescription>Select an existing parent account or enter new parent details</CardDescription>
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
                    <p className="text-sm font-semibold">Enter New Parent</p>
                    <p className="text-xs text-muted-foreground">Fill in parent details manually</p>
                  </div>
                </button>
              </div>

              {/* Existing parent selector */}
              {parentMode === "existing" && (
                <div className="mb-6">
                  <Label className="mb-2 block">Select Parent Account *</Label>
                  {parentUsers.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                      No parent accounts found. Create one in User Management first, or enter new parent details.
                    </div>
                  ) : (
                    <Select value={parentUserId} onValueChange={(v) => {
                      setParentUserId(v)
                      const pu = parentUsers.find((u: any) => String(u.id) === v)
                      if (pu) {
                        const pi = pu.parentInfo
                        setForm(f => ({
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
                  <Label>Full Name *</Label>
                  <Input placeholder="Enter parent/guardian name" value={form.parentName} onChange={e => setField("parentName", e.target.value)} disabled={parentMode === "existing" && !!parentUserId && !!form.parentName} className={parentMode === "existing" && !!parentUserId && !!form.parentName ? "bg-muted text-muted-foreground" : ""} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Relationship *</Label>
                  <Select value={form.relationship} onValueChange={v => setField("relationship", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Phone Number *</Label>
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
              <CardDescription>Configure class and academic information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Admission Class *</Label>
                  <Select value={form.admissionClass} onValueChange={v => setField("admissionClass", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day Student</SelectItem>
                      <SelectItem value="Boarding">Boarding Student</SelectItem>
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
                  <p className="text-xs text-muted-foreground">Enter the student&apos;s registration number manually.</p>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Donor / Sponsor Section */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="hasDonor"
                    checked={hasDonor}
                    onCheckedChange={(v) => {
                      setHasDonor(!!v)
                      if (!v) { setSelectedDonor(""); setDonorNumber("") }
                    }}
                  />
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
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a donor from the list" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeDonors.map((d: any) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              <span className="font-medium">{d.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">({d.type})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedDonor && (() => {
                        const d = activeDonors.find((x: any) => String(x.id) === selectedDonor)
                        return d ? (
                          <p className="text-xs text-muted-foreground">
                            Contact: {d.contact} &bull; {d.phone}
                          </p>
                        ) : null
                      })()}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Student Donor Number *</Label>
                      <Input
                        placeholder="e.g. DON-2026-042"
                        value={donorNumber}
                        onChange={(e) => setDonorNumber(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The reference number assigned to this student by the donor
                      </p>
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
              <CardDescription>Upload required documents for the student record</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {DOCS.map((doc) => (
                  <div key={doc.key} className="flex flex-col gap-2">
                    <Label>{doc.label}</Label>
                    <label
                      htmlFor={`file-${doc.key}`}
                      className="flex items-center justify-center rounded-lg border-2 border-dashed border-border p-6 hover:border-primary/30 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        {files[doc.key] ? (
                          <>
                            <Upload className="h-8 w-8 text-accent" />
                            <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{files[doc.key]!.name}</p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Click to upload</p>
                              <p className="text-[10px] text-muted-foreground/60">PNG, JPG, PDF up to 5MB</p>
                            </div>
                          </>
                        )}
                      </div>
                    </label>
                    <input
                      type="file"
                      id={`file-${doc.key}`}
                      accept={doc.accept}
                      className="hidden"
                      onChange={e => setFiles(prev => ({ ...prev, [doc.key]: e.target.files?.[0] ?? null }))}
                    />
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="rounded-lg bg-accent/10 border border-accent/20 p-4">
                <p className="text-sm font-medium text-card-foreground mb-1">Ready to Register</p>
                <p className="text-xs text-muted-foreground">
                  Review all information before submitting. The student will receive an auto-generated registration number, and the parent/guardian will be notified via email.
                </p>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>Previous</Button>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSubmit} disabled={submitting}>
                  <Save className="mr-2 h-4 w-4" /> {submitting ? "Registering..." : "Complete Registration"}
                </Button>
              </div>
              {submitError && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Registration failed — please fix the following:</p>
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
