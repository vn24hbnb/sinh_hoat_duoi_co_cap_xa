# Bàn giao mở thi phiên hiện tại của Chiềng Lao — 05/10/2026

## Nguyên nhân và phạm vi

Phiên "Sinh hoạt chính trị dưới nghi thức chào cờ" của Chiềng Lao được đặt ngày 04/10/2026.
Ngày thực hiện là 05/10/2026 nên các RPC chặn mở thi, bắt đầu và lưu đáp án theo mốc 17h ngày họp.

Migration `20261005012249_allow_explicit_exam_schedule_override.sql` đã được áp dụng lên Supabase
project `tdgiunafijgyxlqfdwgv`. Tệp này ghi lại đúng migration đã áp dụng, không cần chạy lại thủ công.

## Hành vi

- `meeting_exams.ignore_session_schedule` mặc định `false`: các bài thi hiện có giữ quy tắc cũ.
- Khi quản trị bật cờ cho một bài thi, bài thi được mở theo trạng thái phiên/đề và không bị chặn bởi mốc 17h ngày họp.
- Thời lượng mỗi lượt thi vẫn được máy chủ kiểm soát qua `duration_seconds` và `deadline_at`.
- Các quyền, giới hạn xã, phiên họp, chấm điểm và quy tắc thi lại được giữ nguyên.
- Chỉ quản trị có quyền cập nhật cấu hình theo RLS hiện có.
- Không có thay đổi mã giao diện; Vercel vẫn gọi các RPC tương thích hiện tại.

## Thao tác đã thực hiện trên dữ liệu

Đã bật cờ và mở thi cho duy nhất bài thi `2dc38640-9e44-418e-a07b-b8e5156fc09e`
thuộc phiên `e51ef83f-5a47-4269-b102-c31199e88852`, xã Chiềng Lao,
lúc 08:23 ngày 05/10/2026 (Asia/Ho_Chi_Minh).
Không sửa ngày họp, điểm danh hoặc dữ liệu bài làm; bài thi vẫn có 10 câu và 600 giây.
Cấu hình bài thi hiện tại của Mường La giữ cờ `false`.

## Kiểm chứng đã thực hiện

Kiểm thử SQL chạy với vai trò `authenticated` và hồ sơ đảng viên Chiềng Lao:
bắt đầu thi nhận 10 câu/600 giây, lưu đáp án thành công, nộp bài thành công.
Toàn bộ dữ liệu của lượt kiểm thử được hoàn tác.
Truy cập bài thi Mường La bằng hồ sơ Chiềng Lao bị từ chối.
Đã xác minh chính sách cập nhật bài thi vẫn yêu cầu `private.is_admin(organization_id)`.

Build frontend `npm run build` thành công trên đúng mã nguồn `main` trước khi bàn giao.
Bộ kiểm thử hiện có: 36/38 đạt. Hai kiểm thử so sánh ảnh chụp mã nguồn trong
`ui-regression.test.mjs` còn so với commit cũ `10398f3`, nên báo khác biệt ở phần
chức vụ đảng viên đã được thêm trước bản sửa này (`admin-members`, `MemberManager`).
Bản sửa giờ thi không thay đổi các tệp frontend hoặc Edge Function đó.

Không chạy lại migration trên project đã áp dụng. Triển khai frontend trên Vercel không tự chạy SQL.
Đảng viên tải lại trang, vào bài kiểm tra và bấm "Bắt đầu làm bài".
Quản trị đóng thi theo luồng hiện có khi kết thúc.
