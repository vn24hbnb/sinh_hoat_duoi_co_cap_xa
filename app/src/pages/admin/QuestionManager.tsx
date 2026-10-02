import React, { useState, useEffect, useRef, useCallback } from 'react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { PortalHeader } from '../../components/layout/PortalHeader'
import { RedNavigationBar } from '../../components/layout/RedNavigationBar'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { AlertMessage } from '../../components/ui/AlertMessage'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { examService } from '../../services/examService'
import { tenantService } from '../../services/tenantService'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { BookOpen, Plus, Trash2, Upload, Clipboard, FileText, CheckCircle, X, ChevronRight, HelpCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

interface QuestionBank {
  id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
}

interface Question {
  id: string
  question_bank_id: string
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
  explanation: string
}

interface ParsedQuestion {
  content: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: string
  explanation: string
}

export const QuestionManager: React.FC = () => {
  const { user, organizationId } = useAuth()
  const bankRequestSequenceRef = useRef(0)
  const questionRequestSequenceRef = useRef(0)
  const loadedOrganizationIdRef = useRef<string | null>(null)
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null)
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [selectedBank, setSelectedBank] = useState<QuestionBank | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  
  const [loading, setLoading] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Modal/Form states
  const [showCreateBankModal, setShowCreateBankModal] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newBankDesc, setNewBankDesc] = useState('')
  
  const [activeTab, setActiveTab] = useState<'list' | 'add_single' | 'upload_file' | 'paste_excel'>('list')
  
  // Form add single question
  const [qContent, setQContent] = useState('')
  const [qOptionA, setQOptionA] = useState('')
  const [qOptionB, setQOptionB] = useState('')
  const [qOptionC, setQOptionC] = useState('')
  const [qOptionD, setQOptionD] = useState('')
  const [qCorrect, setQCorrect] = useState('A')
  const [qExplanation, setQExplanation] = useState('')
  
  // Form paste text
  const [pasteText, setPasteText] = useState('')

  // Preview parsed questions from file upload
  const [previewQuestions, setPreviewQuestions] = useState<ParsedQuestion[]>([])
  const [fileName, setFileName] = useState('')

  const loadBanks = useCallback(async (selectFirst = false) => {
    const requestId = ++bankRequestSequenceRef.current
    const isCurrentRequest = () => requestId === bankRequestSequenceRef.current && tenantService.getOrganizationId() === organizationId
    await Promise.resolve()
    if (!isCurrentRequest()) return
    const organizationChanged = loadedOrganizationIdRef.current !== organizationId
    if (organizationChanged) {
      setBanks([])
      setSelectedBank(null)
      setQuestions([])
      setLoadingQuestions(false)
    }
    setLoading(true)
    if (!organizationId) {
      loadedOrganizationIdRef.current = null
      setLoadedOrganizationId(null)
      setLoading(false)
      return
    }
    try {
      const data = await examService.getQuestionBanks()
      if (!isCurrentRequest()) return
      setBanks(data)
      if (selectFirst) {
        setSelectedBank(data[0] || null)
      }
      loadedOrganizationIdRef.current = organizationId
      setLoadedOrganizationId(organizationId)
    } catch (err: any) {
      if (!isCurrentRequest()) return
      setError('Không thể tải danh sách bộ đề: ' + err.message)
      if (organizationChanged) {
        loadedOrganizationIdRef.current = organizationId
        setLoadedOrganizationId(organizationId)
      }
    } finally {
      if (isCurrentRequest()) setLoading(false)
    }
  }, [organizationId])

  const loadQuestions = useCallback(async (bankId: string) => {
    const requestId = ++questionRequestSequenceRef.current
    const isCurrentRequest = () => requestId === questionRequestSequenceRef.current && tenantService.getOrganizationId() === organizationId
    setLoadingQuestions(true)
    try {
      const data = await examService.getQuestions(bankId)
      if (!isCurrentRequest()) return
      setQuestions(data)
    } catch (err: any) {
      if (!isCurrentRequest()) return
      setError('Không thể tải danh sách câu hỏi: ' + err.message)
    } finally {
      if (isCurrentRequest()) setLoadingQuestions(false)
    }
  }, [organizationId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBanks(true) }, 0)
    return () => {
      window.clearTimeout(timer)
      bankRequestSequenceRef.current += 1
      questionRequestSequenceRef.current += 1
    }
  }, [loadBanks])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedBank) {
        void loadQuestions(selectedBank.id)
        setActiveTab('list')
        setPreviewQuestions([])
        setFileName('')
      } else {
        setQuestions([])
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedBank, loadQuestions])

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBankName.trim()) {
      setError('Vui lòng điền tên bộ đề.')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const newBank = await examService.createQuestionBank(newBankName, newBankDesc)
      setSuccess(`Tạo bộ đề "${newBank.name}" thành công!`)
      setNewBankName('')
      setNewBankDesc('')
      setShowCreateBankModal(false)
      await loadBanks()
      setSelectedBank(newBank)

      // Ghi audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          organization_id: tenantService.requireOrganizationId(),
          actor_id: user.id,
          action: 'CREATE_QUESTION_BANK',
          target_type: 'question_banks',
          target_id: newBank.id,
          metadata: { name: newBank.name }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo bộ đề mới.')
      setLoading(false)
    }
  }

  const handleDeleteBank = async (bankId: string, bankName: string) => {
    const confirm = window.confirm(`Đồng chí có chắc chắn muốn xóa bộ đề "${bankName}" cùng toàn bộ câu hỏi bên trong không?`)
    if (!confirm) return

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      // 1. Xóa các liên kết bộ đề trong meeting_exam_banks trước để tránh vi phạm khóa ngoại
      await supabase.from('meeting_exam_banks').delete().eq('question_bank_id', bankId)
      
      // 2. Xóa các câu hỏi của bộ đề
      await supabase.from('questions').delete().eq('question_bank_id', bankId)
      
      // 3. Xóa bộ đề
      const { error: delError } = await supabase.from('question_banks').delete().eq('id', bankId)
      if (delError) throw delError

      setSuccess(`Đã xóa bộ đề "${bankName}" thành công.`)
      setSelectedBank(null)
      await loadBanks(true)

      // Ghi audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          organization_id: tenantService.requireOrganizationId(),
          actor_id: user.id,
          action: 'DELETE_QUESTION_BANK',
          target_type: 'question_banks',
          target_id: bankId,
          metadata: { name: bankName }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }
    } catch (err: any) {
      setError('Không thể xóa bộ đề: ' + err.message)
      setLoading(false)
    }
  }

  const handleAddSingleQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBank) return
    if (!qContent.trim() || !qOptionA.trim() || !qOptionB.trim() || !qOptionC.trim() || !qOptionD.trim()) {
      setError('Vui lòng điền đầy đủ nội dung câu hỏi và 4 đáp án.')
      return
    }

    setLoadingQuestions(true)
    setError('')
    setSuccess('')
    try {
      const newQuestion = await examService.createQuestion(
        selectedBank.id,
        qContent,
        qOptionA,
        qOptionB,
        qOptionC,
        qOptionD,
        qCorrect,
        qExplanation
      )
      setSuccess('Thêm câu hỏi mới thành công!')

      // Ghi audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          organization_id: tenantService.requireOrganizationId(),
          actor_id: user.id,
          action: 'CREATE_QUESTION',
          target_type: 'questions',
          target_id: newQuestion.id,
          metadata: { bankId: selectedBank.id, content: qContent.substring(0, 100) }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }

      // Reset form
      setQContent('')
      setQOptionA('')
      setQOptionB('')
      setQOptionC('')
      setQOptionD('')
      setQCorrect('A')
      setQExplanation('')
      
      // Reload
      await loadQuestions(selectedBank.id)
      setActiveTab('list')
    } catch (err: any) {
      setError(err.message || 'Không thể thêm câu hỏi.')
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handlePasteImport = async () => {
    if (!selectedBank) return
    if (!pasteText.trim()) {
      setError('Vui lòng dán nội dung từ Excel/Word.')
      return
    }

    setLoadingQuestions(true)
    setError('')
    setSuccess('')
    try {
      const count = await examService.importQuestionsFromCSV(selectedBank.id, pasteText)
      setSuccess(`Nhập thành công ${count} câu hỏi từ nội dung dán!`);
      
      // Ghi audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          organization_id: tenantService.requireOrganizationId(),
          actor_id: user.id,
          action: 'IMPORT_QUESTIONS',
          target_type: 'question_banks',
          target_id: selectedBank.id,
          metadata: { count }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }

      setPasteText('')
      await loadQuestions(selectedBank.id)
      setActiveTab('list')
    } catch (err: any) {
      setError('Nhập câu hỏi thất bại: ' + err.message)
    } finally {
      setLoadingQuestions(false)
    }
  }

  // XỬ LÝ ĐỌC FILE TỪ MÁY TÍNH / ĐIỆN THOẠI (Excel, Word, CSV)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedBank || !e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    setFileName(file.name)
    setError('')
    setSuccess('')
    setPreviewQuestions([])
    setLoadingQuestions(true)

    const fileExt = file.name.split('.').pop()?.toLowerCase()

    // Hàm làm sạch tiền tố A:, B:, C:, D: ở các phương án
    const cleanPrefix = (str: string, prefix: string) => {
      const trimmed = str.trim()
      const regex = new RegExp(`^${prefix}\\s*[:.]\\s*`, 'i')
      return trimmed.replace(regex, '').trim()
    }

    try {
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        // ĐỌC FILE EXCEL (.xlsx, .xls)
        const reader = new FileReader()
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer)
            const workbook = XLSX.read(data, { type: 'array' })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            
            // Chuyển worksheet thành dạng array of arrays
            const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
            const parsed: ParsedQuestion[] = []

            for (let i = 0; i < rawRows.length; i++) {
              const row = rawRows[i]
              if (!row || row.length < 6) continue

              let content = ''
              let optionA = ''
              let optionB = ''
              let optionC = ''
              let optionD = ''
              let correctOption = ''
              let explanation = ''

              // Giá trị ở các cột có khả năng là đáp án đúng (A, B, C, D)
              const valIndex5 = String(row[5] || '').trim().toUpperCase()
              const valIndex6 = String(row[6] || '').trim().toUpperCase()

              // Nhận diện kết cấu:
              // Nếu cột thứ 7 (chỉ số 6) là A/B/C/D -> Cấu trúc 8 cột (Câu số, Câu hỏi, A, B, C, D, Đáp án, Giải thích)
              if (row.length >= 7 && ['A', 'B', 'C', 'D'].includes(valIndex6)) {
                content = String(row[1] || '').trim()
                optionA = String(row[2] || '').trim()
                optionB = String(row[3] || '').trim()
                optionC = String(row[4] || '').trim()
                optionD = String(row[5] || '').trim()
                correctOption = valIndex6
                explanation = row.length >= 8 ? String(row[7] || '').trim() : ''
              } 
              // Ngược lại, nếu cột thứ 6 (chỉ số 5) là A/B/C/D -> Cấu trúc 6-7 cột (Câu hỏi, A, B, C, D, Đáp án, Giải thích)
              else if (['A', 'B', 'C', 'D'].includes(valIndex5)) {
                content = String(row[0] || '').trim()
                optionA = String(row[1] || '').trim()
                optionB = String(row[2] || '').trim()
                optionC = String(row[3] || '').trim()
                optionD = String(row[4] || '').trim()
                correctOption = valIndex5
                explanation = row.length >= 7 ? String(row[6] || '').trim() : ''
              } else {
                continue
              }

              // Bỏ qua dòng tiêu đề cột
              if (['CÂU HỎI', 'CONTENT', 'NỘI DUNG', 'CÂU SỐ'].includes(content.toUpperCase())) continue
              if (!content || !optionA || !optionB || !optionC || !optionD) continue

              // Làm sạch tiền tố A:, B:, C:, D:
              optionA = cleanPrefix(optionA, 'A')
              optionB = cleanPrefix(optionB, 'B')
              optionC = cleanPrefix(optionC, 'C')
              optionD = cleanPrefix(optionD, 'D')

              parsed.push({ content, optionA, optionB, optionC, optionD, correctOption, explanation })
            }

            if (parsed.length === 0) {
              setError('Không tìm thấy câu hỏi hợp lệ nào trong file Excel. Vui lòng kiểm tra lại cấu trúc cột mẫu.')
            } else {
              setPreviewQuestions(parsed)
            }
          } catch (err: any) {
            setError('Lỗi khi phân tích file Excel: ' + err.message)
          } finally {
            setLoadingQuestions(false)
          }
        }
        reader.readAsArrayBuffer(file)

      } else if (fileExt === 'docx') {
        // ĐỌC FILE WORD (.docx)
        const reader = new FileReader()
        reader.onload = async (evt) => {
          try {
            const arrayBuffer = evt.target?.result as ArrayBuffer
            const result = await mammoth.convertToHtml({ arrayBuffer })
            const html = result.value

            const domParser = new DOMParser()
            const doc = domParser.parseFromString(html, 'text/html')
            const trs = doc.querySelectorAll('tr')
            const parsed: ParsedQuestion[] = []

            trs.forEach((tr) => {
              const tds = tr.querySelectorAll('td')
              if (tds.length < 6) return

              let content = ''
              let optionA = ''
              let optionB = ''
              let optionC = ''
              let optionD = ''
              let correctOption = ''
              let explanation = ''

              const valIndex5 = tds[5]?.textContent?.trim().toUpperCase() || ''
              const valIndex6 = tds[6]?.textContent?.trim().toUpperCase() || ''

              if (tds.length >= 7 && ['A', 'B', 'C', 'D'].includes(valIndex6)) {
                content = tds[1].textContent?.trim() || ''
                optionA = tds[2].textContent?.trim() || ''
                optionB = tds[3].textContent?.trim() || ''
                optionC = tds[4].textContent?.trim() || ''
                optionD = tds[5].textContent?.trim() || ''
                correctOption = valIndex6
                explanation = tds.length >= 8 ? tds[7].textContent?.trim() || '' : ''
              } else if (['A', 'B', 'C', 'D'].includes(valIndex5)) {
                content = tds[0].textContent?.trim() || ''
                optionA = tds[1].textContent?.trim() || ''
                optionB = tds[2].textContent?.trim() || ''
                optionC = tds[3].textContent?.trim() || ''
                optionD = tds[4].textContent?.trim() || ''
                correctOption = valIndex5
                explanation = tds.length >= 7 ? tds[6].textContent?.trim() || '' : ''
              } else {
                return
              }

              if (['CÂU HỎI', 'CONTENT', 'NỘI DUNG', 'CÂU SỐ'].includes(content.toUpperCase())) return
              if (!content || !optionA || !optionB || !optionC || !optionD) return

              optionA = cleanPrefix(optionA, 'A')
              optionB = cleanPrefix(optionB, 'B')
              optionC = cleanPrefix(optionC, 'C')
              optionD = cleanPrefix(optionD, 'D')

              parsed.push({ content, optionA, optionB, optionC, optionD, correctOption, explanation })
            })

            if (parsed.length === 0) {
              setError('Không tìm thấy bảng câu hỏi hợp lệ trong file Word. File Word cần chứa bảng có ít nhất 6 cột theo đúng mẫu.')
            } else {
              setPreviewQuestions(parsed)
            }
          } catch (err: any) {
            setError('Lỗi khi phân tích file Word: ' + err.message)
          } finally {
            setLoadingQuestions(false)
          }
        }
        reader.readAsArrayBuffer(file)

      } else if (fileExt === 'csv') {
        // ĐỌC FILE CSV (.csv)
        const reader = new FileReader()
        reader.onload = async (evt) => {
          try {
            const text = evt.target?.result as string
            const lines = text.split('\n')
            const parsed: ParsedQuestion[] = []

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim()
              if (!line) continue
              
              let parts: string[] = []
              if (line.includes('\t')) {
                parts = line.split('\t').map(p => p.trim())
              } else {
                const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || []
                parts = matches.map(p => p.replace(/^"|"$/g, '').trim())
              }
              
              if (parts.length < 6) {
                parts = line.split(',').map(p => p.trim())
              }
              
              if (parts.length < 6) continue

              let content = ''
              let optionA = ''
              let optionB = ''
              let optionC = ''
              let optionD = ''
              let correctOption = ''
              let explanation = ''

              const valIndex5 = String(parts[5] || '').trim().toUpperCase()
              const valIndex6 = String(parts[6] || '').trim().toUpperCase()

              if (parts.length >= 7 && ['A', 'B', 'C', 'D'].includes(valIndex6)) {
                content = String(parts[1] || '').trim()
                optionA = String(parts[2] || '').trim()
                optionB = String(parts[3] || '').trim()
                optionC = String(parts[4] || '').trim()
                optionD = String(parts[5] || '').trim()
                correctOption = valIndex6
                explanation = parts.length >= 8 ? String(parts[7] || '').trim() : ''
              } else if (['A', 'B', 'C', 'D'].includes(valIndex5)) {
                content = String(parts[0] || '').trim()
                optionA = String(parts[1] || '').trim()
                optionB = String(parts[2] || '').trim()
                optionC = String(parts[3] || '').trim()
                optionD = String(parts[4] || '').trim()
                correctOption = valIndex5
                explanation = parts.length >= 7 ? String(parts[6] || '').trim() : ''
              } else {
                continue
              }

              if (['CÂU HỎI', 'CONTENT', 'NỘI DUNG', 'CÂU SỐ'].includes(content.toUpperCase())) continue
              if (!content || !optionA || !optionB || !optionC || !optionD) continue

              optionA = cleanPrefix(optionA, 'A')
              optionB = cleanPrefix(optionB, 'B')
              optionC = cleanPrefix(optionC, 'C')
              optionD = cleanPrefix(optionD, 'D')

              parsed.push({ content, optionA, optionB, optionC, optionD, correctOption, explanation })
            }

            if (parsed.length === 0) {
              setError('Không tìm thấy dữ liệu hợp lệ trong file CSV.')
            } else {
              setPreviewQuestions(parsed)
            }
          } catch (err: any) {
            setError('Lỗi khi phân tích file CSV: ' + err.message)
          } finally {
            setLoadingQuestions(false)
          }
        }
        reader.readAsText(file, 'UTF-8')
      } else {
        setError('Định dạng file không được hỗ trợ. Vui lòng chọn file Excel (.xlsx, .xls), Word (.docx) hoặc CSV (.csv).')
        setLoadingQuestions(false)
      }
    } catch (err: any) {
      setError('Đọc file thất bại: ' + err.message)
      setLoadingQuestions(false)
    }

    // Reset input
    e.target.value = ''
  }


  // LƯU CÂU HỎI PREVIEW VÀO DATABASE
  const handleSavePreviewQuestions = async () => {
    if (!selectedBank || previewQuestions.length === 0) return

    setLoadingQuestions(true)
    setError('')
    setSuccess('')
    try {
      const payload = previewQuestions.map(q => ({
        // `questions.organization_id` is required and enforces tenant isolation in RLS.
        // The other import paths already populate this field; keep file imports consistent.
        organization_id: tenantService.requireOrganizationId(),
        question_bank_id: selectedBank.id,
        content: q.content,
        option_a: q.optionA,
        option_b: q.optionB,
        option_c: q.optionC,
        option_d: q.optionD,
        correct_option: q.correctOption,
        explanation: q.explanation,
        difficulty: 'medium',
        is_active: true
      }))

      const { error: insError } = await supabase
        .from('questions')
        .insert(payload)

      if (insError) throw insError

      // Ghi audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          organization_id: tenantService.requireOrganizationId(),
          actor_id: user.id,
          action: 'IMPORT_QUESTIONS',
          target_type: 'question_banks',
          target_id: selectedBank.id,
          metadata: { count: previewQuestions.length, method: 'file' }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }

      setSuccess(`Đã lưu thành công ${previewQuestions.length} câu hỏi từ file vào bộ đề!`)
      setPreviewQuestions([])
      setFileName('')
      await loadQuestions(selectedBank.id)
      setActiveTab('list')
    } catch (err: any) {
      setError('Không thể lưu câu hỏi vào cơ sở dữ liệu: ' + err.message)
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedBank) return
    const confirm = window.confirm('Đồng chí muốn xóa câu hỏi này?')
    if (!confirm) return

    setLoadingQuestions(true)
    try {
      const { error: delError } = await supabase.from('questions').delete().eq('id', qId)
      if (delError) throw delError
      
      // Ghi audit log
      if (user) {
        await supabase.from('audit_logs').insert({
          organization_id: tenantService.requireOrganizationId(),
          actor_id: user.id,
          action: 'DELETE_QUESTION',
          target_type: 'questions',
          target_id: qId,
          metadata: { bankId: selectedBank.id }
        }).then(() => {}, (err: any) => console.error('Lỗi ghi audit log:', err))
      }

      setSuccess('Đã xóa câu hỏi thành công.')
      await loadQuestions(selectedBank.id)
    } catch (err: any) {
      setError('Không thể xóa câu hỏi: ' + err.message)
    } finally {
      setLoadingQuestions(false)
    }
  }

  if (loading || loadedOrganizationId !== organizationId) {
    return <LoadingSpinner message="Đang tải dữ liệu Ngân hàng câu hỏi..." fullScreen />
  }

  return (
    <PatternBackground>
      <PortalHeader />
      <RedNavigationBar isAuthenticated={true} userRole="admin" />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-red-deep dark:text-gold normal-case tracking-normal">
              Ngân hàng đề thi trắc nghiệm
            </h1>
            <p className="text-xs font-semibold text-muted dark:text-muted mt-0.5">
              Tạo lập bộ đề thi chuyên đề và import câu hỏi trực tiếp từ file Excel/Word/CSV trên máy tính, điện thoại
            </p>
          </div>
          <RevolutionaryButton 
            onClick={() => setShowCreateBankModal(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={18} /> Tạo bộ đề mới
          </RevolutionaryButton>
        </div>

        {error && <AlertMessage type="error" message={error} className="mb-6 animate-fade-in" onDismiss={() => setError('')} />}
        {success && <AlertMessage type="success" message={success} className="mb-6 animate-fade-in" onDismiss={() => setSuccess('')} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI: DANH SÁCH BỘ ĐỀ */}
          <div className="lg:col-span-4 space-y-4">
            <GlassCard>
              <h3 className="text-xs font-bold text-brown-text dark:text-cream-light normal-case tracking-normal mb-3 pb-2 border-b border-red-revolution/10">
                Danh sách bộ đề thi ({banks.length})
              </h3>
              {banks.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted font-semibold">
                  Chưa có bộ đề thi nào. Hãy tạo bộ đề mới để bắt đầu.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {banks.map((b) => (
                    <div 
                      key={b.id}
                      onClick={() => setSelectedBank(b)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                        selectedBank?.id === b.id 
                          ? 'bg-red-revolution/10 border-red-revolution text-red-deep dark:text-gold' 
                          : 'bg-white/40 dark:bg-navy/20 border-slate-100 dark:border-slate-800 text-navy dark:text-white hover:bg-red-revolution/5'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-xs font-bold truncate">{b.name}</h4>
                        <p className="text-xs text-muted truncate font-medium mt-0.5">
                          {b.description || 'Không có mô tả'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteBank(b.id, b.name)
                          }}
                          className="p-1 text-muted hover:text-red-revolution rounded transition-colors"
                          title="Xóa bộ đề"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* CỘT PHẢI: CHI TIẾT VÀ QUẢN LÝ CÂU HỎI */}
          <div className="lg:col-span-8">
            {selectedBank ? (
              <GlassCard className="h-full flex flex-col">
                <div className="border-b border-red-revolution/10 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="bg-red-revolution/10 text-red-deep dark:text-gold text-xs px-2 py-0.5 rounded font-bold normal-case tracking-normal">
                      Bộ đề đang chọn
                    </span>
                    <h2 className="text-sm font-bold text-navy dark:text-white mt-1">
                      {selectedBank.name}
                    </h2>
                    {selectedBank.description && (
                      <p className="text-xs text-muted dark:text-muted font-semibold mt-0.5">
                        {selectedBank.description}
                      </p>
                    )}
                  </div>
                  <div className="text-xs font-bold text-brown-text dark:text-cream-light bg-slate-100 dark:bg-navy/40 px-3 py-1.5 rounded-lg shrink-0">
                    Sĩ số câu hỏi: {questions.length}
                  </div>
                </div>

                {/* Tabs điều hướng hành động */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 mb-4 text-xs font-bold">
                  <button 
                    onClick={() => setActiveTab('list')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                      activeTab === 'list' 
                        ? 'border-red-revolution text-red-revolution dark:text-gold' 
                        : 'border-transparent text-muted hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    <BookOpen size={14} /> Danh sách câu hỏi
                  </button>
                  <button 
                    onClick={() => setActiveTab('add_single')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                      activeTab === 'add_single' 
                        ? 'border-red-revolution text-red-revolution dark:text-gold' 
                        : 'border-transparent text-muted hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    <Plus size={14} /> Nhập lẻ câu hỏi
                  </button>
                  <button 
                    onClick={() => setActiveTab('upload_file')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                      activeTab === 'upload_file' 
                        ? 'border-red-revolution text-red-revolution dark:text-gold' 
                        : 'border-transparent text-muted hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    <Upload size={14} /> Tải file Excel/Word/CSV
                  </button>
                  <button 
                    onClick={() => setActiveTab('paste_excel')}
                    className={`py-2 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                      activeTab === 'paste_excel' 
                        ? 'border-red-revolution text-red-revolution dark:text-gold' 
                        : 'border-transparent text-muted hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    <Clipboard size={14} /> Dán nhanh bảng
                  </button>
                </div>

                {/* Nội dung chi tiết từng Tab */}
                <div className="flex-1">
                  
                  {/* TAB 1: DANH SÁCH CÂU HỎI */}
                  {activeTab === 'list' && (
                    <div className="space-y-4">
                      {loadingQuestions ? (
                        <div className="py-12 flex justify-center">
                          <LoadingSpinner message="Đang tải danh sách câu hỏi..." />
                        </div>
                      ) : questions.length === 0 ? (
                        <div className="text-center py-12 text-xs text-muted font-semibold bg-slate-50 dark:bg-navy/10 rounded-card border border-dashed border-slate-200 dark:border-slate-800">
                          Bộ đề này chưa có câu hỏi nào.
                          <div className="mt-3 flex justify-center gap-2">
                            <RevolutionaryButton onClick={() => setActiveTab('add_single')} variant="secondary" className="text-xs py-1.5 px-3">
                              Thêm câu hỏi lẻ
                            </RevolutionaryButton>
                            <RevolutionaryButton onClick={() => setActiveTab('upload_file')} className="text-xs py-1.5 px-3">
                              Tải file Excel/Word
                            </RevolutionaryButton>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                          {questions.map((q, idx) => (
                            <div key={q.id} className="p-3 bg-slate-50 dark:bg-navy/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-navy dark:text-white relative group">
                              <button 
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="absolute top-3 right-3 p-1 bg-white dark:bg-navy border border-slate-100 dark:border-slate-800 rounded text-muted hover:text-red-revolution hover:border-red-revolution/20 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Xóa câu hỏi"
                              >
                                <Trash2 size={12} />
                              </button>
                              
                              <div className="font-bold flex gap-1.5 items-start pr-6">
                                <span className="text-red-revolution dark:text-gold shrink-0">Câu {idx + 1}:</span>
                                <span className="leading-relaxed">{q.content}</span>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 font-medium pl-6 text-muted dark:text-muted">
                                <div className={q.correct_option === 'A' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                  A. {q.option_a}
                                </div>
                                <div className={q.correct_option === 'B' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                  B. {q.option_b}
                                </div>
                                <div className={q.correct_option === 'C' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                  C. {q.option_c}
                                </div>
                                <div className={q.correct_option === 'D' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                  D. {q.option_d}
                                </div>
                              </div>
                              
                              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 pl-6 flex flex-wrap gap-2 text-xs font-bold text-muted">
                                <span className="inline-flex items-center gap-1"><CheckCircle size={16} aria-hidden="true"/>Đáp án đúng: <b className="text-success text-xs bg-success-bg px-2 py-1 rounded">{q.correct_option}</b></span>
                                {q.explanation && (
                                  <span className="italic font-medium text-muted">
                                    - Giải thích: {q.explanation}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: NHẬP LẺ CÂU HỎI */}
                  {activeTab === 'add_single' && (
                    <form onSubmit={handleAddSingleQuestion} className="space-y-3 text-xs md:text-sm font-semibold">
                      <div>
                        <label className="block text-muted mb-1">Nội dung câu hỏi *</label>
                        <textarea
                          required
                          rows={2}
                          value={qContent}
                          onChange={(e) => setQContent(e.target.value)}
                          placeholder="Nhập nội dung câu hỏi..."
                          className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none focus:border-red-revolution font-bold resize-none"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-muted mb-1">Đáp án A *</label>
                          <input
                            type="text"
                            required
                            value={qOptionA}
                            onChange={(e) => setQOptionA(e.target.value)}
                            placeholder="Nhập đáp án A..."
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-muted mb-1">Đáp án B *</label>
                          <input
                            type="text"
                            required
                            value={qOptionB}
                            onChange={(e) => setQOptionB(e.target.value)}
                            placeholder="Nhập đáp án B..."
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-muted mb-1">Đáp án C *</label>
                          <input
                            type="text"
                            required
                            value={qOptionC}
                            onChange={(e) => setQOptionC(e.target.value)}
                            placeholder="Nhập đáp án C..."
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-muted mb-1">Đáp án D *</label>
                          <input
                            type="text"
                            required
                            value={qOptionD}
                            onChange={(e) => setQOptionD(e.target.value)}
                            placeholder="Nhập đáp án D..."
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-muted mb-1">Đáp án đúng *</label>
                          <select
                            value={qCorrect}
                            onChange={(e) => setQCorrect(e.target.value)}
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none font-bold"
                          >
                            <option value="A">Đáp án A</option>
                            <option value="B">Đáp án B</option>
                            <option value="C">Đáp án C</option>
                            <option value="D">Đáp án D</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-muted mb-1">Giải thích đáp án</label>
                          <input
                            type="text"
                            value={qExplanation}
                            onChange={(e) => setQExplanation(e.target.value)}
                            placeholder="Giải thích lý do chọn đáp án này..."
                            className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setActiveTab('list')}
                          className="px-4 py-2 text-xs font-bold text-muted border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          Hủy bỏ
                        </button>
                        <RevolutionaryButton type="submit">
                          Lưu câu hỏi
                        </RevolutionaryButton>
                      </div>
                    </form>
                  )}

                  {/* TAB 3: TẢI FILE TỪ MÁY TÍNH / ĐIỆN THOẠI (Excel, Word, CSV) */}
                  {activeTab === 'upload_file' && (
                    <div className="space-y-4 text-xs font-semibold text-navy dark:text-white">
                      
                      {/* Bảng hướng dẫn cấu trúc file */}
                      <div className="bg-slate-50 dark:bg-navy/35 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2">
                        <h4 className="font-bold text-red-deep dark:text-gold flex items-center gap-1 text-xs normal-case tracking-normal">
                          <FileText size={15} /> BIỂU MẪU CẤU TRÚC FILE IMPORT:
                        </h4>
                        <p className="text-xs text-muted font-medium">
                          File Excel hoặc Word cần chứa bảng thông tin gồm ít nhất 6 cột theo thứ tự bắt buộc:
                        </p>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-slate-200 dark:border-slate-700 text-xs text-left">
                            <thead>
                              <tr className="bg-red-revolution/5 text-red-deep dark:text-gold border-b border-slate-200 dark:border-slate-700 font-bold">
                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Cột 1 (Nội dung)</th>
                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Cột 2 (A)</th>
                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Cột 3 (B)</th>
                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Cột 4 (C)</th>
                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700">Cột 5 (D)</th>
                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 text-center">Cột 6 (Đúng)</th>
                                <th className="p-1.5">Cột 7 (Giải thích)</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-slate-100 dark:border-slate-800 font-medium">
                                <td className="p-1.5 border-r border-slate-200 dark:border-slate-700">Đảng Cộng sản VN thành lập năm nào?</td>
                                <td className="p-1.5 border-r border-slate-200 dark:border-slate-700">Năm 1930</td>
                                <td className="p-1.5 border-r border-slate-200 dark:border-slate-700">Năm 1945</td>
                                <td className="p-1.5 border-r border-slate-200 dark:border-slate-700">Năm 1954</td>
                                <td className="p-1.5 border-r border-slate-200 dark:border-slate-700">Năm 1975</td>
                                <td className="p-1.5 border-r border-slate-200 dark:border-slate-700 text-center text-emerald-600 font-bold">A</td>
                                <td className="p-1.5 text-muted">Ngày 3/2/1930</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-muted italic">
                          * Lưu ý: File Word (.docx) cần tổ chức dạng bảng biểu (Table). File Excel (.xlsx, .xls) bắt đầu từ Sheet đầu tiên. File CSV (.csv) mã hóa UTF-8.
                        </p>
                      </div>

                      {/* VÙNG UPLOAD CHỌN FILE */}
                      {previewQuestions.length === 0 ? (
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-card p-8 text-center bg-slate-50/50 dark:bg-navy/10 hover:bg-red-revolution/5 hover:border-red-revolution/30 transition-all cursor-pointer relative">
                          <input
                            type="file"
                            accept=".xlsx, .xls, .docx, .csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="w-12 h-12 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mx-auto mb-3">
                            <Upload size={24} />
                          </div>
                          <h4 className="text-xs font-bold text-navy dark:text-white mb-1">Click để tải file từ điện thoại / máy tính</h4>
                          <p className="text-xs text-muted font-semibold">Chấp nhận file Excel (.xlsx/.xls), Word (.docx) hoặc CSV (.csv)</p>
                        </div>
                      ) : (
                        /* MÀN HÌNH PREVIEW CÂU HỎI TRƯỚC KHI LƯU */
                        <div className="space-y-3 animate-fade-in">
                          <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl">
                            <div className="min-w-0">
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-bold">Xác nhận nạp file:</span>
                              <span className="text-xs font-bold text-navy dark:text-white truncate block">{fileName}</span>
                            </div>
                            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 shrink-0 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">
                              Đã đọc: {previewQuestions.length} câu hỏi
                            </div>
                          </div>

                          <div className="max-h-[220px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                            <table className="min-w-full text-xs text-left">
                              <thead className="bg-slate-100 dark:bg-navy/60 text-muted font-bold sticky top-0">
                                <tr>
                                  <th className="p-2 w-8 text-center">STT</th>
                                  <th className="p-2">Câu hỏi</th>
                                  <th className="p-2 w-8 text-center">Đúng</th>
                                  <th className="p-2">Giải thích</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewQuestions.map((q, index) => (
                                  <tr key={index} className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-navy/20">
                                    <td className="p-2 text-center text-muted font-bold">{index + 1}</td>
                                    <td className="p-2">
                                      <div className="font-bold text-navy dark:text-white">{q.content}</div>
                                      <div className="text-xs text-muted mt-0.5">
                                        A: {q.optionA} | B: {q.optionB} | C: {q.optionC} | D: {q.optionD}
                                      </div>
                                    </td>
                                    <td className="p-2 text-center text-emerald-600 font-bold">{q.correctOption}</td>
                                    <td className="p-2 text-muted italic text-xs truncate max-w-[150px]">{q.explanation || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewQuestions([])
                                setFileName('')
                              }}
                              className="px-3.5 py-2 text-xs font-bold text-muted border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50"
                            >
                              Hủy bỏ / Tải lại
                            </button>
                            <RevolutionaryButton 
                              onClick={handleSavePreviewQuestions}
                              loading={loadingQuestions}
                              className="flex items-center gap-1.5"
                            >
                              <CheckCircle size={15} /> Lưu tất cả vào bộ đề
                            </RevolutionaryButton>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: DÁN NHANH BẢNG */}
                  {activeTab === 'paste_excel' && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-3 rounded-xl border border-amber-200 text-xs font-medium leading-relaxed">
                        <p className="font-bold flex items-center gap-1.5 mb-1 text-xs">
                          <HelpCircle size={14} className="shrink-0" /> DÁN NHANH DỮ LIỆU COPY TỪ WORD / EXCEL:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 text-xs">
                          <li>Copy các dòng bảng dữ liệu trong Word hoặc Excel (gồm các cột Câu hỏi, A, B, C, D, Đáp án đúng, Giải thích).</li>
                          <li>Dán trực tiếp (Ctrl+V) vào khung text bên dưới rồi bấm Import.</li>
                        </ol>
                      </div>

                      <div>
                        <label className="block text-muted mb-1 text-xs font-bold">Dán dữ liệu bảng tại đây:</label>
                        <textarea
                          rows={6}
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder="Ví dụ:&#10;Câu hỏi một	Đáp án A	Đáp án B	Đáp án C	Đáp án D	A	Giải thích câu 1&#10;Câu hỏi hai	A	B	C	D	B"
                          className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white outline-none focus:border-red-revolution font-mono text-xs leading-normal resize-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setPasteText('')
                            setActiveTab('list')
                          }}
                          className="px-4 py-2 text-xs font-bold text-muted border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          Hủy bỏ
                        </button>
                        <RevolutionaryButton 
                          onClick={handlePasteImport}
                          disabled={!pasteText.trim()}
                        >
                          <CheckCircle size={14} className="mr-1" /> Đồng ý Import
                        </RevolutionaryButton>
                      </div>
                    </div>
                  )}

                </div>
              </GlassCard>
            ) : (
              <GlassCard className="text-center py-16 border border-dashed border-red-revolution/20 flex flex-col justify-center items-center h-full">
                <div className="w-14 h-14 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mb-4">
                  <BookOpen size={28} />
                </div>
                <h3 className="text-sm font-bold text-navy dark:text-white mb-1">Chưa chọn bộ đề thi</h3>
                <p className="text-xs text-muted max-w-sm mx-auto font-semibold">
                  Vui lòng chọn một bộ đề ở danh sách bên trái hoặc bấm tạo bộ đề thi mới để quản lý và thiết lập câu hỏi.
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      </main>

      {/* Modal tạo bộ đề mới */}
      {showCreateBankModal && (
        <div className="fixed inset-0 bg-navy/60 backdrop-blur-none flex items-center justify-center p-4 z-50 animate-fade-in">
          <GlassCard className="max-w-md w-full border border-red-revolution/20 shadow-sm relative">
            <button 
              onClick={() => setShowCreateBankModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-red-revolution transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 text-red-revolution dark:text-gold mb-6 border-b border-red-revolution/10 pb-3">
              <BookOpen size={20} />
              <h3 className="text-sm font-bold normal-case tracking-normal">Tạo bộ đề thi mới</h3>
            </div>

            <form onSubmit={handleCreateBank} className="space-y-4 text-xs md:text-sm font-semibold">
              <div>
                <label className="block text-muted mb-1">Tên bộ đề (Ngân hàng câu hỏi) *</label>
                <input
                  type="text"
                  required
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="Ví dụ: Chuyên đề Chào cờ Tháng 6/2026"
                  className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-bold outline-none focus:border-red-revolution"
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Mô tả bộ đề</label>
                <textarea
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                  placeholder="Ghi chú nội dung trọng tâm của bộ câu hỏi này..."
                  rows={3}
                  className="w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-navy/40 text-navy dark:text-white font-semibold outline-none focus:border-red-revolution resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBankModal(false)}
                  className="flex-1 py-3 text-xs font-bold normal-case rounded-xl border border-slate-200 dark:border-slate-800 text-muted hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <RevolutionaryButton type="submit" className="flex-1">
                  Đồng ý tạo <ChevronRight size={16} className="ml-1 inline" />
                </RevolutionaryButton>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </PatternBackground>
  )
}

export default QuestionManager
