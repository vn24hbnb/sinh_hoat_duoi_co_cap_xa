# Bàn giao quản lý chi bộ — 02/10/2026

## Đã hoàn thành trong mã nguồn

- Mục **Đảng viên → Quản lý chi bộ của xã đang chọn** gồm thêm chi bộ, bảng số đảng viên, sửa tên và xóa có xác nhận.
- Giữ chức năng thêm chi bộ qua Edge Function `admin-members` hiện có; chỉ chuyển biểu mẫu vào khu vực quản lý chi bộ riêng.
- Đổi tên chỉ cập nhật `name`, `updated_at`, giữ nguyên ID và quan hệ đảng viên/phiên họp. Tên mới hiển thị khi các trang khác tải lại dữ liệu.
- Chỉ cho xóa chi bộ chưa có đảng viên (kể cả đã khóa) và chưa có `meeting_participants`. Chi bộ từng được dùng trong phiên họp phải giữ lại để bảo toàn lịch sử.
- Kiểm tra liên quan trước khi xóa; nếu lỗi hoặc chưa biết số bản ghi, không xóa. Foreign key tại database chặn trường hợp có người được gán vào chi bộ cùng lúc.
- Mọi cập nhật/xóa đều lọc `organization_id` và ID chi bộ. RLS hiện có chỉ cho admin/super_admin phù hợp thực hiện. Không thêm service key frontend.
- Không đổi Auth, mật khẩu, quy tắc điểm danh/thi, schema, RLS hoặc dữ liệu chi bộ thật.

## Tệp thay đổi

- `app/src/components/ui/BranchManager.tsx`: bảng quản lý, biểu mẫu đổi tên, bước xác nhận xóa, thông báo lỗi.
- `app/src/services/branchService.ts`: sửa/xóa có lọc xã và bảo vệ lịch sử.
- `app/src/pages/admin/MemberManager.tsx`: tích hợp khu vực chi bộ, giữ các handler nghiệp vụ hiện có.
- `app/tests/branch-management.test.mjs`: 8 kiểm thử service thực với IO giả lập.
- `app/tests/ui-preview.tsx`: giao diện kiểm thử độc lập, không gửi thao tác ghi dữ liệu thật.
- `app/scripts/check-ui-lint.mjs`: bổ sung kiểm tra các tệp mới.

## Kiểm chứng

- Supabase read-only xác nhận `chi_bos` có SELECT tenant_read; INSERT/UPDATE/DELETE kiểm tra `private.is_admin(organization_id)`; authenticated có quyền tương ứng.
- Hai foreign key từ `members` và `meeting_participants` trỏ đến `(organization_id,id)` của `chi_bos`, không cascade xóa.
- 38/38 kiểm thử bản triển khai đạt, gồm đổi tên giữ ID, sai/thiếu xã, tên trống/quá dài, trùng tên, RLS từ chối, chặn xóa chi bộ có dữ liệu, lỗi kiểm tra liên quan, FK chống race, đổi xã trong khi kiểm tra xóa và GPS tùy chọn.
- `npm run build` thành công; cảnh báo bundle >500KB có sẵn vẫn còn. Kiểm tra lint so với nền: không có lỗi mới (repo vẫn có lỗi lint cũ).
- Trình duyệt với dữ liệu kiểm thử: nút xóa bị khóa khi có đảng viên, mở biểu mẫu sửa, tên trống không cho lưu, xác nhận xóa/hủy hoạt động, không lỗi console. Không nhấn lưu/xóa dữ liệu thật.
- Chưa kiểm chứng thao tác ghi trên production bằng tài khoản thật. Bản này được đưa lên GitHub/Vercel cùng GPS tùy chọn sau xác nhận của người dùng; trạng thái cuối cùng xem bàn giao điểm danh.

## Thao tác sau triển khai

1. Đăng nhập quản trị; kiểm tra xã đang chọn trên thanh đầu trang.
2. Mở **Đảng viên**, tìm **Quản lý chi bộ của xã đang chọn**.
3. Thêm: nhập tên → Thêm chi bộ. Sửa: Sửa tên → nhập tên → Lưu tên chi bộ.
4. Xóa: chỉ với chi bộ chưa sử dụng → Xóa → Xác nhận xóa chi bộ. Không có cơ chế hoàn tác xóa.
5. Nếu chi bộ có đảng viên: chuyển đảng viên bằng chức năng Sửa thông tin đảng viên hiện có. Nếu đã có dữ liệu phiên họp thì vẫn không xóa, có thể đổi tên khi phù hợp.
6. Kiểm tra dropdown đăng nhập, danh sách đảng viên, phiên họp và báo cáo sau tải lại; chọn lần lượt hai xã để kiểm chứng phạm vi dữ liệu.

## Việc tiếp theo

Kiểm chứng thao tác bằng tài khoản quản trị thật sau triển khai. Không cần chạy migration hay cập nhật Edge Function cho chức năng sửa/xóa này.
