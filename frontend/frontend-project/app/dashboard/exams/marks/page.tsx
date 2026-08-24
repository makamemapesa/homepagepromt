"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { api, getResults } from "@/lib/api-client"
import { buildTermOptions } from "@/lib/utils"
import { Save, CheckCircle2, ClipboardList, Users, BookOpen, Calculator } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

import { useGradeConfig } from "@/hooks/use-grade-config"

type Marks = Record<string, string>

const EXAM_SUGGESTIONS = [
  "CA 1", "CA 2", "CA 3", "CA 4", "CA 5",
  "Mid-Term", "End of Term", "Test 1", "Test 2",
  "Assignment 1", "Assignment 2", "Practical", "Project",
]

export default function MarksEntryPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const { getGrade } = useGradeConfig()
  const [classes, setClasses] = useState<any[]>([])
  const [subjectsList, setSubjectsList] = useState<any[]>([])
  const [allStudents, setAllStudents] = useState<any[]>([])

  const [selectedClass, setSelectedClass] = useState("")
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [selectedTerm, setSelectedTerm] = useState("Term 2, 2026")

  const academicSession = useMemo(() => selectedTerm.split(", ")[1] || "", [selectedTerm])

  const [terms, setTerms] = useState(() => buildTermOptions("2026"))
  const [examType, setExamType] = useState("")
  const [marks, setMarks] = useState<Marks>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  const [allMarksForTerm, setAllMarksForTerm] = useState<any[]>([])
  const [refreshTick, setRefreshTick] = useState(0)
  const [includedTypes, setIncludedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    api.get("/api/settings/").then(r => {
      const d = Array.isArray(r.data) ? r.data[0] : r.data
      if (!d) return
      const session = d.academicSession || "2026"
      const term = d.currentTerm || "Term 2"
      setTerms(buildTermOptions(session))
      setSelectedTerm(`${term}, ${session}`)
    }).catch(() => {})
    api.get("/api/classes/").then(r => setClasses(getResults(r.data))).catch(() => {})
    api.get("/api/subjects/").then(r => setSubjectsList(getResults(r.data))).catch(() => {})
  }, [user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    if (!selectedClassId) { setAllStudents([]); return }
    api.get(`/api/students/?student_class=${selectedClassId}&status=active&page_size=500`)
      .then(r => setAllStudents(getResults(r.data)))
      .catch(() => { setAllStudents([]); setSaveMsg("Could not load the class list. Check your connection and try again.") })
  }, [selectedClassId, user, authLoading])

  useEffect(() => {
    if (authLoading || !user) return
    if (!["super_admin", "admin", "teacher"].includes(user.role)) return
    if (!selectedClassId || !selectedSubjectId || !selectedTerm) {
      setAllMarksForTerm([])
      return
    }
    // page_size matters: a full class across several assessments runs well past
    // the 50-row default page, and the rows that fall off the end come back as
    // blank inputs — which then overwrite real marks on the next save.
    api.get(
      `/api/exam-marks/?student_class=${selectedClassId}&subject=${selectedSubjectId}&term=${encodeURIComponent(selectedTerm)}&academic_session=${encodeURIComponent(academicSession)}&page_size=500`
    )
      .then(r => setAllMarksForTerm(getResults(r.data) as any[]))
      .catch(() => { setAllMarksForTerm([]); setSaveMsg("Could not load existing marks for this selection.") })
  }, [selectedClassId, selectedSubjectId, selectedTerm, academicSession, refreshTick, user, authLoading])

  useEffect(() => {
    const types = Array.from(new Set(allMarksForTerm.map(m => m.examType))) as string[]
    setIncludedTypes(new Set(types))
  }, [allMarksForTerm])

  useEffect(() => {
    if (!examType) { setMarks({}); return }
    const prefilled: Marks = {}
    allMarksForTerm
      .filter(m => m.examType === examType)
      .forEach(m => { prefilled[String(m.student)] = String(parseFloat(m.score)) })
    setMarks(prefilled)
    setSaved(allMarksForTerm.some(m => m.examType === examType))
  }, [examType, allMarksForTerm])

  const classStudents = allStudents
    .map(s => ({
      id: String(s.id),
      name: s.fullName || [s.firstName, s.lastName].filter(Boolean).join(" ") || s.name || "Unknown",
      regNo: s.regNo || "",
    }))

  const selectedClassData = classes.find(c => c.name === selectedClass)
  // student_count is active-only, so it cannot tell "nobody enrolled" apart from
  // "everyone here is suspended" - enrolled_count carries the unfiltered total.
  const enrolledInClass = Number(selectedClassData?.enrolledCount ?? 0)
  const activeSubjects = selectedClassData
    ? subjectsList.filter(s => s.status === "active" && (selectedClassData.subjectNames || []).includes(s.name))
    : subjectsList.filter(s => s.status === "active")

  const availableTypes = useMemo(
    () => Array.from(new Set(allMarksForTerm.map(m => m.examType))).sort() as string[],
    [allMarksForTerm]
  )

  const studentsScoreMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    allMarksForTerm.forEach(m => {
      const sid = String(m.student)
      if (!map[sid]) map[sid] = {}
      map[sid][m.examType] = parseFloat(m.score)
    })
    return map
  }, [allMarksForTerm])

  const toggleType = (type: string, checked: boolean) => {
    setIncludedTypes(prev => {
      const next = new Set(prev)
      checked ? next.add(type) : next.delete(type)
      return next
    })
  }

  const setMark = (studentId: string, value: string) => {
    // parseFloat, not parseInt: half marks are ordinary in practical and
    // coursework papers, and the column is a Decimal all the way to the database.
    const num = parseFloat(value)
    if (value === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
      setMarks(m => ({ ...m, [studentId]: value }))
      setSaved(false)
      setSaveMsg("")
    }
  }

  const handleSave = () => {
    if (!user || !["super_admin", "admin", "teacher"].includes(user.role)) return
    if (!selectedClassId || !selectedSubjectId || !examType) return
    const trimmedType = examType.trim()
    if (!trimmedType) { setSaveMsg("Give the assessment a name before saving."); return }
    const markItems = classStudents
      .filter(s => marks[s.id] !== undefined && marks[s.id] !== "")
      .map(s => ({
        student: s.id,
        subject: selectedSubjectId,
        student_class: selectedClassId,
        term: selectedTerm,
        exam_type: trimmedType,
        academic_session: academicSession,
        score: parseFloat(marks[s.id]),
      }))
    setSaving(true); setSaveMsg("")
    api.post("/api/exam-marks/bulk_save/", { marks: markItems })
      .then(res => {
        // bulk_save answers 200 even when it rejected individual rows, so a
        // "Saved" badge on the bare promise resolving is a lie. Read the count.
        const savedCount = Number(res.data?.saved ?? 0)
        const rejected = markItems.length - savedCount
        if (rejected > 0) {
          setSaveMsg(`Saved ${savedCount} of ${markItems.length}. ${rejected} score(s) were rejected — check for values outside 0–100.`)
        } else {
          setSaved(true)
          setSaveMsg(`Saved ${savedCount} score${savedCount === 1 ? "" : "s"}.`)
        }
        // Optimistically update allMarksForTerm so the Score Summary reflects the new
        // scores without triggering a re-fetch that would overwrite the user's inputs.
        setAllMarksForTerm(prev => {
          const savedIds = new Set(markItems.map(m => m.student))
          const kept = prev.filter(
            m => !(m.examType === trimmedType && savedIds.has(String(m.student)))
          )
          const updated = markItems.map(m => ({
            student: Number(m.student),
            examType: m.exam_type,
            score: m.score,          // number — parseFloat/String work fine downstream
            term: m.term,
            subject: Number(m.subject),
            studentClass: Number(m.student_class),
          }))
          return [...kept, ...updated]
        })
      })
      .catch(err => {
        const detail = err?.response?.data?.error
          || (err?.response?.status === 403 ? "You are not allowed to enter marks for this class." : null)
          || "Could not save the marks. Nothing was changed."
        setSaveMsg(detail)
      })
      .finally(() => setSaving(false))
  }

  const filledCount = classStudents.filter(s => marks[s.id] !== undefined && marks[s.id] !== "").length
  // Averaged over the students actually marked — dividing by the whole class
  // treats every un-entered student as a zero and reads far too low mid-entry.
  const avgMark = filledCount > 0
    ? (classStudents.reduce((sum, s) => sum + (parseFloat(marks[s.id] || "") || 0), 0) / filledCount).toFixed(1)
    : ""

  const readyToEnter = selectedClass && selectedSubject && examType

  if (authLoading || !user) return null
  if (!["super_admin", "admin", "teacher"].includes(user.role)) { router.replace("/dashboard"); return null }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <DashboardHeader title="Marks Entry" description="Enter examination and assessment scores for students." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Select Class & Subject
          </CardTitle>
          <CardDescription>Choose the class, subject, and term. Then type the exam / assessment name.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Academic Term</span>
              <Select value={selectedTerm} onValueChange={v => { setSelectedTerm(v); setExamType(""); setSaved(false) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Class</span>
              <Select value={selectedClass} onValueChange={v => {
                const cls = classes.find(c => c.name === v)
                setSelectedClass(v)
                setSelectedClassId(cls ? String(cls.id) : "")
                setSelectedSubject(""); setSelectedSubjectId("")
                setExamType(""); setMarks({})
              }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Subject</span>
              <Select value={selectedSubject} onValueChange={v => {
                const subj = activeSubjects.find(s => s.name === v)
                setSelectedSubject(v)
                setSelectedSubjectId(subj ? String(subj.id) : "")
                setExamType(""); setSaved(false)
              }}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{activeSubjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Exam / Assessment Type</span>
              <Input
                list="examtype-suggestions"
                placeholder="e.g. CA 1, CA 3, Mid-Term..."
                value={examType}
                onChange={e => { setExamType(e.target.value); setSaved(false) }}
                disabled={!selectedSubject}
              />
              <datalist id="examtype-suggestions">
                {availableTypes.map(t => <option key={`saved-${t}`} value={t} />)}
                {EXAM_SUGGESTIONS.filter(t => !availableTypes.includes(t)).map(t => <option key={t} value={t} />)}
              </datalist>
              {availableTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">Saved: {availableTypes.join(", ")}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {readyToEnter && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Students", value: classStudents.length, icon: Users,        color: "text-primary",    bg: "bg-primary/10" },
            { label: "Marks Entered",  value: filledCount,          icon: ClipboardList, color: "text-accent",     bg: "bg-accent/10" },
            { label: "Remaining",      value: classStudents.length - filledCount, icon: BookOpen, color: "text-yellow-600", bg: "bg-yellow-500/10" },
            { label: "Class Average",  value: avgMark,              icon: CheckCircle2,  color: "text-blue-600",   bg: "bg-blue-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className={`rounded-lg p-2 ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
                <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {readyToEnter ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedSubject}  {selectedClass}</CardTitle>
                <CardDescription>{examType}  {selectedTerm}  Score out of 100</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button onClick={handleSave} className="gap-2" disabled={filledCount === 0 || saving}>
                  {saving
                    ? <><Save className="h-4 w-4" /> Saving…</>
                    : saved
                      ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
                      : <><Save className="h-4 w-4" /> Save Marks</>}
                </Button>
                {saveMsg && (
                  <p className={`text-xs ${saved ? "text-accent" : "text-destructive"}`}>{saveMsg}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Reg. No.</TableHead>
                  <TableHead>Score (/100)</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <p className="font-medium text-muted-foreground">
                        No students available to mark in {selectedClass}.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {enrolledInClass > 0
                          ? `${enrolledInClass} student${enrolledInClass === 1 ? " is" : "s are"} enrolled here, but Marks Entry only lists students whose status is Active. Reactivate them under Students to enter marks.`
                          : "No students are enrolled in this class yet. Assign students to it under Students before entering marks."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
                {classStudents.map((student, index) => {
                  const score = parseFloat(marks[student.id] || "")
                  const { grade, color, remark } = !isNaN(score)
                    ? getGrade(score)
                    : { grade: "", color: "text-muted-foreground", remark: "" }
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{student.regNo}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          className="w-20 h-8 text-center"
                          placeholder=""
                          value={marks[student.id] ?? ""}
                          onChange={e => setMark(student.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell><span className={`font-semibold ${color}`}>{grade}</span></TableCell>
                      <TableCell><span className="text-sm text-muted-foreground">{remark}</span></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : selectedClass && selectedSubject && !examType ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">Type or select an exam / assessment type above</p>
            <p className="text-sm text-muted-foreground">e.g. CA 1, CA 2, CA 3, Mid-Term, End of Term  anything you like</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">Select a class and subject to begin entering marks</p>
            <p className="text-sm text-muted-foreground">Use the selectors above to choose the class and subject.</p>
          </CardContent>
        </Card>
      )}

      {availableTypes.length > 0 && selectedClass && selectedSubject && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Score Summary &amp; Average Calculator</CardTitle>
                <CardDescription>
                  Tick the assessments you want to count towards the final average. Untick any you want to exclude.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 p-3">
              {availableTypes.map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={includedTypes.has(type)}
                    onCheckedChange={checked => toggleType(type, !!checked)}
                  />
                  <span className="text-sm font-medium">{type}</span>
                </label>
              ))}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => setIncludedTypes(new Set(availableTypes))}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => setIncludedTypes(new Set())}>
                  Clear All
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{includedTypes.size}</span> of{" "}
              <span className="font-medium text-foreground">{availableTypes.length}</span> assessments selected
              {includedTypes.size > 0 && `  average = sum of selected  ${includedTypes.size}`}
            </p>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Student</TableHead>
                    {availableTypes.map(t => (
                      <TableHead
                        key={t}
                        className={includedTypes.has(t) ? "text-primary font-semibold" : "opacity-40"}
                      >
                        {t}
                      </TableHead>
                    ))}
                    <TableHead className="text-primary font-semibold">Average</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((student, idx) => {
                    const scores = studentsScoreMap[student.id] || {}
                    const selected = availableTypes.filter(t => includedTypes.has(t) && scores[t] !== undefined)
                    const avg = selected.length > 0
                      ? selected.reduce((sum, t) => sum + scores[t], 0) / selected.length
                      : null
                    const { grade, color } = avg !== null ? getGrade(avg) : { grade: "", color: "text-muted-foreground" }
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        {availableTypes.map(t => (
                          <TableCell key={t} className={includedTypes.has(t) ? "" : "opacity-40 text-muted-foreground"}>
                            {scores[t] !== undefined ? (
                              <Badge variant="outline" className="font-mono text-xs">
                                {Number.isInteger(scores[t]) ? scores[t] : scores[t].toFixed(1)}
                              </Badge>
                            ) : ""}
                          </TableCell>
                        ))}
                        <TableCell>
                          {avg !== null
                            ? <span className={`font-bold text-base ${color}`}>{avg.toFixed(1)}</span>
                            : <span className="text-muted-foreground"></span>}
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${color}`}>{grade}</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}