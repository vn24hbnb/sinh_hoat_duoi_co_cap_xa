import { useState } from 'react'
import { branchService } from '../../services/branchService'
import { tenantService } from '../../services/tenantService'

interface Branch { id: string; name: string }
interface Props {
  organizationId: string
  branches: Branch[]
  members: { chi_bo_id: string }[]
  disabled: boolean
  onChanged: () => Promise<void>
}

export function BranchManager({ organizationId, branches, members, disabled, onChanged }: Props) {
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState<Branch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const locked = disabled || busy
  async function run(action: () => Promise<unknown>, success: string) {
    if (locked) return
    setBusy(true); setError(''); setMessage('')
    try {
      await action()
      if (tenantService.getOrganizationId() !== organizationId) return
      setEditing(null); setDeleting(null); setMessage(success)
      await onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa cập nhật được chi bộ.') }
    finally { setBusy(false) }
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted">Đổi tên không thay đổi mã chi bộ hoặc lịch sử. Chỉ xóa được chi bộ chưa có đảng viên và chưa được sử dụng trong phiên họp.</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Tên chi bộ</th><th className="p-2">Đảng viên</th><th className="p-2">Thao tác</th></tr></thead><tbody>
      {branches.map(item => {
        const count = members.filter(member => member.chi_bo_id === item.id).length
        return <tr key={item.id} className="border-t"><td className="p-2">{item.name}</td><td className="p-2">{count}</td><td className="p-2"><div className="flex flex-wrap gap-3">
          <button type="button" disabled={locked} className="text-blue-700 underline disabled:opacity-50" aria-label={`Sửa tên chi bộ ${item.name}`} onClick={() => { setEditing({ ...item }); setDeleting(null); setError(''); setMessage('') }}>Sửa tên</button>
          <button type="button" disabled={locked || count > 0} title={count ? 'Chi bộ có đảng viên: không thể xóa' : 'Kiểm tra dữ liệu liên quan trước khi xóa'} className="text-red-700 underline disabled:opacity-50" aria-label={`Xóa chi bộ ${item.name}`} onClick={() => { setDeleting(item); setEditing(null); setError(''); setMessage('') }}>Xóa</button>
        </div></td></tr>
      })}
      {!branches.length && <tr><td colSpan={3} className="p-3 text-muted">Chưa có chi bộ. Hãy thêm chi bộ bên trên.</td></tr>}
    </tbody></table></div>
    {editing && <form className="space-y-3 rounded-xl border border-line p-4" onSubmit={e => { e.preventDefault(); void run(() => branchService.rename(organizationId, editing.id, editing.name), 'Đã cập nhật tên chi bộ.') }}>
      <label className="block text-sm font-bold">Tên chi bộ<input autoFocus required maxLength={200} value={editing.name} disabled={locked} onChange={e => setEditing({ ...editing, name: e.target.value })} className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-foreground" /></label>
      <div className="flex gap-3"><button disabled={locked || !editing.name.trim()} className="rounded-xl bg-red-revolution px-4 py-2 font-bold text-white disabled:opacity-50">Lưu tên chi bộ</button><button type="button" disabled={busy} onClick={() => { setEditing(null); setError('') }} className="rounded-xl border border-line px-4 py-2">Hủy</button></div>
    </form>}
    {deleting && <div role="alert" className="space-y-3 rounded-xl border border-red-200 p-4">
      <p>Xóa chi bộ “{deleting.name}”? Thao tác này không thể hoàn tác. Máy chủ sẽ từ chối nếu chi bộ đang được sử dụng.</p>
      <div className="flex gap-3"><button type="button" disabled={locked} onClick={() => void run(() => branchService.remove(organizationId, deleting.id), 'Đã xóa chi bộ chưa sử dụng.')} className="rounded-xl bg-red-revolution px-4 py-2 font-bold text-white disabled:opacity-50">Xác nhận xóa chi bộ</button><button type="button" disabled={busy} onClick={() => { setDeleting(null); setError('') }} className="rounded-xl border border-line px-4 py-2">Hủy</button></div>
    </div>}
  </div>
}
