# Kế hoạch triển khai Mường La và Chiềng Lao

## Phạm vi và nguyên tắc

- Một mã nguồn, một dự án Supabase mới dành riêng cho hai xã; không thay đổi hệ thống cũ.
- Giữ giao diện đỏ/vàng kem, quy trình phiên họp, điểm danh, kiểm tra, báo cáo.
- Mọi nghiệp vụ gắn `meeting_session_id` và đơn vị; phân quyền được kiểm tra tại máy chủ, không chỉ trên giao diện.
- Đăng nhập chọn xã → chi bộ → tên → mật khẩu; đổi mật khẩu tự nguyện. Tên trùng hiển thị thêm ngày sinh.
- Dùng chung thiết bị được phép; GPS mặc định 200m, địa điểm do quản trị cấu hình. Không dùng tọa độ cơ quan cũ.
- Thi sau khi đóng điểm danh, không yêu cầu đã điểm danh; kết thúc chậm nhất 17h ngày tổ chức theo giờ Việt Nam. Số câu/thời lượng và quyền thi lại theo cấu hình gốc.
- Danh sách, mật khẩu quản trị và khóa bí mật không đưa lên GitHub.

## Phân công agent và kiểm tra chéo

| Nhóm | Sản phẩm | Người kiểm tra chéo |
|---|---|---|
| Backend | Schema mới, RLS, Supabase Auth, RPC điểm danh/thi, quản trị tài khoản | QA + điều phối |
| Frontend | Đăng nhập, chọn xã, quản lý thành viên, giao diện theo đơn vị | QA + backend kiểm tra hợp đồng API |
| QA | Kiểm thử tự động, phân quyền hai xã, biên thời gian, lỗi đồng thời | Điều phối kiểm tra và chạy lại |
| Điều phối | Tích hợp nghiệp vụ, kế hoạch, cấu hình, build, triển khai backend, tổng hợp | Các agent phản biện |

## Các giai đoạn

1. **Khảo sát và cô lập bản mới:** kiểm tra thay đổi bản nguồn, clone repo mới, thống nhất API; không sao chép lịch sử chứa dữ liệu cá nhân.
2. **Nền dữ liệu và xác thực:** tạo hai đơn vị, chi bộ Mường La đã xác nhận; tài khoản Auth và hồ sơ ứng dụng; chặn đọc/ghi chéo xã, chặn tự nâng quyền. Chỉ công khai trường tối thiểu phục vụ chọn tên đăng nhập.
3. **Giao diện và quản trị:** chọn xã/chi bộ/tên, tìm nhanh; quản trị xã chỉ thấy xã mình, quản trị chung chọn xã; thêm/sửa/khóa/reset thành viên và xem trước nhập Excel.
4. **Nghiệp vụ an toàn:** tạo phiên và chốt danh sách thống nhất; điểm danh tại server; thi/chấm điểm tại server, khóa ghi đồng thời, không tải đáp án đúng trước khi nộp; báo cáo theo phiên.
5. **Kiểm tra và sửa:** chạy build sau từng đợt; kiểm thử hai tài khoản khác xã, giả mạo ID, hai lần nộp, tải lại trang, mất kết nối, hết giờ, dùng chung máy và tên trùng. Agent QA kiểm tra độc lập, sửa rồi chạy lại.
6. **Chuẩn bị vận hành:** chỉ áp dụng schema vào Supabase mới; nhập dữ liệu thật qua luồng riêng; lưu báo cáo kết quả và hướng dẫn Vercel thủ công cho tài khoản vn24h.bnb.

## Tiêu chí nghiệm thu

