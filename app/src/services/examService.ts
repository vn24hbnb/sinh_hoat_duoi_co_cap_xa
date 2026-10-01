import { tenantService } from './tenantService'
import { supabase } from './supabaseClient'

export interface MeetingExam {
  id: string
  meeting_session_id: string
  title: string
  duration_seconds: number
  score_scale: number
  questions_per_user: number
  status: 'draft' | 'open' | 'closed'
}

export interface ExamAttempt {
  id: string
  meeting_exam_id: string
  meeting_session_id: string
  member_id: string
  started_at: string
  submitted_at: string | null
  score: number | null
  correct_count: number | null
  total_questions: number | null
  duration_seconds: number | null
  status: 'started' | 'submitted' | 'expired' | 'cancelled'
  allow_retake: boolean
}

export interface ExamQuestion {
  id: string // questionId
  content: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  selectedOption: string | null
}

export const examService = {
  /**
   * Fetch the active open exam for a specific meeting session
   */
  async getActiveExam(meetingSessionId: string): Promise<MeetingExam | null> {
    const { data, error } = await supabase
      .from('meeting_exams')
      .select('*')
      .eq('organization_id', tenantService.requireOrganizationId())
      .eq('meeting_session_id', meetingSessionId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) {
      console.error('Error fetching active exam:', error.message)
      throw new Error('Không thể tải thông tin bài kiểm tra.')
    }

    return data as MeetingExam | null
  },

  // The server owns identity, question selection, deadline and grading.
  async getOrCreateAttempt(examId: string, _memberId: string, _meetingSessionId: string): Promise<{ attempt: ExamAttempt; questions: ExamQuestion[]; timeLeftSeconds: number }> {
    const { data, error } = await supabase.rpc('exam_start', { p_exam_id: examId })
    if (error) throw new Error(error.message)
    if (!data?.attempt || !Array.isArray(data.questions)) throw new Error('Dữ liệu bài thi không hợp lệ.')
    return data
  },

  async saveAnswer(attemptId: string, questionId: string, selectedOption: string): Promise<void> {
    const { error } = await supabase.rpc('exam_save_answer', {
      p_attempt_id: attemptId, p_question_id: questionId, p_selected_option: selectedOption
    })
    if (error) throw new Error(error.message)
  },

  async submitAttempt(attemptId: string): Promise<ExamAttempt> {
    const { data, error } = await supabase.rpc('exam_submit', { p_attempt_id: attemptId })
    if (error) throw new Error(error.message)
    return data as ExamAttempt
  },

  async getAttemptResult(attemptId: string) {
    const { data, error } = await supabase.rpc('exam_result', { p_attempt_id: attemptId })
    if (error) throw new Error(error.message)
    return data
  },

  /**
   * Fetch all active question banks
   */
  async getQuestionBanks(): Promise<any[]> {
    const { data, error } = await supabase
      .from('question_banks')
      .select('*')
      .eq('organization_id', tenantService.requireOrganizationId())
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching question banks:', error.message)
      throw new Error(error.message)
    }
    return data || []
  },

  /**
   * Create a new question bank
   */
  async createQuestionBank(name: string, description: string): Promise<any> {
    const { data, error } = await supabase
      .from('question_banks')
      .insert({ name, description, is_active: true, organization_id: tenantService.requireOrganizationId() })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating question bank:', error.message)
      throw new Error(`Tạo ngân hàng câu hỏi thất bại: ${error.message}`)
    }
    return data
  },

  /**
   * Fetch questions from a bank
   */
  async getQuestions(bankId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('question_bank_id', bankId)
      .eq('organization_id', tenantService.requireOrganizationId())
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching questions:', error.message)
      throw new Error(error.message)
    }
    return data || []
  },

  /**
   * Create a single question
   */
  async createQuestion(
    bankId: string,
    content: string,
    optionA: string,
    optionB: string,
    optionC: string,
    optionD: string,
    correctOption: string,
    explanation: string = ''
  ): Promise<any> {
    const { data, error } = await supabase
      .from('questions')
      .insert({
        organization_id: tenantService.requireOrganizationId(),
        question_bank_id: bankId,
        content,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_option: correctOption.toUpperCase(),
        explanation,
        difficulty: 'medium',
        is_active: true
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating question:', error.message)
      throw new Error(`Thêm câu hỏi thất bại: ${error.message}`)
    }
    return data
  },

  /**
   * Bulk import questions from CSV / Tab-separated text
   */
  async importQuestionsFromCSV(bankId: string, csvText: string): Promise<number> {
    const lines = csvText.split('\n')
    const questionsToInsert: any[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Support Tab (\t) or Comma (,) split
      let parts: string[] = []
      if (line.includes('\t')) {
        parts = line.split('\t').map(p => p.trim())
      } else {
        // Regex to parse comma-separated values correctly, handling double quotes
        const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || []
        parts = matches.map(p => p.replace(/^"|"$/g, '').trim())
      }
      
      if (parts.length < 6) {
        // Fallback simple comma split
        parts = line.split(',').map(p => p.trim())
      }
      
      if (parts.length < 6) continue
      
      const [content, optionA, optionB, optionC, optionD, correctOption, explanation = ''] = parts
      
      const correct = correctOption.toUpperCase().trim()
      if (!['A', 'B', 'C', 'D'].includes(correct)) continue
      
      questionsToInsert.push({
        organization_id: tenantService.requireOrganizationId(),
        question_bank_id: bankId,
        content,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        correct_option: correct,
        explanation,
        difficulty: 'medium',
        is_active: true
      })
    }
    
    if (questionsToInsert.length === 0) {
      throw new Error('Không tìm thấy câu hỏi hợp lệ nào. Định dạng chuẩn: Nội dung,Đáp án A,B,C,D,Đáp án đúng (A/B/C/D),Giải thích')
    }
    
    const { data, error } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id')
      
    if (error) {
      console.error('Error bulk inserting questions:', error.message)
      throw new Error(`Import câu hỏi thất bại: ${error.message}`)
    }
    
    return data?.length || 0
  },

  /**
   * Fetch current meeting exam for a session
   */
  async getMeetingExam(sessionId: string): Promise<any | null> {
    const { data: exam, error } = await supabase
      .from('meeting_exams')
      .select(`
        *,
        meeting_exam_banks(question_bank_id)
      `)
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())
      .maybeSingle()

    if (error) {
      console.error('Error fetching meeting exam:', error.message)
      return null
    }

    if (exam) {
      const bankIds = (exam.meeting_exam_banks as any[])?.map((b: any) => b.question_bank_id) || []
      return {
        ...exam,
        question_bank_ids: bankIds
      }
    }
    return null
  },

  /**
   * Setup or update exam for a meeting session
   */
  async setupMeetingExam(
    sessionId: string,
    title: string,
    durationSeconds: number,
    questionsPerUser: number,
    bankIds: string[]
  ): Promise<any> {
    // 1. Check if exam already exists for this session
    const { data: existingExam } = await supabase
      .from('meeting_exams')
      .select('id')
      .eq('meeting_session_id', sessionId)
      .eq('organization_id', tenantService.requireOrganizationId())
      .maybeSingle()

    let examId = ''
    if (existingExam) {
      // Update
      const { data, error } = await supabase
        .from('meeting_exams')
        .update({
          title,
          duration_seconds: durationSeconds,
          questions_per_user: questionsPerUser,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingExam.id)
        .eq('organization_id', tenantService.requireOrganizationId())
        .select('*')
        .single()

      if (error) throw new Error(`Cập nhật đề thi thất bại: ${error.message}`)
      examId = data.id
    } else {
      // Insert
      const { data, error } = await supabase
        .from('meeting_exams')
        .insert({
          organization_id: tenantService.requireOrganizationId(),
          meeting_session_id: sessionId,
          title,
          duration_seconds: durationSeconds,
          questions_per_user: questionsPerUser,
          score_scale: 10,
          status: 'draft'
        })
        .select('*')
        .single()

      if (error) throw new Error(`Tạo cấu hình đề thi thất bại: ${error.message}`)
      examId = data.id
    }

    // 2. Clear old bank associations if any
    await supabase
      .from('meeting_exam_banks')
      .delete()
      .eq('meeting_exam_id', examId)
      .eq('organization_id', tenantService.requireOrganizationId())

    // 3. Create new bank associations
    if (bankIds && bankIds.length > 0) {
      const assocPayload = bankIds.map(bankId => ({
        organization_id: tenantService.requireOrganizationId(),
        meeting_exam_id: examId,
        question_bank_id: bankId
      }))

      const { error: assocError } = await supabase
        .from('meeting_exam_banks')
        .insert(assocPayload)

      if (assocError) {
        throw new Error(`Liên kết ngân hàng đề thi thất bại: ${assocError.message}`)
      }
    }

    return { id: examId, title, durationSeconds, questionsPerUser, bankIds }
  }
}
