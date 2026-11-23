"use client"

import * as React from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TimesheetService, type TimesheetImportResult } from "@/lib/attendance/timesheet.service"
import { useT } from "@/lib/i18n"
import { saveBlob } from "@/lib/pos/pos.service"

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Import of timesheet entries (attendance-service POST /timesheets/import, ATTENDANCE_MANAGE): CSV or .xlsx, at most
 * 2000 rows and 5 MB (ATT_013 unreadable, ATT_014 too many rows, ATT_016 too large). Columns Employee (exact full
 * name, Employee Code or No), Date, Hours, Project, Description; every row becomes a PENDING entry, rows with errors
 * are listed and skipped.
 */
export function TimesheetImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const t = useT()
  const input = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File>()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [result, setResult] = React.useState<TimesheetImportResult>()

  function reset() {
    setFile(undefined)
    setError(undefined)
    setResult(undefined)
    if (input.current) input.current.value = ""
  }

  async function template() {
    try {
      saveBlob(await TimesheetService.importTemplate(), "timesheet-import-template.xlsx")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function submit() {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError(t("timesheet.import.tooLarge"))
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const r = await TimesheetService.importFile(file)
      setResult(r)
      if ((r.created ?? 0) > 0) onImported()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("timesheet.import.title")}</DialogTitle>
          <DialogDescription>{t("timesheet.import.desc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Button type="button" variant="outline" size="sm" onClick={template}>
              <Download className="size-4" /> {t("timesheet.import.template")}
            </Button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label={t("timesheet.import.file")}
            className="file:bg-muted text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5"
            onChange={(e) => {
              setFile(e.target.files?.[0])
              setResult(undefined)
              setError(undefined)
            }}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && (
            <div className="grid gap-2" data-testid="timesheet-import-result">
              <p className="text-sm font-medium">{t("timesheet.import.result", { created: result.created ?? 0, total: result.total ?? 0 })}</p>
              {!!result.errors?.length && (
                <div className="max-h-60 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">{t("timesheet.import.row")}</TableHead>
                        <TableHead>{t("timesheet.import.error")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((e, i) => (
                        <TableRow key={`${e.row}-${i}`}>
                          <TableCell>{e.row}</TableCell>
                          <TableCell className="text-sm">
                            {e.message ?? "-"}
                            {e.code && <span className="text-muted-foreground ml-1 font-mono text-xs">{e.code}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            {t("timesheet.import.close")}
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            <Upload className="size-4" /> {t("timesheet.import.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
