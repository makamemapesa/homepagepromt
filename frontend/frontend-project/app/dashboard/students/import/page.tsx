"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/contexts/user-context"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, ArrowLeft, UploadCloud, FileText, CheckCircle2, XCircle } from "lucide-react"
import { api } from "@/lib/api-client"

export default function ImportStudentsPage() {
  const { user, loading: authLoading } = useUser()
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [results, setResults] = useState<{ created: number; errors: any[] } | null>(null)

  useEffect(() => {
    if (!authLoading && user && user.role !== "super_admin") {
      router.replace("/dashboard")
    }
  }, [user, authLoading, router])

  if (authLoading || !user) {
    return null
  }

  if (user.role !== "super_admin") {
    return null
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
    setStatusMessage(null)
    setErrorMessage(null)
    setResults(null)
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage("Please choose a CSV or XLSX file before importing.")
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setStatusMessage(null)
    setResults(null)

    try {
      const form = new FormData()
      form.append("file", selectedFile)
      const response = await api.post("/api/students/import-students/", form)
      setResults(response.data)
      setStatusMessage("Import completed.")
    } catch (error: any) {
      const data = error?.response?.data
      if (data?.detail) {
        setErrorMessage(data.detail)
      } else {
        setErrorMessage("Import failed. Please verify the file format and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Import Students"
        description="Upload a CSV or Excel file to create student records in bulk."
      />

      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Bulk Student Import</h2>
            <p className="text-sm text-muted-foreground">Only Super Admins can upload student batches.</p>
          </div>
          <Link href="/dashboard/students">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Student List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload File</CardTitle>
            <CardDescription>Supported formats: .csv, .xlsx</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-[0.9fr_0.1fr]">
              <div>
                <Label htmlFor="student-import-file">Select a student upload file</Label>
                <Input
                  id="student-import-file"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                />
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!selectedFile || submitting}
                >
                  {submitting ? "Importing..." : "Upload"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4 bg-background">
                <div className="flex items-start gap-3">
                  <UploadCloud className="mt-1 h-5 w-5 text-accent" />
                  <div>
                    <p className="text-sm font-semibold">How to prepare your file</p>
                    <p className="text-sm text-muted-foreground">
                      Include columns such as reg_no, first_name, last_name, date_of_birth,
                      gender, admission_date, academic_session, student_class, student_type.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 bg-background">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-5 w-5 text-foreground" />
                  <div>
                    <p className="text-sm font-semibold">Optional parent fields</p>
                    <p className="text-sm text-muted-foreground">
                      parent_name, parent_phone, relationship, parent_email, occupation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {statusMessage && (
              <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                  <div>{statusMessage}</div>
                </div>
              </div>
            )}
            {errorMessage && (
              <div className="rounded-xl border border-destructive-300/70 bg-destructive-50 p-4 text-sm text-destructive-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <div>{errorMessage}</div>
                </div>
              </div>
            )}

            {results && (
              <div className="rounded-xl border border-border p-4 bg-background">
                <p className="text-sm font-semibold">Import summary</p>
                <p className="mt-2 text-sm text-muted-foreground">Created: {results.created}</p>
                {results.errors.length > 0 && (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium">Rows with issues:</p>
                    <ul className="list-disc pl-5">
                      {results.errors.slice(0, 5).map((item, index) => (
                        <li key={index}>
                          Row {item.row}: {typeof item.errors === "string" ? item.errors : JSON.stringify(item.errors)}
                        </li>
                      ))}
                    </ul>
                    {results.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground">And {results.errors.length - 5} more...</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
          <p className="font-semibold">Upload requirements</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>CSV or Excel files only.</li>
            <li>Columns should be named using underscores or spaces.</li>
            <li>Required fields: reg_no, first_name, last_name, date_of_birth, gender, admission_date.</li>
          </ul>
        </div>
      </div>
    </>
  )
}
