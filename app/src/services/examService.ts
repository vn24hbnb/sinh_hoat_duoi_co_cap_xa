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
      .eq('meeting_session_id', meetingSessionId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) {
      console.error('Error fetching active exam:', error.message)
      throw new Error('Không thể tải thông tin bài kiểm tra.')
    }

    return data as MeetingExam | null
  },

  /**
   * Get an existing in-progress attempt or create a new one with randomized fixed questions
   */
  async getOrCreateAttempt(
    examId: string,
    memberId: string,
    meetingSessionId: string
  ): Promise<{ attempt: ExamAttempt; questions: ExamQuestion[]; timeLeftSeconds: number }> {
    // 0. Fetch exam configuration to verify
    const { data: exam, error: examError } = await supabase
      .from('meeting_exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      throw new Error('Không tìm thấy thông tin bài kiểm tra.')
    }

    if (exam.status !== 'open') {
      throw new Error('Bài kiểm tra hiện tại chưa được mở hoặc đã đóng.')
    }

    // 1. Check for existing attempt
    const { data: existingAttempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('meeting_exam_id', examId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (attemptError) {
      console.error('Error checking existing attempt:', attemptError.message)
    }

    if (existingAttempt) {
      // Case A: Attempt is already submitted
      if (existingAttempt.status === 'submitted') {
        if (!existingAttempt.allow_retake) {
          throw new Error('Đồng chí đã hoàn thành bài kiểm tra này và không được làm lại.')
        }
        // If allow_retake is true, we will archive/cancel the old one or reset it.
        // For simplicity and database constraint UNIQUE, we will update the existing attempt
        // to reset its state, allowing the user to redo it.
        await this.resetAttemptForRetake(existingAttempt.id)
        return this.getOrCreateAttempt(examId, memberId, meetingSessionId)
      }

      // Case B: Attempt in progress ('started')
      const startedAt = new Date(existingAttempt.started_at).getTime()
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - startedAt) / 1000)
      const durationSeconds = existingAttempt.duration_seconds || exam.duration_seconds

      // If time has expired, auto-submit the attempt
      if (elapsedSeconds >= durationSeconds) {
        await this.submitAttempt(existingAttempt.id)
        throw new Error('Đã hết thời gian làm bài. Hệ thống đã tự động thu bài của đồng chí.')
      }

      // Fetch questions already stored in exam_attempt_answers
      const { data: savedAnswers, error: answersError } = await supabase
        .from('exam_attempt_answers')
        .select('id, question_id, selected_option, question_snapshot')
        .eq('exam_attempt_id', existingAttempt.id)
        .order('created_at', { ascending: true })

      if (answersError || !savedAnswers || savedAnswers.length === 0) {
        // If answers are missing, recreate questions
        console.warn('Saved answers not found, reconstructing...')
        const questions = await this.generateAndSaveQuestions(existingAttempt.id, examId, exam.questions_per_user)
        return {
          attempt: existingAttempt as ExamAttempt,
          questions,
          timeLeftSeconds: durationSeconds - elapsedSeconds
        }
      }

      const questions: ExamQuestion[] = savedAnswers.map((ans: any) => {
        const snap = ans.question_snapshot
        return {
          id: ans.question_id,
          content: snap?.content || 'Câu hỏi',
          optionA: snap?.option_a || '',
          optionB: snap?.option_b || '',
          optionC: snap?.option_c || '',
          optionD: snap?.option_d || '',
          selectedOption: ans.selected_option
        }
      })

      return {
        attempt: existingAttempt as ExamAttempt,
        questions,
        timeLeftSeconds: durationSeconds - elapsedSeconds
      }
    }

    // 2. Create new attempt
    const { data: newAttempt, error: createError } = await supabase
      .from('exam_attempts')
      .insert({
        meeting_exam_id: examId,
        meeting_session_id: meetingSessionId,
        member_id: memberId,
        status: 'started',
        duration_seconds: exam.duration_seconds,
        total_questions: exam.questions_per_user
      })
      .select('*')
      .single()

    if (createError || !newAttempt) {
      console.error('Error creating attempt:', createError?.message)
      throw new Error(`Không thể bắt đầu làm bài thi: ${createError?.message}`)
    }

    // 3. Generate questions and save empty answers
    const questions = await this.generateAndSaveQuestions(newAttempt.id, examId, exam.questions_per_user)

    return {
      attempt: newAttempt as ExamAttempt,
      questions,
      timeLeftSeconds: exam.duration_seconds
    }
  },

  /**
   * Helper to reset an attempt to 'started' for a retake (if authorized)
   */
  async resetAttemptForRetake(attemptId: string): Promise<void> {
    // Delete old answers
    await supabase
      .from('exam_attempt_answers')
      .delete()
      .eq('exam_attempt_id', attemptId)

    // Update attempt
    const { error } = await supabase
      .from('exam_attempts')
      .update({
        status: 'started',
        started_at: new Date().toISOString(),
        submitted_at: null,
        score: null,
        correct_count: null,
        duration_seconds: 600, // default reset duration
        allow_retake: false // consume the retake privilege
      })
      .eq('id', attemptId)

    if (error) {
      console.error('Error resetting attempt:', error.message)
      throw new Error('Không thể khởi tạo lại bài thi.')
    }
  },

  /**
   * Helper to fetch questions from bank, shuffle them, and insert empty answer templates
   */
  async generateAndSaveQuestions(
    attemptId: string,
    examId: string,
    count: number
  ): Promise<ExamQuestion[]> {
    // 1. Get question banks linked to the exam
    const { data: banks, error: banksError } = await supabase
      .from('meeting_exam_banks')
      .select('question_bank_id')
      .eq('meeting_exam_id', examId)

    if (banksError || !banks || banks.length === 0) {
      throw new Error('Bài thi hiện chưa được gán ngân hàng câu hỏi nào.')
    }

    const bankIds = banks.map(b => b.question_bank_id)

    // 2. Fetch active questions from these banks
    const { data: questionsList, error: qError } = await supabase
      .from('questions')
      .select('*')
      .in('question_bank_id', bankIds)
      .eq('is_active', true)

    if (qError || !questionsList || questionsList.length === 0) {
      throw new Error('Không có câu hỏi nào hoạt động trong ngân hàng câu hỏi.')
    }

    // 3. Shuffle and pick N questions
    const shuffled = [...questionsList].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, Math.min(count, shuffled.length))

    // 4. Save into exam_attempt_answers and map to ExamQuestion type
    const insertPayload = selected.map((q) => ({
      exam_attempt_id: attemptId,
      question_id: q.id,
      selected_option: null,
      correct_option: q.correct_option, // save correct option snapshot
      question_snapshot: {
        content: q.content,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d
      }
    }))

    const { error: insertError } = await supabase
      .from('exam_attempt_answers')
      .insert(insertPayload)

    if (insertError) {
      throw new Error(`Không thể khởi tạo bộ đề thi: ${insertError.message}`)
    }

    return selected.map((q) => ({
      id: q.id,
      content: q.content,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      optionD: q.option_d,
      selectedOption: null
    }))
  },

  /**
   * Save member's selected answer for a specific question during the exam
   */
  async saveAnswer(attemptId: string, questionId: string, selectedOption: string): Promise<void> {
    const { error } = await supabase
      .from('exam_attempt_answers')
      .update({ selected_option: selectedOption })
      .eq('exam_attempt_id', attemptId)
      .eq('question_id', questionId)

    if (error) {
      console.error('Error saving answer:', error.message)
      throw new Error('Không thể lưu câu trả lời. Vui lòng kiểm tra lại kết nối mạng.')
    }
  },

  /**
   * Submit and automatically grade the exam attempt
   */
  async submitAttempt(attemptId: string): Promise<ExamAttempt> {
    // 1. Get attempt info
    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('id', attemptId)
      .single()

    if (attemptError || !attempt) {
      throw new Error('Không tìm thấy thông tin bài thi tương ứng.')
    }

    if (attempt.status === 'submitted') {
      return attempt as ExamAttempt
    }

    // 2. Fetch all student answers
    const { data: answers, error: answersError } = await supabase
      .from('exam_attempt_answers')
      .select('*')
      .eq('exam_attempt_id', attemptId)

    if (answersError || !answers) {
      throw new Error('Không thể tải các đáp án đã làm.')
    }

    // 3. Score and flag correctness
    let correctCount = 0
    const totalQuestions = answers.length

    for (const ans of answers) {
      const isCorrect = ans.selected_option === ans.correct_option
      if (isCorrect) {
        correctCount++
      }

      // Update correct flag in database for this answer
      await supabase
        .from('exam_attempt_answers')
        .update({ is_correct: isCorrect })
        .eq('id', ans.id)
    }

    // Calculate score (based on score_scale, usually 10)
    const { data: exam } = await supabase
      .from('meeting_exams')
      .select('score_scale, duration_seconds')
      .eq('id', attempt.meeting_exam_id)
      .single()

    const scoreScale = exam?.score_scale || 10
    const maxDuration = exam?.duration_seconds || 600
    const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * scoreScale).toFixed(2)) : 0

    // Compute active duration seconds
    const startedTime = new Date(attempt.started_at).getTime()
    const nowTime = Date.now()
    const elapsedSeconds = Math.max(0, Math.floor((nowTime - startedTime) / 1000))
    const finalDuration = Math.min(elapsedSeconds, maxDuration)

    // 4. Update attempt state
    const { data: updatedAttempt, error: updateError } = await supabase
      .from('exam_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score,
        correct_count: correctCount,
        total_questions: totalQuestions,
        duration_seconds: finalDuration
      })
      .eq('id', attemptId)
      .select('*')
      .single()

    if (updateError || !updatedAttempt) {
      throw new Error(`Thu bài thất bại: ${updateError?.message}`)
    }

    // 5. Add audit log
    await supabase.from('audit_logs').insert({
      actor_id: attempt.member_id,
      action: 'SUBMIT_EXAM',
      target_type: 'exam_attempts',
      target_id: attemptId,
      metadata: { score, correctCount, totalQuestions, durationSeconds: finalDuration }
    })

    return updatedAttempt as ExamAttempt
  },

  /**
   * Fetch complete test results for a specific attempt (scores + detailed questions and correction)
   */
  async getAttemptResult(attemptId: string) {
    const { data: attempt, error: aError } = await supabase
      .from('exam_attempts')
      .select(`
        *,
        meeting_exams (
          title,
          duration_seconds,
          score_scale
        )
      `)
      .eq('id', attemptId)
      .single()

    if (aError || !attempt) {
      throw new Error('Không tìm thấy thông tin bài làm này.')
    }

    const { data: answers, error: ansError } = await supabase
      .from('exam_attempt_answers')
      .select('*')
      .eq('exam_attempt_id', attemptId)
      .order('created_at', { ascending: true })

    if (ansError) {
      throw new Error('Không thể lấy chi tiết bài làm.')
    }

    const detailAnswers = answers.map((ans: any) => {
      const snap = ans.question_snapshot
      return {
        id: ans.question_id,
        content: snap?.content || '',
        optionA: snap?.option_a || '',
        optionB: snap?.option_b || '',
        optionC: snap?.option_c || '',
        optionD: snap?.option_d || '',
        selectedOption: ans.selected_option,
        correctOption: ans.correct_option,
        isCorrect: ans.is_correct
      }
    })

    return {
      attempt: {
        id: attempt.id,
        title: attempt.meeting_exams?.title || 'Bài kiểm tra',
        score: Number(attempt.score),
        correctCount: attempt.correct_count,
        totalQuestions: attempt.total_questions,
        durationSeconds: attempt.duration_seconds,
        submittedAt: attempt.submitted_at,
        meetingSessionId: attempt.meeting_session_id
      },
      answers: detailAnswers
    }
  },

  /**
   * Fetch all active question banks
   */
  async getQuestionBanks(): Promise<any[]> {
    const { data, error } = await supabase
      .from('question_banks')
      .select('*')
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
      .insert({ name, description, is_active: true })
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
        .select('*')
        .single()

      if (error) throw new Error(`Cập nhật đề thi thất bại: ${error.message}`)
      examId = data.id
    } else {
      // Insert
      const { data, error } = await supabase
        .from('meeting_exams')
        .insert({
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

    // 3. Create new bank associations
    if (bankIds && bankIds.length > 0) {
      const assocPayload = bankIds.map(bankId => ({
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

