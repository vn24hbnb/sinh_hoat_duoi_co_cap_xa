/**
 * Calculates the distance between two GPS coordinates using the Haversine formula (returns distance in meters)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2)
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c) // Distance in meters
}

/**
 * Tính toán cự ly thực tế có trừ bù sai số kỹ thuật định vị (GPS Accuracy Margin)
 * Giúp tránh đánh dấu vắng/cảnh báo oan cho Đảng viên ở trong hội trường do nhiễu sóng trong nhà.
 */
export function calculateEffectiveDistance(
  rawDistanceM: number,
  accuracyM?: number | null
): { effectiveDistanceM: number; toleranceAppliedM: number } {
  if (!accuracyM || accuracyM <= 0) {
    return { effectiveDistanceM: rawDistanceM, toleranceAppliedM: 0 }
  }
  // Cho phép trừ bù tối đa 50% sai số thiết bị báo về (tối đa 25m) cho môi trường trong nhà
  const tolerance = Math.min(Math.round(accuracyM * 0.5), 25)
  const effectiveDistanceM = Math.max(0, rawDistanceM - tolerance)
  return { effectiveDistanceM, toleranceAppliedM: tolerance }
}

