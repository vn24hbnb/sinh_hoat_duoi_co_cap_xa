import { useState, useCallback } from 'react'

export interface GpsCoordinates {
  latitude: number
  longitude: number
  accuracy?: number // Sai số kỹ thuật tính theo mét (Position accuracy in meters)
}

export const useGps = () => {
  const [coordinates, setCoordinates] = useState<GpsCoordinates | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /**
   * Lấy tọa độ GPS độ chính xác cao bằng thuật toán Lọc đa mẫu (Multi-sample High Precision)
   * Tự động lọc chọn mẫu định vị có bán kính sai số (Accuracy) nhỏ nhất.
   */
  const getLocation = useCallback((): Promise<GpsCoordinates> => {
    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const errorMsg = 'Trình duyệt không hỗ trợ định vị địa lý GPS.'
        setError(errorMsg)
        setLoading(false)
        reject(new Error(errorMsg))
        return
      }

      let bestSample: GpsCoordinates | null = null
      let watchId: number | null = null
      let isResolved = false

      const finishWithSample = (coords: GpsCoordinates) => {
        if (isResolved) return
        isResolved = true
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
        }
        setCoordinates(coords)
        setLoading(false)
        resolve(coords)
      }

      const finishWithError = (err: Error) => {
        if (isResolved) return
        isResolved = true
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
        }
        setError(err.message)
        setLoading(false)
        reject(err)
      }

      // Đặt bộ đếm thời gian tối đa 3.5 giây để chắt lọc mẫu GPS tốt nhất
      const timerId = setTimeout(() => {
        if (bestSample) {
          finishWithSample(bestSample)
        } else {
          // Nếu watchPosition chưa kịp gửi mẫu, gọi fallback getCurrentPosition
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finishWithSample({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy
              })
            },
            (_geoError) => {
              finishWithError(new Error('Quá thời gian lấy vị trí GPS chính xác. Vui lòng thử lại.'))
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          )
        }
      }, 3500)

      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const currentCoords: GpsCoordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            }

            // Cập nhật mẫu tốt nhất (có accuracy nhỏ nhất)
            if (!bestSample || (currentCoords.accuracy && currentCoords.accuracy < (bestSample.accuracy || 9999))) {
              bestSample = currentCoords
            }

            // Nếu đạt được độ chính xác rất cao (<= 20m), hoàn tất luôn không cần chờ hết 3.5s
            if (currentCoords.accuracy && currentCoords.accuracy <= 20) {
              clearTimeout(timerId)
              finishWithSample(currentCoords)
            }
          },
          (geoError) => {
            if (bestSample) {
              clearTimeout(timerId)
              finishWithSample(bestSample)
              return
            }

            let errorMsg = 'Không thể lấy được vị trí GPS của đồng chí.'
            switch (geoError.code) {
              case geoError.PERMISSION_DENIED:
                errorMsg = 'Quyền định vị bị từ chối. Đồng chí vui lòng bật GPS trong cài đặt thiết bị và trình duyệt.'
                break
              case geoError.POSITION_UNAVAILABLE:
                errorMsg = 'Thông tin vị trí định vị không khả dụng tại khu vực này.'
                break
              case geoError.TIMEOUT:
                errorMsg = 'Quá thời gian lấy vị trí GPS. Vui lòng thử lại.'
                break
            }
            clearTimeout(timerId)
            finishWithError(new Error(errorMsg))
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )
      } catch (err: any) {
        clearTimeout(timerId)
        finishWithError(new Error('Lỗi khởi tạo thiết bị GPS.'))
      }
    })
  }, [])

  return {
    coordinates,
    error,
    loading,
    getLocation
  }
}

export default useGps

