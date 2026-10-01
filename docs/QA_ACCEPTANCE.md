# Kiểm thử và kiểm tra chéo triển khai hai xã

## Nguyên tắc bằng chứng

- Kiểm thử đơn vị chạy bằng `node --test tests/*.test.mjs` trong `app` (Node24).
- `npm run build` là kiểm tra biên dịch, không thay thế kiểm tra phân quyền cơ sở dữ liệu.
- Không dùng dữ liệu cá nhân thật làm dữ liệu mẫu hoặc đưa vào GitHub.
- Kiểm thử trên Supabase chỉ dùng project mới dành cho hai xã; không thao tác project nguồn.
- Không báo đạt kiểm thử trực tiếp nếu chỉ đọc mã hoặc mô phỏng API.

## Tiêu chí nghiệm thu

| Nhóm | Kịch bản bắt buộc | Kết quả mong đợi |
|---|---|---|
| Đăng nhập | Chọn xã, chi bộ, tên, mật khẩu | Đúng tài khoản, không bắt đổi mật khẩu |
| Trùng tên | Hai người cùng tên khác ngày sinh | Có hậu tố ngày sinh, ID độc lập |
| Phân quyền | Quản trị xã A gửi ID thuộc xã B | Server từ chối; không phụ thuộc giao diện |
| Phân quyền | Đảng viên đọc đáp án đúng hoặc tự ghi điểm | Bị từ chối |
| Quản trị chung | Tài khoản quản lý chung chuyển xã | Chỉ thao tác xã đang chọn, có dấu vết |
| Nhập danh sách | Nhập cùng danh sách hai lần | Không nhân đôi tài khoản |
| Điểm danh | Hai yêu cầu đồng thời cùng người/cùng phiên | Tối đa một bản ghi |
| Điểm danh | Cùng thiết bị, hai người khác nhau | Không cảnh báo chỉ vì dùng chung thiết bị |
| GPS | Chưa cài địa điểm | Báo cần cấu hình, không dùng tọa độ cơ quan cũ |
| GPS | Cự ly trong/ngoài200m | Đúng quy tắc, bù sai số tối đa25m |
| Phiên họp | Hai phiên cùng ngày | Không trộn điểm danh, bài thi, báo cáo |
| Bài thi | Chưa điểm danh | Vẫn thi được trong khung giờ hợp lệ |
| Bài thi | Trước khi đóng điểm danh | Chưa được bắt đầu |
| Bài thi | Bắt đầu sát17h | Hạn là mốc sớm hơn giữa hết thời lượng và17h |
| Bài thi | Đổi giờ thiết bị hoặc sửa request | Server vẫn áp hạn và chấm điểm đúng |
| Bài thi | Gửi nộp hai lần đồng thời | Không cộng/chấm hai lần |
| Thi lại | Quản trị cho phép một lượt | Dùng thời lượng cấu hình, tiêu thụ quyền thi lại |
| Khóa tài khoản | Tài khoản đang có phiên đăng nhập bị khóa | Không tiếp tục thao tác nghiệp vụ |
| Giao diện | Điện thoại và máy tính | Giữ phong cách và quy trình; không vỡ bố cục |

## Rủi ro phát hiện từ bản nguồn

1. Bài thi cũ chấm điểm ở trình duyệt và đọc đáp án đúng: phải chuyển sang nghiệp vụ server.
2. Điểm danh cũ kiểm tra rồi thêm ở hai request: cần ràng buộc duy nhất và thao tác server nguyên tử.
3. Tọa độ cũ và bán kính100m có giá trị dự phòng: không phù hợp hai xã.
4. Cảnh báo dùng chung thiết bị không còn phù hợp yêu cầu lần triển khai này.
5. Thời lượng thi lại từng cố định600giây: phải lấy cấu hình đề.

## Kiểm tra chéo

Agent QA độc lập đọc sản phẩm của agent backend và frontend. Lỗi nghiêm trọng về cô lập xã, đáp án, mật khẩu và hạn giờ phải xử lý trước nghiệm thu. Các phần chưa có danh sách Chiềng Lao, địa điểm, giờ điểm danh và ngân hàng câu hỏi thật phải ghi rõ chưa sẵn sàng vận hành.

## Kết quả kiểm tra hiện tại (01/10/2026)

- `npm run build`: đạt.
- `node --test tests/*.test.mjs`: 9/9 đạt (GPS, tách dữ liệu đúng phiên, tên cột tọa độ và xử lý lỗi truy vấn bản đồ).
- `npm audit`: 0 lỗ hổng.
- Supabase Advisors: RLS bật ở các bảng lõi đã kiểm tra; còn cảnh báo SECURITY DEFINER cho các RPC nghiệp vụ cần kiểm tra quyền bên trong và endpoint `login_directory` công khai có chủ đích để phục vụ màn chọn tên. Cần giữ việc giới hạn trường dữ liệu công khai ở mức tối thiểu.
- `npm run lint`: chưa đạt, 188 lỗi và 9 cảnh báo trên toàn repo (65 lỗi `any`, các lỗi khác nằm ở nhiều màn/service). Cần phân loại/sửa lint riêng; đây không phải lỗi build.
- Chưa kiểm thử trực tiếp đăng nhập/phân quyền hai xã bằng tài khoản thật vì Auth users chưa được tạo. Chưa coi các tiêu chí end-to-end là nghiệm thu.
