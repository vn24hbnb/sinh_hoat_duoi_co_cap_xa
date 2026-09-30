import React, { useState, useRef } from 'react'
import { Upload, X, FileImage, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { uiSettingsService } from '../../services/uiSettingsService'
import type { UiAsset } from '../../services/uiSettingsService'
import { useAuth } from '../../contexts/AuthContext'

interface ImageUploaderProps {
  assetType: UiAsset['asset_type']
  onUploadSuccess: (newAsset: UiAsset) => void
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ assetType, onUploadSuccess }) => {
  const { user } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp']
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxSizeBytes = 3 * 1024 * 1024 // 3MB

  const getFriendlyAssetTypeName = () => {
    switch (assetType) {
      case 'logo':
        return 'Logo'
      case 'banner':
        return 'Banner'
      case 'home_background':
        return 'Ảnh nền Trang chủ'
      case 'login_background':
        return 'Ảnh nền Đăng nhập'
      default:
        return 'Hình ảnh'
    }
  }

  const validateFile = (selectedFile: File): boolean => {
    setError(null)
    setSuccess(false)

    // Check extension
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExtensions.includes(ext)) {
      setError('Định dạng tệp tin không hợp lệ. Chỉ chấp nhận các định dạng JPG, PNG, WEBP.')
      return false
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(selectedFile.type)) {
      setError('Định dạng tệp tin không hợp lệ. Chỉ chấp nhận các hình ảnh PNG, JPG, WEBP.')
      return false
    }

    // Check size
    if (selectedFile.size > maxSizeBytes) {
      setError('Dung lượng tệp tin vượt quá 3MB. Vui lòng giảm kích thước ảnh hoặc sử dụng định dạng WEBP.')
      return false
    }

    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (validateFile(selectedFile)) {
        setFile(selectedFile)
        setPreviewUrl(URL.createObjectURL(selectedFile))
      }
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0]
      if (validateFile(selectedFile)) {
        setFile(selectedFile)
        setPreviewUrl(URL.createObjectURL(selectedFile))
      }
    }
  }

  const handleClear = () => {
    setFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setDescription('')
    setError(null)
    setSuccess(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !user) return

    setUploading(true)
    setError(null)

    try {
      // Clean description to prevent HTML tags
      const cleanDescription = description.replace(/<[^>]*>?/gm, '')
      const newAsset = await uiSettingsService.uploadAsset(
        file,
        assetType,
        cleanDescription || `Tải lên cho ${getFriendlyAssetTypeName()}`,
        user.id
      )
      setSuccess(true)
      onUploadSuccess(newAsset)
      handleClear()
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra trong quá trình tải ảnh lên. Vui lòng thử lại.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleUpload} className="space-y-4">
        {/* Dropzone Area */}
        {!previewUrl ? (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-red-revolution bg-red-revolution/5 scale-[0.99]'
                : 'border-slate-300 dark:border-slate-700 hover:border-red-revolution/50 hover:bg-slate-50 dark:hover:bg-slate-800/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2.5">
              <div className="p-3 bg-red-revolution/10 rounded-full text-red-revolution">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Kéo thả hoặc nhấp để tải {getFriendlyAssetTypeName()}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                  Hỗ trợ JPG, PNG, WEBP (Tối đa 3MB)
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Preview Area */
          <div className="relative border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/40 p-4">
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-3 right-3 p-1.5 bg-red-revolution text-white hover:bg-red-dark rounded-full transition-all shadow-md z-10"
              title="Hủy chọn"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col md:flex-row gap-4 items-center">
              {/* Thumbnail Preview */}
              <div className="w-full md:w-40 h-28 flex items-center justify-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner shrink-0 relative">
                <img
                  src={previewUrl}
                  alt="Xem trước hình ảnh tải lên"
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Form Metadata */}
              <div className="flex-1 w-full space-y-3">
                <div className="flex items-center gap-2">
                  <FileImage size={16} className="text-red-revolution" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-xs">
                    {file?.name}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
                  </span>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Mô tả hình ảnh (ví dụ: Nền chào cờ Xuân 2026)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full min-h-[38px] px-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy/30 text-navy dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-revolution/50 text-xs font-semibold"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-red-revolution text-white hover:bg-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-red-revolution/25"
                  >
                    {uploading ? 'Đang tải lên...' : 'Lưu và Tải lên'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold animate-fade-in">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-fade-in">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Tải tệp tin lên thành công! Ảnh mới đã sẵn sàng để sử dụng.</span>
          </div>
        )}
      </form>
    </div>
  )
}
