import { supabase } from './supabaseClient'

export interface UiSettings {
  id: string
  site_name: string
  organization_name: string
  login_title: string
  home_title: string
  welcome_message: string
  main_slogan: string
  primary_button_text: string
  footer_text: string | null
  theme_color: string
  accent_color: string
  font_family: string
  appearance: 'light' | 'dark' | 'system'
  effects_enabled: boolean
  active_home_background_asset_id: string | null
  active_login_background_asset_id: string | null
  active_banner_asset_id: string | null
  active_logo_asset_id: string | null
  home_background_opacity?: number
  login_background_opacity?: number
  home_background_spin_speed?: number
}

export interface UiSettingsWithAssets extends UiSettings {
  active_home_background?: { file_url: string } | null
  active_login_background?: { file_url: string } | null
  active_banner?: { file_url: string } | null
  active_logo?: { file_url: string } | null
}

export interface UiAsset {
  id: string
  asset_name: string
  asset_type: 'logo' | 'banner' | 'home_background' | 'login_background' | 'decoration' | 'honor_background'
  file_url: string
  file_path: string | null
  mime_type: string | null
  size_bytes: number | null
  description: string | null
  is_active: boolean
}

export const uiSettingsService = {
  /**
   * Fetch active UI settings along with active asset details
   */
  async getActiveSettings(): Promise<UiSettingsWithAssets> {
    const { data, error } = await supabase
      .from('ui_settings')
      .select(`
        *,
        active_home_background:ui_assets!ui_settings_home_bg_fk(file_url),
        active_login_background:ui_settings_login_bg_fk(file_url),
        active_banner:ui_settings_banner_fk(file_url),
        active_logo:ui_settings_logo_fk(file_url)
      `)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching UI settings:', error.message)
    }

    const localHomeOpacity = localStorage.getItem('fallback_home_background_opacity')
    const localLoginOpacity = localStorage.getItem('fallback_login_background_opacity')
    const localSpinSpeed = localStorage.getItem('fallback_home_background_spin_speed')

    if (data) {
      const result = data as UiSettingsWithAssets
      return {
        ...result,
        home_background_opacity: result.home_background_opacity !== undefined && result.home_background_opacity !== null
          ? result.home_background_opacity
          : (localHomeOpacity ? Number(localHomeOpacity) : 88),
        login_background_opacity: result.login_background_opacity !== undefined && result.login_background_opacity !== null
          ? result.login_background_opacity
          : (localLoginOpacity ? Number(localLoginOpacity) : 88),
        home_background_spin_speed: result.home_background_spin_speed !== undefined && result.home_background_spin_speed !== null
          ? result.home_background_spin_speed
          : (localSpinSpeed ? Number(localSpinSpeed) : 160)
      }
    }

    // Default fallback values based on DB schema
    return {
      id: '',
      site_name: 'Sinh hoạt chính trị dưới nghi thức chào cờ',
      organization_name: 'ĐẢNG BỘ THANH TRA TỈNH SƠN LA',
      login_title: 'ĐĂNG NHẬP CUỘC HỌP',
      home_title: 'Sinh hoạt chính trị dưới nghi thức chào cờ',
      welcome_message: 'Chào mừng các đồng chí tham dự phiên sinh hoạt',
      main_slogan: 'Trang trọng - Nhanh chóng - Chính xác',
      primary_button_text: 'TIẾP TỤC',
      footer_text: null,
      theme_color: '#D40000',
      accent_color: '#FACC15',
      font_family: 'Inter',
      appearance: 'light',
      effects_enabled: true,
      active_home_background_asset_id: null,
      active_login_background_asset_id: null,
      active_banner_asset_id: null,
      active_logo_asset_id: null,
      active_home_background: null,
      active_login_background: null,
      active_banner: null,
      active_logo: null,
      home_background_opacity: localHomeOpacity ? Number(localHomeOpacity) : 88,
      login_background_opacity: localLoginOpacity ? Number(localLoginOpacity) : 88,
      home_background_spin_speed: localSpinSpeed ? Number(localSpinSpeed) : 160
    }
  },

  /**
   * Update UI settings in DB and log audit log
   */
  async updateSettings(settings: Partial<UiSettings>, actorId: string): Promise<UiSettings> {
    // XSS mitigation: Remove HTML tags from text fields
    const sanitize = (text: string | undefined | null): string | undefined => {
      if (!text) return undefined
      return text.replace(/<[^>]*>?/gm, '') // Remove HTML tags
    }

    const cleanSettings = { ...settings }
    if (cleanSettings.site_name) cleanSettings.site_name = sanitize(cleanSettings.site_name)
    if (cleanSettings.organization_name) cleanSettings.organization_name = sanitize(cleanSettings.organization_name)
    if (cleanSettings.login_title) cleanSettings.login_title = sanitize(cleanSettings.login_title)
    if (cleanSettings.home_title) cleanSettings.home_title = sanitize(cleanSettings.home_title)
    if (cleanSettings.welcome_message) cleanSettings.welcome_message = sanitize(cleanSettings.welcome_message)
    if (cleanSettings.main_slogan) cleanSettings.main_slogan = sanitize(cleanSettings.main_slogan)
    if (cleanSettings.primary_button_text) cleanSettings.primary_button_text = sanitize(cleanSettings.primary_button_text)

    // Check if settings record exists
    const { data: existing } = await supabase
      .from('ui_settings')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    let resultData
    if (existing) {
      let { data, error } = await supabase
        .from('ui_settings')
        .update(cleanSettings)
        .eq('id', existing.id)
        .select('*')
        .single()
      
      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204' || error.message.includes('opacity') || error.message.includes('spin_speed') || error.message.includes('schema cache')) {
          const { home_background_opacity, login_background_opacity, home_background_spin_speed, ...fallbackSettings } = cleanSettings
          const { data: retryData, error: retryError } = await supabase
            .from('ui_settings')
            .update(fallbackSettings)
            .eq('id', existing.id)
            .select('*')
            .single()
          
          if (retryError) throw new Error(`Lỗi cập nhật UI settings: ${retryError.message}`)
          
          if (cleanSettings.home_background_opacity !== undefined) {
            localStorage.setItem('fallback_home_background_opacity', String(cleanSettings.home_background_opacity))
          }
          if (cleanSettings.login_background_opacity !== undefined) {
            localStorage.setItem('fallback_login_background_opacity', String(cleanSettings.login_background_opacity))
          }
          if (cleanSettings.home_background_spin_speed !== undefined) {
            localStorage.setItem('fallback_home_background_spin_speed', String(cleanSettings.home_background_spin_speed))
          }
          
          resultData = {
            ...retryData,
            home_background_opacity: cleanSettings.home_background_opacity,
            login_background_opacity: cleanSettings.login_background_opacity,
            home_background_spin_speed: cleanSettings.home_background_spin_speed,
            _db_missing_columns: true
          }
        } else {
          throw new Error(`Lỗi cập nhật UI settings: ${error.message}`)
        }
      } else {
        resultData = data
      }
    } else {
      let { data, error } = await supabase
        .from('ui_settings')
        .insert({ ...cleanSettings, is_active: true })
        .select('*')
        .single()
      
      if (error) {
        if (error.code === '42703' || error.code === 'PGRST204' || error.message.includes('opacity') || error.message.includes('schema cache')) {
          const { home_background_opacity, login_background_opacity, ...fallbackSettings } = cleanSettings
          const { data: retryData, error: retryError } = await supabase
            .from('ui_settings')
            .insert({ ...fallbackSettings, is_active: true })
            .select('*')
            .single()
          
          if (retryError) throw new Error(`Lỗi khởi tạo UI settings: ${retryError.message}`)
          
          if (cleanSettings.home_background_opacity !== undefined) {
            localStorage.setItem('fallback_home_background_opacity', String(cleanSettings.home_background_opacity))
          }
          if (cleanSettings.login_background_opacity !== undefined) {
            localStorage.setItem('fallback_login_background_opacity', String(cleanSettings.login_background_opacity))
          }
          
          resultData = {
            ...retryData,
            home_background_opacity: cleanSettings.home_background_opacity,
            login_background_opacity: cleanSettings.login_background_opacity,
            _db_missing_columns: true
          }
        } else {
          throw new Error(`Lỗi khởi tạo UI settings: ${error.message}`)
        }
      } else {
        resultData = data
      }
    }

    // Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'UPDATE_UI_SETTINGS',
      target_type: 'ui_settings',
      target_id: resultData.id,
      metadata: cleanSettings
    })

    return resultData as UiSettings
  },

  /**
   * Upload image to Supabase Storage and register metadata in ui_assets
   */
  async uploadAsset(
    file: File,
    assetType: UiAsset['asset_type'],
    description: string,
    actorId: string
  ): Promise<UiAsset> {
    // 1. Validate file extension and mime type
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp']
    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowedExtensions.includes(fileExt)) {
      throw new Error('Chỉ hỗ trợ tải lên các tệp tin hình ảnh dạng JPG, PNG, WEBP.')
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error('Định dạng tệp không hợp lệ (không phải là hình ảnh).')
    }

    // 2. Validate file size (3MB limit)
    const maxSize = 3 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error('Dung lượng tệp vượt quá giới hạn cho phép (Tối đa 3MB).')
    }

    // 3. Upload to Supabase Storage bucket 'ui-assets'
    const fileName = `${assetType}_${Date.now()}.${fileExt}`
    const filePath = `uploads/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('ui-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message)
      throw new Error(`Không thể tải tệp lên Storage: ${uploadError.message}`)
    }

    // 4. Get public URL
    const { data: urlData } = supabase.storage
      .from('ui-assets')
      .getPublicUrl(filePath)

    const fileUrl = urlData.publicUrl

    // 5. Insert metadata into ui_assets table
    const { data: asset, error: dbError } = await supabase
      .from('ui_assets')
      .insert({
        asset_name: file.name,
        asset_type: assetType,
        file_url: fileUrl,
        file_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
        description,
        is_active: false,
        uploaded_by: actorId
      })
      .select('*')
      .single()

    if (dbError) {
      console.error('DB asset insert error:', dbError.message)
      // Clean up uploaded file
      await supabase.storage.from('ui-assets').remove([filePath])
      throw new Error(`Đăng ký metadata ảnh thất bại: ${dbError.message}`)
    }

    // 6. Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'UPLOAD_UI_ASSET',
      target_type: 'ui_assets',
      target_id: asset.id,
      metadata: { assetName: file.name, assetType, fileUrl }
    })

    return asset as UiAsset
  },

  /**
   * Fetch all assets of a specific type
   */
  async getAssetsByType(assetType: UiAsset['asset_type']): Promise<UiAsset[]> {
    const { data, error } = await supabase
      .from('ui_assets')
      .select('*')
      .eq('asset_type', assetType)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching assets:', error.message)
      return []
    }

    return data as UiAsset[]
  },

  /**
   * Activate an asset of a specific type
   */
  async activateAsset(
    assetId: string,
    assetType: UiAsset['asset_type'],
    actorId: string
  ): Promise<UiSettings> {
    // 1. Update all assets of this type to is_active = false
    const { error: resetError } = await supabase
      .from('ui_assets')
      .update({ is_active: false })
      .eq('asset_type', assetType)

    if (resetError) {
      throw new Error(`Lỗi reset trạng thái ảnh cũ: ${resetError.message}`)
    }

    // 2. Set this specific asset to is_active = true
    const { error: setActiveError } = await supabase
      .from('ui_assets')
      .update({ is_active: true })
      .eq('id', assetId)

    if (setActiveError) {
      throw new Error(`Lỗi kích hoạt ảnh mới: ${setActiveError.message}`)
    }

    // 3. Update the corresponding field in ui_settings
    let fieldName: keyof UiSettings | null = null
    if (assetType === 'logo') fieldName = 'active_logo_asset_id'
    else if (assetType === 'banner') fieldName = 'active_banner_asset_id'
    else if (assetType === 'home_background') fieldName = 'active_home_background_asset_id'
    else if (assetType === 'login_background') fieldName = 'active_login_background_asset_id'

    if (!fieldName) {
      throw new Error(`Loại ảnh '${assetType}' không có trường cấu hình tương ứng trong ui_settings.`)
    }

    const settingsUpdate = { [fieldName]: assetId }
    const result = await this.updateSettings(settingsUpdate, actorId)

    // 4. Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'ACTIVATE_UI_ASSET',
      target_type: 'ui_assets',
      target_id: assetId,
      metadata: { assetType, fieldName }
    })

    return result
  },

  /**
   * Delete an asset from DB and Supabase Storage
   */
  async deleteAsset(
    assetId: string,
    filePath: string | null,
    actorId: string
  ): Promise<void> {
    // 1. If storage file path exists, delete from Supabase Storage
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('ui-assets')
        .remove([filePath])
      if (storageError) {
        console.warn('Cảnh báo: Không thể xóa file trong Storage:', storageError.message)
      }
    }

    // 2. Delete metadata from ui_assets in DB
    const { error: dbError } = await supabase
      .from('ui_assets')
      .delete()
      .eq('id', assetId)

    if (dbError) {
      throw new Error(`Lỗi xóa metadata ảnh trong DB: ${dbError.message}`)
    }

    // 3. Log audit log
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action: 'DELETE_UI_ASSET',
      target_type: 'ui_assets',
      target_id: assetId,
      metadata: { filePath }
    })
  }
}
