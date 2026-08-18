'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  History,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { H } from '@/lib/honey'
import { useToast } from '@/components/ui/Toast'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import {
  parseTimetableBuffer,
  validateTimetableRows,
  TimetableRowRaw,
  ValidationResult,
} from '@/lib/timetableImportService'

export default function AdminTimetableImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [academicYear, setAcademicYear] = useState<string>('2026')
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  // Validation data
  const [parsedRows, setParsedRows] = useState<TimetableRowRaw[]>([])
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [importLogs, setImportLogs] = useState<any[]>([])

  // Pagination for preview table
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 50

  const [modal, setModal] = useState<ConfirmModalState | null>(null)
  const { showToast } = useToast()
  const supabase = createClient()
  const router = useRouter()

  // Load profiles, classes & import history
  const loadInitialData = useCallback(async () => {
    try {
      const { data: logs } = await supabase
        .from('timetable_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      setImportLogs(logs || [])
    } catch (err: any) {
      console.error('[AdminTimetableImportPage] load error:', err)
    }
  }, [supabase])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Handle file drop / upload selection
  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile) return

    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast('File exceeds 5MB maximum limit.', 'error')
      return
    }

    setFile(selectedFile)
    setParsing(true)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const parseRes = parseTimetableBuffer(Buffer.from(arrayBuffer))

      if (parseRes.parseError) {
        showToast(parseRes.parseError, 'error')
        setParsing(false)
        return
      }

      setParsedRows(parseRes.rows)

      // Fetch profiles & classes for validation
      const [{ data: profiles }, { data: classes }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').eq('role', 'teacher').eq('is_active', true),
        supabase.from('classes').select('id, name, slug').eq('is_active', true),
      ])

      const valResult = validateTimetableRows(parseRes.rows, profiles || [], classes || [])
      setValidationResult(valResult)
      setStep(2)
    } catch (err: any) {
      showToast(`Error parsing file: ${err?.message || 'Invalid file format'}`, 'error')
    } finally {
      setParsing(false)
    }
  }

  // Generate official sample Excel template download
  const handleDownloadSampleTemplate = () => {
    const sampleCsv = `Class,Teacher,Subject,Day,Period,Room,Color\nGrade 10-A,K. Perera,Mathematics,Monday,1,Room 101,#F59E0B\nGrade 10-A,S. Silva,Science,Monday,2,Lab 1,#10B981\nGrade 10-B,M. Fernando,English,Monday,1,Room 102,#3B82F6\nGrade 10-B,K. Perera,Mathematics,Monday,2,Room 102,#F59E0B\nGrade 11-A,N. Jayawardena,History,Tuesday,1,Room 201,#8B5CF6\nGrade 11-A,S. Silva,Science,Tuesday,2,Lab 1,#10B981`

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sample_timetable_import_${academicYear}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Downloaded official sample timetable template', 'success')
  }

  // Execute Batch Import via API
  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      showToast('No valid rows available for import.', 'error')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/admin/timetable/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYear,
          fileName: file?.name || 'timetable_import.csv',
          replaceExisting,
          rows: validationResult.validRows,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Timetable import failed.')
      }

      showToast(`Successfully imported ${json.importedCount} schedule slots for ${academicYear}!`, 'success')
      setStep(3)
      loadInitialData()
    } catch (err: any) {
      showToast(err.message || 'Error executing import', 'error')
    } finally {
      setImporting(false)
    }
  }

  // Pagination bounds
  const totalPages = Math.ceil(parsedRows.length / rowsPerPage) || 1
  const paginatedRows = parsedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 32px)', backgroundColor: H.bg, minHeight: '100vh', fontFamily: H.font }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Link href="/admin/timetable" style={{ color: H.textSec, textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Back to Timetables
            </Link>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={26} style={{ color: H.purple }} />
            Yearly Timetable Import System
          </h1>
          <p style={{ fontSize: '14px', color: H.textSec, margin: '4px 0 0' }}>
            Upload Excel or CSV timetable files, validate double-bookings, and scope schedule slots to academic years.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleDownloadSampleTemplate}
            style={{
              height: H.targetSizes.buttonMd,
              padding: '0 14px',
              borderRadius: H.radius.lg,
              border: `1px solid ${H.border}`,
              backgroundColor: H.surface,
              color: H.textPrimary,
              fontWeight: 600,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            Download Official Template
          </button>
        </div>
      </div>

      {/* Progress Wizard Header */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: step >= 1 ? 1 : 0.4 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: step >= 1 ? '#18181B' : H.border, color: '#FFF', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>1</div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: H.textPrimary }}>Upload & Settings</span>
        </div>
        <div style={{ width: '60px', height: '2px', background: step >= 2 ? '#18181B' : H.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: step >= 2 ? 1 : 0.4 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: step >= 2 ? '#18181B' : H.border, color: '#FFF', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>2</div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: H.textPrimary }}>Validation & Conflict Preview</span>
        </div>
        <div style={{ width: '60px', height: '2px', background: step >= 3 ? '#18181B' : H.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: step >= 3 ? 1 : 0.4 }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: step === 3 ? H.grass : H.border, color: '#FFF', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>3</div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: H.textPrimary }}>Import Complete</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD & SETTINGS */}
      {step === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Dropzone Card */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '28px', boxShadow: H.shadows.card }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: H.textPrimary, margin: '0 0 16px' }}>Select Timetable File & Academic Year</h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Target Academic Year</label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, fontSize: '14px', backgroundColor: H.bg, color: H.textPrimary, fontWeight: 700 }}
              >
                <option value="2026">Academic Year 2026</option>
                <option value="2027">Academic Year 2027</option>
                <option value="2025">Academic Year 2025 (Archive)</option>
              </select>
            </div>

            {/* Drag & Drop Area */}
            <div
              style={{
                border: `2px dashed ${H.border}`,
                borderRadius: H.radius.xl,
                backgroundColor: '#F4F4F5',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <input
                id="fileInput"
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
              />
              <Upload size={38} style={{ color: '#18181B', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 700, color: H.textPrimary }}>
                {parsing ? 'Parsing & Validating File...' : 'Click to Upload or Drag Excel / CSV File'}
              </div>
              <div style={{ fontSize: '12px', color: H.textSec, marginTop: '4px' }}>
                Supports .xlsx, .xls, and .csv files (Max file size: 5MB, Max 1,000 rows)
              </div>
            </div>
          </div>

          {/* Import History Side Card */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '24px', boxShadow: H.shadows.card }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: H.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} style={{ color: H.skyBlue }} />
              Recent Timetable Imports
            </h3>

            {importLogs.length === 0 ? (
              <p style={{ fontSize: '13px', color: H.textSec }}>No timetable imports recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {importLogs.map(log => (
                  <div key={log.id} style={{ padding: '12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, backgroundColor: H.bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary }}>{log.file_name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '99px', backgroundColor: log.status === 'completed' ? '#D1FAE5' : '#FEF2F2', color: log.status === 'completed' ? '#059669' : '#DC2626' }}>
                        {log.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: H.textSec, marginTop: '4px' }}>
                      Year: {log.academic_year} | {log.successful_rows} rows imported | {new Date(log.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: VALIDATION & CONFLICT PREVIEW */}
      {step === 2 && validationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary Stat Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.lg, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: H.textPrimary }}>{validationResult.totalRows}</div>
              <div style={{ fontSize: '12px', color: H.textSec, fontWeight: 600 }}>Total File Rows</div>
            </div>

            <div style={{ backgroundColor: '#ECFDF5', border: `1px solid #A7F3D0`, borderRadius: H.radius.lg, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669' }}>{validationResult.validRows.length}</div>
              <div style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>Valid Slots Ready</div>
            </div>

            <div style={{ backgroundColor: '#FEF2F2', border: `1px solid #FCA5A5`, borderRadius: H.radius.lg, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#DC2626' }}>{validationResult.errors.length}</div>
              <div style={{ fontSize: '12px', color: '#B91C1C', fontWeight: 600 }}>Conflict Errors</div>
            </div>

            <div style={{ backgroundColor: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: H.radius.lg, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#D97706' }}>{validationResult.warnings.length}</div>
              <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 600 }}>Warnings</div>
            </div>
          </div>

          {/* Validation Errors & Conflicts Container */}
          {validationResult.errors.length > 0 && (
            <div style={{ backgroundColor: '#FEF2F2', border: `1px solid #FCA5A5`, borderRadius: H.radius.xl, padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#991B1B', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} /> Row-by-Row Conflict & Error Report ({validationResult.errors.length})
              </h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {validationResult.errors.map((err, idx) => (
                  <div key={idx} style={{ fontSize: '13px', color: '#7F1D1D', fontWeight: 600, backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: H.radius.md, border: `1px solid #FECACA` }}>
                    <strong>Row {err.rowNumber}</strong> [{err.column}]: {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Replacement Warning Checkbox */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 700, color: H.textPrimary, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={e => setReplaceExisting(e.target.checked)}
              />
              Replace & Archive Existing Timetable for Academic Year {academicYear}
            </label>
            <div style={{ fontSize: '12px', color: H.textSec, marginTop: '4px', paddingLeft: '24px' }}>
              Checking this will archive pre-existing timetable assignments for year {academicYear} into snapshot storage before inserting the new schedule.
            </div>
          </div>

          {/* Paginated Row Preview Table */}
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: H.textPrimary, margin: 0 }}>
                Parsed File Preview (Page {currentPage} of {totalPages})
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.bg, cursor: 'pointer' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.bg, cursor: 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: H.bg, borderBottom: `1px solid ${H.border}`, fontSize: '11px', fontWeight: 800, color: H.textMuted, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 16px' }}>Row</th>
                  <th style={{ padding: '10px 16px' }}>Class</th>
                  <th style={{ padding: '10px 16px' }}>Teacher</th>
                  <th style={{ padding: '10px 16px' }}>Subject</th>
                  <th style={{ padding: '10px 16px' }}>Day</th>
                  <th style={{ padding: '10px 16px' }}>Period</th>
                  <th style={{ padding: '10px 16px' }}>Room</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(r => (
                  <tr key={r.rowNumber} style={{ borderBottom: `1px solid ${H.border}` }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: H.textMuted }}>#{r.rowNumber}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: H.textPrimary }}>{r.className}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: H.textPrimary }}>{r.teacherName}</td>
                    <td style={{ padding: '10px 16px' }}>{r.subject}</td>
                    <td style={{ padding: '10px 16px' }}>Day {r.day}</td>
                    <td style={{ padding: '10px 16px' }}>Period {r.period}</td>
                    <td style={{ padding: '10px 16px', color: H.textMuted }}>{r.room || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setStep(1)}
              style={{ padding: '10px 20px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.surface, color: H.textSec, fontWeight: 600, cursor: 'pointer' }}
            >
              Choose Different File
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={importing || validationResult.validRows.length === 0}
              style={{ padding: '12px 24px', borderRadius: H.radius.md, background: '#18181B', color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {importing ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing Import...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirm & Import {validationResult.validRows.length} Valid Slots
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: IMPORT COMPLETE */}
      {step === 3 && (
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '40px', textAlign: 'center', maxWidth: '560px', margin: '0 auto', boxShadow: H.shadows.card }}>
          <CheckCircle2 size={56} style={{ color: H.grass, margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: H.textPrimary, margin: '0 0 8px' }}>
            Timetable Import Complete!
          </h2>
          <p style={{ fontSize: '14px', color: H.textSec, margin: '0 0 24px' }}>
            The timetable for Academic Year <strong>{academicYear}</strong> has been successfully imported into the system database.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link
              href="/admin/timetable"
              style={{ padding: '12px 24px', borderRadius: H.radius.md, background: '#18181B', color: '#FFFFFF', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}
            >
              View Active Timetable
            </Link>
            <button
              onClick={() => { setStep(1); setFile(null); }}
              style={{ padding: '12px 24px', borderRadius: H.radius.md, border: `1px solid ${H.border}`, background: H.surface, color: H.textPrimary, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