- Build thành công; không có service-role hoặc mật khẩu quản trị trong mã frontend/Git.
- Xã A không đọc/ghi thành viên, phiên, câu hỏi, điểm danh hay bài thi xã B dù thay đổi tham số API.
- Không thể sửa quyền bằng localStorage; phiên đăng nhập có thể khôi phục và đăng xuất đúng.
- Cùng một người/phiên không tạo hai bản điểm danh hoặc hai bài thi trái phép.
- Không phải điểm danh trước mới được thi; server từ chối đáp án muộn; nộp nhiều lần trả cùng kết quả.
- Không dùng số liệu, chi bộ, câu hỏi hoặc địa điểm giả để thay phần chưa được cung cấp.
- Ghi rõ phần đã kiểm thử thực tế, phần chưa kiểm thử và việc người dùng còn phải cấu hình.

## Tiến độ thực hiện ngày 01/10/2026

- Hoàn thành nền Supabase cho hai xã; đã xác nhận bật RLS trên 20 bảng nghiệp vụ. Mường La có hai chi bộ theo yêu cầu; Chiềng Lao chưa tạo chi bộ vì chưa có tên được xác nhận.
- Đã triển khai Edge Function `admin-members`, yêu cầu JWT, chỉ dùng khóa service ở phía server; đã bổ sung kiểm tra quyền theo xã và nhật ký thao tác quản trị.
- Đã sửa bản đồ không dùng tọa độ cơ quan cũ, giữ bán kính 200m và yêu cầu cấu hình địa điểm trước khi điểm danh GPS.
- Đã xác nhận hai tệp Mường La có 34 và 48 dòng hợp lệ (82 tổng cộng). Chưa nhập dữ liệu vào project vì các tài khoản Auth quản trị chưa được tạo; thông tin cá nhân không được sao chép vào repository.
- Build thành công và 9/9 kiểm thử điểm GPS/bản đồ đạt; `npm audit` không có lỗ hổng. Advisor không còn phát hiện thiếu index khóa ngoại hoặc policy đọc trùng; còn cảnh báo SECURITY DEFINER dành cho RPC đã kiểm tra quyền theo người dùng, và endpoint danh sách đăng nhập công khai có chủ đích để hỗ trợ chọn tên.
- Đã xử lý chuyển đơn vị của admin@ ở các màn dashboard, phiên họp, bản đồ, báo cáo, ngân hàng câu hỏi, nhật ký và tài sản giao diện: hủy kết quả tải cũ, làm sạch dữ liệu khi đổi xã và lọc nhật ký tường minh theo `organization_id`. Đã rà schema trực tiếp: các bảng phiên, điểm danh, thi, ngân hàng câu hỏi và nhật ký đều bật RLS.
- Kiểm tra chéo độc lập bằng agent chưa chạy được trong phiên này do giới hạn sử dụng agent; thay vào đó đã tự rà code, kiểm thử, quét dependency và đọc Supabase security/performance advisors. Advisors hiện còn một cảnh báo anon cho `login_directory` và các cảnh báo SECURITY DEFINER có chủ đích; 54 chỉ mục mới chưa được sử dụng vì project chưa có tải nghiệp vụ thật.
- `npm run lint` chưa sạch: 188 lỗi và 9 cảnh báo trên toàn repo; 65 lỗi là kiểu `any` và còn lỗi quy tắc lint ở nhiều màn/service. Không coi lint là đạt chỉ vì build thành công.
- Chưa hoàn tất đăng nhập thật, nhập câu hỏi, nhập đảng viên, cấu hình địa điểm/giờ, diễn tập hai xã hoặc triển khai Vercel. Những việc này cần tài khoản quản trị Auth, danh sách Chiềng Lao và dữ liệu nghiệp vụ còn thiếu.

## Dữ liệu cần bổ sung trước ngày 05/10/2026

- Danh sách và tên chi bộ Chiềng Lao; hiện không tự tạo danh sách thay thế.
- Địa điểm/tọa độ và giờ mở/đóng điểm danh từng xã.
- Ngân hàng câu hỏi riêng từng xã và cấu hình bài thi chính thức.
- Người dùng nhập cấu hình môi trường và bấm triển khai Vercel theo hướng dẫn; chưa được coi là vận hành chính thức nếu chưa diễn tập đủ hai xã.
