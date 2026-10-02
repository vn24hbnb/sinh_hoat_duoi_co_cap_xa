# Điểm danh khi không bật GPS — 02/10/2026

## Kết quả kiểm tra hiện trạng

Supabase project `tdgiunafijgyxlqfdwgv` dùng RPC `attendance_mark`. Đã đọc định nghĩa trước thay đổi và áp dụng migration GPS tùy chọn ngày 02/10/2026 sau khi người dùng xác nhận cho phép.

- Frontend cũ khóa nút khi chưa có GPS, GPS đang chạy hoặc chưa có tọa độ hội trường.
- RPC cũ ném lỗi khi GPS được cấu hình mà tọa độ thiếu/không hợp lệ, hoặc chưa có vị trí hội trường.
- Báo cáo và danh sách phiên họp đã tính `status=warning` vào **đã điểm danh**, không phải vắng mặt. Ban quản trị có danh sách cảnh báo cùng chức năng duyệt/đánh vắng.

## Bản sửa đã áp dụng Supabase; đang triển khai frontend

- GPS không bắt buộc và không làm nút điểm danh chờ. Có thể nhấn ngay khi cấu hình phiên họp đã tải xong.
- Không tự hỏi quyền định vị khi người dùng chưa cấp; có nút lấy vị trí tùy chọn. Nếu đã cấp quyền, có thể lấy GPS nền nhưng không chặn nút.
- Sau RPC ghi nhận thành công, đảng viên luôn thấy **Điểm danh thành công**, kể cả thiếu GPS hoặc ngoài bán kính. Chỉ quản lý nhận trạng thái cần kiểm tra.
- Thiếu GPS: `status=warning`, `gps_valid=false`, tọa độ/cự ly NULL, lý do rõ ràng. Không tạo tọa độ giả, không gán (0,0).
- GPS không hợp lệ: loại bỏ tọa độ khỏi bản ghi, ghi nhận và cảnh báo cần kiểm tra.
- Có GPS nhưng chưa có hội trường: vẫn ghi nhận, cảnh báo chưa có vị trí để đối chiếu.
- GPS trong bán kính: `present`. Ngoài bán kính: `warning`, giữ tọa độ/cự ly để quản lý kiểm tra.
- Giữ yêu cầu QR/PIN/ảnh nếu phiên họp bật các mục này. Giữ cửa điểm danh, xác thực tài khoản, lọc xã + `meeting_session_id`, và chặn trùng.
- Cảnh báo là dữ liệu trong danh sách quản lý/báo cáo, **không phải email hoặc thông báo push**.
- Không sửa cấu trúc bảng, RLS, Auth hoặc dữ liệu điểm danh thật. Chỉ thay logic GPS trong RPC; đã xác minh quyền thực thi giữ authenticated, không mở cho anon/PUBLIC, search_path rỗng, còn kiểm tra xã và cửa điểm danh.

## Tệp

- `app/src/pages/member/Attendance.tsx`: GPS không chặn, thông báo thành công thống nhất.
- `app/src/pages/member/MemberHome.tsx`, `MemberResults.tsx`: trạng thái warning hiển thị như đã điểm danh/có mặt, không hiện banner GPS chờ duyệt cho đảng viên; quản lý vẫn thấy cảnh báo nguyên bản.
- `app/src/services/attendanceService.ts`: ghi nhận phương thức button khi thiếu tọa độ; chỉ báo thành công khi RPC trả kết quả hợp lệ.
- `app/src/utils/attendanceFlow.ts`: điều kiện nút và phương thức điểm danh.
- `app/src/pages/admin/AdminDashboard.tsx`, `MeetingManager.tsx`: ghi rõ đã điểm danh/cần kiểm tra, không hiện cự ly giả khi chưa có GPS.
- `supabase/migrations/20261002010616_attendance_gps_advisory.sql`: RPC mới, tạo bằng Supabase CLI; đã áp dụng vào project thật và kiểm tra định nghĩa/quyền sau áp dụng.
- `app/tests/attendance-gps.test.mjs`, `attendance-gps-postgres.sql`, `tenant-report.test.mjs`, `ui-regression.test.mjs`: kiểm thử hành vi được yêu cầu; các nghiệp vụ khác vẫn so sánh với bản nền.
- `app/scripts/check-ui-lint.mjs`: kiểm tra tệp mới, vẫn tách lỗi lint cũ khỏi lỗi phát sinh.

## Kiểm thử

- PostgreSQL thật trong database tạm riêng trên máy, chỉ mở Unix socket; đã dừng sau thử nghiệm. Không ghi dữ liệu thử vào Supabase production.
- RPC mới chạy thành công với không GPS/button, GPS trong/ngoài bán kính, NaN, thiếu vị trí hội trường, hai xã/two sessions, vắng có lý do. Vẫn từ chối sai xã, cổng đóng, trùng, sai QR/PIN, thiếu ảnh, không có profile hoặc admin tự điểm danh như member.
- Kiểm tra quyền execute: anon không có quyền, authenticated có quyền; `search_path=''`.
- 38/38 kiểm thử Node đạt: service, điều kiện nút thực trong Attendance (không chứa GPS), xác nhận cảnh báo vẫn được cộng vào tổng điểm danh/chi bộ, hiển thị thành công cho đảng viên, tách hai xã và các kiểm thử hồi quy.
- Build thành công. Cảnh báo bundle >500KB và lỗi lint cũ vẫn có; không có lỗi lint mới.
- Chưa có kiểm thử end-to-end bằng tài khoản thật trên production, GPS điện thoại hay tải đồng thời nhiều người.
- Advisors sau áp dụng còn cảnh báo SECURITY DEFINER cho các RPC được cấp quyền có chủ đích (attendance chỉ authenticated; login_directory phục vụ chọn tên trước đăng nhập) và chưa bật leaked-password protection. Không tự đổi Auth trong đợt này; đây không phải chứng nhận an toàn toàn hệ thống. Tham khảo [quyền RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RPC công khai](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [bảo vệ mật khẩu](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Triển khai và kiểm chứng tiếp theo

1. Người dùng đã đồng ý áp dụng quy tắc GPS tùy chọn. Người không cung cấp GPS vẫn được tính đã điểm danh, quản lý chịu trách nhiệm đối chiếu.
2. Đã áp dụng duy nhất migration RPC mới vào đúng project; không chạy lại migration khởi tạo, không tắt RLS hoặc thay Auth.
3. Đã kiểm tra lại định nghĩa và ACL RPC sau áp dụng. Trạng thái GitHub/Vercel được ghi tại phần cập nhật triển khai bên dưới.
4. Trong một phiên thử đã được cho phép: từ chối GPS → điểm danh → xác nhận có một bản ghi warning, tổng đã điểm danh tăng và quản lý thấy lý do; thử lại bị chặn trùng. Kiểm chứng cả hai xã, và QR/PIN/ảnh khi bật.
5. Nếu cần hoàn tác, khôi phục **riêng hàm attendance_mark** từ định nghĩa trước thay đổi (`20260930232217_two_commune_secure_backend.sql`) và frontend trước bản sửa. Không xóa bản ghi điểm danh đã tạo, không chạy toàn bộ migration cũ.

Các thay đổi quản lý chi bộ được triển khai cùng bản này. Không tạo điểm danh thử trong dữ liệu production.
