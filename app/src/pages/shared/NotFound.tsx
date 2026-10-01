import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { PatternBackground } from '../../components/ui/PatternBackground'
import { GlassCard } from '../../components/ui/GlassCard'
import { RevolutionaryButton } from '../../components/ui/RevolutionaryButton'
import { PortalHeader } from '../../components/layout/PortalHeader'

export const NotFound: React.FC = () => {
  const navigate = useNavigate()

  return (
    <PatternBackground>
      <PortalHeader />
      <div className="max-w-md mx-auto mt-20 px-4">
        <GlassCard className="text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-revolution/10 flex items-center justify-center text-red-revolution mb-4">
            <AlertCircle size={36} />
          </div>
          <h1 className="text-3xl font-bold text-red-deep dark:text-gold normal-case tracking-normal mb-2">
            404
          </h1>
          <h2 className="text-lg font-bold text-navy dark:text-white normal-case mb-4">
            Không tìm thấy trang
          </h2>
          <p className="text-xs md:text-sm font-semibold text-muted dark:text-muted leading-relaxed mb-6">
            Đồng chí đã truy cập vào đường dẫn không tồn tại trên hệ thống. Vui lòng quay lại trang chủ.
          </p>
          <RevolutionaryButton onClick={() => navigate('/')} fullWidth>
            Quay lại Trang chủ
          </RevolutionaryButton>
        </GlassCard>
      </div>
    </PatternBackground>
  )
}

export default NotFound
