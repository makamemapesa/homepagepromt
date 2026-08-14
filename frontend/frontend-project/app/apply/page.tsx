"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CheckCircle2, Loader2, AlertCircle, ChevronRight, ChevronLeft, School, Copy, LogIn, KeyRound, User, Mail, PlusCircle } from "lucide-react"
import axios from "axios"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const CLASSES = [
  "Std 1", "Std 2", "Std 3", "Std 4", "Std 5", "Std 6", "Std 7",
  "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6",
]

type Step = 1 | 2 | 3

export default function ApplyPage() {
  const [window_, setWindow_] = useState<any>(null)
  const [windowLoading, setWindowLoading] = useState(true)
  const [windowError, setWindowError] = useState("")

  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Result state after submission
  const [result, setResult] = useState<{
    refNumber: string
    accountCreated: boolean
    accountEmail: string | null
    defaultPassword: string | null
  } | null>(null)

  const [form, setForm] = useState({
    first_name: "", last_name: "", middle_name: "",
    date_of_birth: "", gender: "", religion: "", nationality: "Tanzanian",
    previous_school: "", applying_for_class: "", student_type: "Day",
    parent_name: "", parent_phone: "", parent_email: "",
    parent_address: "", relationship: "Parent",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    axios.get(`${BASE_URL}/api/admission-windows/active/`)
      .then(r => setWindow_(r.data))
      .catch(e => {
        if (e?.response?.status === 404) {
          setWindowError("Applications are currently closed. Please check back later.")
        } else {
          setWindowError("Failed to load application information. Please try again.")
        }
      })
      .finally(() => setWindowLoading(false))
  }, [])

  function setField(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function validateStep(s: Step) {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.first_name.trim()) e.first_name = "Required"
      if (!form.last_name.trim()) e.last_name = "Required"
      if (!form.date_of_birth) e.date_of_birth = "Required"
      if (!form.gender) e.gender = "Required"
      if (!form.applying_for_class) e.applying_for_class = "Required"
    }
    if (s === 2) {
      if (!form.parent_name.trim()) e.parent_name = "Required"
      if (!form.parent_phone.trim()) e.parent_phone = "Required"
      if (form.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parent_email)) {
        e.parent_email = "Enter a valid email address"
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() { if (validateStep(step)) setStep(s => (s + 1) as Step) }
  function back() { setStep(s => (s - 1) as Step) }

  async function submit() {
    if (!validateStep(step)) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = { ...form, window: window_?.id, academic_session: window_?.academic_session }
      const res = await axios.post(`${BASE_URL}/api/applicants/`, payload)
      setResult({
        refNumber: `APP-${String(res.data.id).padStart(5, "0")}`,
        accountCreated: res.data.account_created || false,
        accountEmail: res.data.account_email || null,
        defaultPassword: res.data.default_password || null,
      })
    } catch (e: any) {
      const detail = e?.response?.data
      if (detail && typeof detail === "object") {
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(" · ")
        setSubmitError(msgs)
      } else {
        setSubmitError("Submission failed. Please check your information and try again.")
      }
    } finally { setSubmitting(false) }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function resetForAnotherChild() {
    setResult(null)
    setStep(1)
    setSubmitError("")
    setCopied(null)
    setForm({
      first_name: "", last_name: "", middle_name: "",
      date_of_birth: "", gender: "", religion: "", nationality: "Tanzanian",
      previous_school: "", applying_for_class: "", student_type: "Day",
      // Keep parent details pre-filled so they don't retype them
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      parent_email: form.parent_email,
      parent_address: form.parent_address,
      relationship: form.relationship,
    })
    setErrors({})
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (windowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Applications closed ────────────────────────────────────────────────────
  if (windowError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 space-y-3">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-semibold">Applications Closed</h2>
            <p className="text-muted-foreground">{windowError}</p>
            <Link href="/login">
              <Button variant="outline" className="mt-2">
                <LogIn className="h-4 w-4 mr-2" /> Already applied? Login here
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <div className="max-w-lg w-full space-y-4">
          {/* Success card */}
          <Card className="text-center">
            <CardContent className="pt-10 pb-6 space-y-3">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Application Submitted!</h2>
              <p className="text-muted-foreground">Your application has been received successfully.</p>
              <div className="bg-muted rounded-lg px-6 py-4 inline-block mt-2">
                <p className="text-xs text-muted-foreground mb-1">Reference Number</p>
                <p className="text-2xl font-mono font-bold tracking-widest">{result.refNumber}</p>
              </div>
            </CardContent>
          </Card>

          {/* Account credentials card — shown when a new account was created */}
          {result.accountCreated && result.accountEmail && result.defaultPassword && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="pt-6 pb-6 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <KeyRound className="h-5 w-5" />
                  Your Account Has Been Created
                </div>
                <p className="text-sm text-muted-foreground">
                  Use these credentials to log in and track your application status.
                  <strong className="text-foreground"> Please save them now.</strong>
                </p>

                {/* Email row */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Username / Email</p>
                      <p className="text-sm font-mono font-medium truncate">{result.accountEmail}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => copyText(result.accountEmail!, "email")}>
                    <Copy className="h-3.5 w-3.5 mr-1" />{copied === "email" ? "Copied!" : "Copy"}
                  </Button>
                </div>

                {/* Password row */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Default Password</p>
                      <p className="text-sm font-mono font-medium">{result.defaultPassword}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => copyText(result.defaultPassword!, "pass")}>
                    <Copy className="h-3.5 w-3.5 mr-1" />{copied === "pass" ? "Copied!" : "Copy"}
                  </Button>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
                  Your default password is your <strong>first name in lowercase</strong>.
                  Please change it after your first login.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Account already existed */}
          {!result.accountCreated && result.accountEmail && (
            <Card className="border border-border/50">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  An account already exists for <strong className="text-foreground">{result.accountEmail}</strong>.
                  The application has been linked to your existing account.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next steps */}
          <Card className="border border-border/50">
            <CardContent className="pt-5 pb-5 space-y-2">
              <p className="text-sm font-semibold">Next Steps</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Pay the application fee at the school office</li>
                <li>Wait for an interview date notification</li>
                <li>Attend the interview with your child</li>
                <li>Log in to check your application status anytime</li>
              </ol>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="w-full gap-2" onClick={resetForAnotherChild}>
              <PlusCircle className="h-4 w-4" /> Apply for Another Child
            </Button>
            <Link href="/login" className="block">
              <Button className="w-full gap-2">
                <LogIn className="h-4 w-4" /> Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const STEPS = ["Child Details", "Parent / Guardian", "Review & Submit"]

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <School className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Student Application</h1>
          <p className="text-muted-foreground">
            Academic Session {window_?.academic_session} &nbsp;·&nbsp;
            Applications open until <strong>{window_?.close_date}</strong>
          </p>
          {Number(window_?.application_fee) > 0 && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Application fee: <strong>{Number(window_?.application_fee).toLocaleString()} TZS</strong> (payable at school office after submission)
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Already applied?{" "}
            <Link href="/login" className="text-primary underline underline-offset-2">
              Log in to track your application
            </Link>
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5 flex-1">
                <div className={`h-6 w-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0
                  ${i < step - 1 ? "bg-green-500 text-white" : i === step - 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i < step - 1 ? "✓" : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step - 1 ? "font-semibold" : "text-muted-foreground"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-6 bg-border shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">

            {/* Step 1: Child */}
            {step === 1 && (
              <>
                <CardTitle className="text-base">Child&apos;s Information</CardTitle>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name *</Label>
                    <Input value={form.first_name} onChange={e => setField("first_name", e.target.value)} />
                    {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
                  </div>
                  <div>
                    <Label>Last Name *</Label>
                    <Input value={form.last_name} onChange={e => setField("last_name", e.target.value)} />
                    {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
                  </div>
                  <div>
                    <Label>Middle Name</Label>
                    <Input value={form.middle_name} onChange={e => setField("middle_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Date of Birth *</Label>
                    <Input type="date" value={form.date_of_birth} onChange={e => setField("date_of_birth", e.target.value)} />
                    {errors.date_of_birth && <p className="text-xs text-destructive mt-1">{errors.date_of_birth}</p>}
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <Select value={form.gender} onValueChange={v => setField("gender", v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && <p className="text-xs text-destructive mt-1">{errors.gender}</p>}
                  </div>
                  <div>
                    <Label>Religion</Label>
                    <Input placeholder="e.g. Islam, Christianity" value={form.religion} onChange={e => setField("religion", e.target.value)} />
                  </div>
                  <div>
                    <Label>Nationality</Label>
                    <Input value={form.nationality} onChange={e => setField("nationality", e.target.value)} />
                  </div>
                  <div>
                    <Label>Previous School</Label>
                    <Input value={form.previous_school} onChange={e => setField("previous_school", e.target.value)} />
                  </div>
                  <div>
                    <Label>Applying For Class *</Label>
                    <Select value={form.applying_for_class} onValueChange={v => setField("applying_for_class", v)}>
                      <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
                      <SelectContent>
                        {CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.applying_for_class && <p className="text-xs text-destructive mt-1">{errors.applying_for_class}</p>}
                  </div>
                  <div>
                    <Label>Student Type</Label>
                    <Select value={form.student_type} onValueChange={v => setField("student_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day">Day</SelectItem>
                        <SelectItem value="Boarding">Boarding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Parent */}
            {step === 2 && (
              <>
                <CardTitle className="text-base">Parent / Guardian Information</CardTitle>
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-muted-foreground">
                  <strong className="text-foreground">Account Information:</strong> If you provide an email address,
                  a login account will be <strong className="text-foreground">automatically created</strong> for you.
                  Your default password will be your <strong className="text-foreground">first name (lowercase)</strong>.
                  You can log in later to track your application.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Full Name *</Label>
                    <Input value={form.parent_name} onChange={e => setField("parent_name", e.target.value)} />
                    {errors.parent_name && <p className="text-xs text-destructive mt-1">{errors.parent_name}</p>}
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Input placeholder="+255..." value={form.parent_phone} onChange={e => setField("parent_phone", e.target.value)} />
                    {errors.parent_phone && <p className="text-xs text-destructive mt-1">{errors.parent_phone}</p>}
                  </div>
                  <div>
                    <Label>Email Address <span className="text-muted-foreground text-xs">(used for account login)</span></Label>
                    <Input type="email" placeholder="your@email.com" value={form.parent_email} onChange={e => setField("parent_email", e.target.value)} />
                    {errors.parent_email && <p className="text-xs text-destructive mt-1">{errors.parent_email}</p>}
                  </div>
                  <div>
                    <Label>Relationship to Child</Label>
                    <Select value={form.relationship} onValueChange={v => setField("relationship", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Guardian">Guardian</SelectItem>
                        <SelectItem value="Relative">Relative</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Home Address</Label>
                    <Input value={form.parent_address} onChange={e => setField("parent_address", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <>
                <CardTitle className="text-base">Review Your Application</CardTitle>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Child</p>
                    <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                      {[
                        ["Name", `${form.first_name} ${form.middle_name} ${form.last_name}`.replace(/\s+/g, " ").trim()],
                        ["Date of Birth", form.date_of_birth],
                        ["Gender", form.gender],
                        ["Religion", form.religion],
                        ["Applying For", form.applying_for_class],
                        ["Student Type", form.student_type],
                        ["Previous School", form.previous_school],
                      ].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l} className="flex justify-between px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{l}</span>
                          <span className="font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Parent / Guardian</p>
                    <div className="rounded-lg border border-border/50 divide-y divide-border/30">
                      {[
                        ["Name", form.parent_name],
                        ["Phone", form.parent_phone],
                        ["Email", form.parent_email],
                        ["Address", form.parent_address],
                        ["Relationship", form.relationship],
                      ].filter(([, v]) => v).map(([l, v]) => (
                        <div key={l} className="flex justify-between px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{l}</span>
                          <span className="font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {form.parent_email && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm">
                      <span className="font-medium">Account will be created:</span> Login with <strong>{form.parent_email}</strong> and password = your first name lowercase
                      {" ("}
                      <strong>{form.parent_name.trim().split(" ")[0]?.toLowerCase() || "yourname"}</strong>
                      {")"}
                    </div>
                  )}
                  {submitError && (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={back} disabled={step === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 3 ? (
            <Button onClick={next}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Application
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}