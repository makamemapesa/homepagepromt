"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/contexts/user-context"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertCircle, ArrowLeft, UploadCloud, CheckCircle2, XCircle, Download,
  FileSpreadsheet, Save, RotateCcw,
} from "lucide-react"
import { api } from "@/lib/api-client"

type PreviewRow = {
  row: number
  regNo: string
  name: string
  studentClass: string
  valid: boolean
  errors: string[]
}

type ImportResult = {
  dryRun: boolean
  totalRows: number
  valid: number
  invalid: number
  created: number
  rows: PreviewRow[]
  detail?: string
}

type ColumnSpec = {
  key: string
  label: string
  required: boolean
  rule: string
  example: string
}

export default function ImportStudentsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [saved, setSaved] = useState<ImportResult | null>(null)
  const [columns, setColumns] = useState<ColumnSpec[]>([])
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin") {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (authLoading || !user || user.role !== "super_admin") return
    // The guide is served by the importer itself, so what is shown here is
    // exactly what the parser accepts.
    api.get("/api/students/import-columns/")
      .then((r) => setColumns(r.data.columns || []))
      .catch(() => {})
  }, [user, authLoading])

  if (authLoading || !user || user.role !== "super_admin") return null

  const resetOutcome = () => {
    setPreview(null)
    setSaved(null)
    setErrorMessage(null)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null)
    resetOutcome()
  }

  const readFailure = (error: any, fallback: string) => {
    const data = error?.response?.data
    if (data?.detail) return String(data.detail)
    if (typeof data === "string" && data.length < 300) return data
    return fallback
  }

  /** Step 1 — upload and validate, without writing anything. */
  const checkFile = async () => {
    if (!selectedFile) {
      setErrorMessage("Choose an Excel (.xlsx) or CSV file first.")
      return
    }
    setChecking(true)
    resetOutcome()
    try {
      const form = new FormData()
      form.append("file", selectedFile)
      form.append("dry_run", "true")
      const response = await api.post("/api/students/import-students/", form)
      setPreview(response.data)
    } catch (error: any) {
      setErrorMessage(readFailure(error, "That file could not be read. Check the format and try again."))
    } finally {
      setChecking(false)
    }
  }

  /** Step 2 — commit the rows that passed. */
  const saveStudents = async () => {
    if (!selectedFile) return
    setSaving(true)
    setErrorMessage(null)
    try {
      const form = new FormData()
      form.append("file", selectedFile)
      const response = await api.post("/api/students/import-students/", form)
      setSaved(response.data)
      setPreview(null)
    } catch (error: any) {
      setErrorMessage(readFailure(error, "Nothing was saved. Please try again."))
    } finally {
      setSaving(false)
    }
  }

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const response = await api.get("/api/students/import-template/", { responseType: "blob" })
      const url = URL.createObjectURL(response.data as Blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "student-import-template.xlsx"
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setErrorMessage("The template could not be downloaded. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  const startOver = () => {
    setSelectedFile(null)
    resetOutcome()
    const input = document.getElementById("student-import-file") as HTMLInputElement | null
    if (input) input.value = ""
  }

  const requiredColumns = columns.filter((c) => c.required)
  const optionalColumns = columns.filter((c) => !c.required)

  return (
    <>
      <DashboardHeader
        title="Import Students"
        description="Upload an Excel or CSV file to register many students at once."
        backHref="/dashboard/students"
      />

      <div className="p-6 space-y-6">
        {/* ── Step 1: the file ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>1. Choose your file</CardTitle>
                <CardDescription>
                  Excel (.xlsx) or CSV. Start from the template so the columns are already correct.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" />
                {downloading ? "Preparing..." : "Download Excel template"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="student-import-file">Student file</Label>
                <Input
                  id="student-import-file"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                />
              </div>
              <Button onClick={checkFile} disabled={!selectedFile || checking || saving}>
                <UploadCloud className="mr-2 h-4 w-4" />
                {checking ? "Checking..." : "Upload & check"}
              </Button>
            </div>
            {selectedFile && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {selectedFile.name} ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
              </p>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Step 2: review, then save ─────────────────────────────────── */}
        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>2. Review before saving</CardTitle>
              <CardDescription>
                Nothing has been saved yet. {preview.valid} of {preview.totalRows}{" "}
                {preview.totalRows === 1 ? "row is" : "rows are"} ready to import.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1 bg-accent/10 text-accent border-accent/30">
                  <CheckCircle2 className="h-3 w-3" /> {preview.valid} ready
                </Badge>
                {preview.invalid > 0 && (
                  <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
                    <XCircle className="h-3 w-3" /> {preview.invalid} need fixing
                  </Badge>
                )}
              </div>

              <div className="rounded-xl border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Reg. No.</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden sm:table-cell">Class</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.row} className={row.valid ? "" : "bg-destructive/5"}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.row}</TableCell>
                        <TableCell className="font-mono text-xs">{row.regNo || "—"}</TableCell>
                        <TableCell className="text-sm">{row.name || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {row.studentClass || "—"}
                        </TableCell>
                        <TableCell>
                          {row.valid ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-accent font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {row.errors.map((message, i) => (
                                <span key={i} className="inline-flex items-start gap-1.5 text-xs text-destructive">
                                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  <span>{message}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {preview.invalid > 0 && (
                <p className="text-xs text-muted-foreground">
                  Rows that need fixing are skipped. Correct them in your file and upload again to
                  bring them in, or save now to import the {preview.valid} that {preview.valid === 1 ? "is" : "are"} ready.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button onClick={saveStudents} disabled={saving || preview.valid === 0}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving
                    ? "Saving..."
                    : `Save ${preview.valid} ${preview.valid === 1 ? "student" : "students"}`}
                </Button>
                <Button variant="outline" onClick={startOver} disabled={saving}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Choose a different file
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Done ──────────────────────────────────────────────────────── */}
        {saved && (
          <Card className="border-accent/40">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent shrink-0" />
                <div>
                  <p className="font-semibold">
                    {saved.created} {saved.created === 1 ? "student" : "students"} saved
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {saved.invalid > 0
                      ? `${saved.invalid} ${saved.invalid === 1 ? "row was" : "rows were"} skipped because they still need fixing.`
                      : "Every row in the file was imported."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/students">
                  <Button>View student list</Button>
                </Link>
                <Button variant="outline" onClick={startOver}>Import another file</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Column guide ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>How to fill in each column</CardTitle>
            <CardDescription>
              Put the column headings in the first row, one student per row underneath. Headings are
              matched loosely — <code className="text-xs">reg_no</code>,{" "}
              <code className="text-xs">Reg No</code> and <code className="text-xs">REG-NO</code> all
              work. Columns you do not need can be left out entirely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading the column guide…</p>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Required — every row must have these {requiredColumns.length}
                  </p>
                  <ColumnTable rows={requiredColumns} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Optional — include only the ones you need
                  </p>
                  <ColumnTable rows={optionalColumns} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div>
          <Link href="/dashboard/students">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to student list
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}

function ColumnTable({ rows }: { rows: ColumnSpec[] }) {
  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Column heading</TableHead>
            <TableHead>How to fill it in</TableHead>
            <TableHead className="w-48 hidden md:table-cell">Example</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((column) => (
            <TableRow key={column.key}>
              <TableCell className="align-top">
                <code className="text-xs font-semibold">{column.label}</code>
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">{column.rule}</TableCell>
              <TableCell className="align-top hidden md:table-cell">
                <span className="text-xs font-mono text-muted-foreground">
                  {column.example || "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
