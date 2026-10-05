import { useEffect, useRef } from 'react'
import { subscribeReportRefresh } from '../utils/reportRefresh'

export function useReportAutoRefresh(
  enabled: boolean,
  organizationId: string | null,
  sessionId: string | undefined,
  refresh: () => Promise<unknown>
) {
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh }, [refresh])
  useEffect(() => {
    if (!enabled || !organizationId || !sessionId) return
    return subscribeReportRefresh(() => refreshRef.current())
  }, [enabled, organizationId, sessionId])
}
