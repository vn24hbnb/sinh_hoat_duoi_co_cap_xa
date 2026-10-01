# Bàn giao giao diện ứng dụng hai xã

Ngày kiểm tra: 02/10/2026. Dự án: `sinh-hoat-duoi-co-cap-xa`.

## 1. Trạng thái

Đã triển khai giao diện trên nhánh `codex/ui-refresh-hai-xa`, dựa trên bản `10398f3b9b03bb019ec4c1b0558d6ef9d5154150`. Đây là bản hoàn thành và kiểm tra tại máy; chưa đẩy GitHub, chưa thay thế bản Vercel đang sử dụng.

Không sửa dịch vụ nghiệp vụ, AuthContext, bộ bảo vệ đường dẫn, kiểu dữ liệu nghiệp vụ, thư viện phụ thuộc hay migration. Không nhập lại danh sách, không thay đổi mật khẩu, không ghi dữ liệu phiên họp/điểm danh/bài thi lên Supabase.

## 2. Đã hoàn thành

- Áp dụng hệ màu đỏ trang trọng, nền nhẹ, cỡ chữ dễ đọc, thẻ và nút thống nhất; sử dụng Tailwind 4 hiện có, không đổi framework.
- Thu gọn tiêu đề các trang bên trong, giữ ảnh nền/trang trí cho trang chào và đăng nhập; bảo toàn cấu hình giao diện theo đơn vị, tránh lưu màu của xã trước khi chuyển xã.
- Điều hướng đầy đủ theo vai trò; menu phụ trên máy tính và menu di động. Giữ tăng/giảm chữ, trình chiếu, tự cuộn, đổi mật khẩu và đăng xuất.
- Giữ hai lựa chọn đăng nhập đảng viên/quản trị viên, luồng xã → chi bộ → họ tên → mật khẩu. Nút hướng dẫn không che biểu mẫu; không hiển thị mật khẩu mặc định công khai.
- Trang thành viên hiển thị tiến trình phiên họp nhưng không tạo thêm điều kiện khóa chức năng; vẫn được thi khi chưa điểm danh nếu quy tắc hiện tại cho phép.
- Chương trình phiên họp có biểu mẫu dễ đọc, vùng nhập tự giãn và chế độ nội dung nâng cao; bảo toàn trường mở rộng và nội dung cũ không đúng cấu trúc.
- Biểu mẫu phiên họp dài cuộn được trên điện thoại, luôn tiếp cận được nút lưu/hủy.
- Làm rõ đáp án đúng, trạng thái và trường hợp báo cáo chưa có bài hoàn tất; không sửa cách tính điểm.
- Bản đồ tự điều chỉnh kích thước khi vùng hiển thị thay đổi; không sửa truy vấn tọa độ hay điều kiện phiên họp.

Skill kiểm tra React và trình duyệt được dùng để rà soát khả năng tiếp cận, trạng thái tải, kích thước di động và thao tác thực tế. Skill Supabase chỉ được dùng để lấy cấu hình công khai cho bản kiểm tra; không sửa hệ thống backend.

## 3. Nhóm file

- `app/src/styles/tokens.css`, `app/src/index.css`, `app/index.html`: token giao diện, Tailwind, typography, tương phản, giảm chuyển động và viewport.
- `app/src/components/layout/`: header, banner, tin tức và điều hướng.
- `app/src/components/ui/`: card, nút, thông báo, nhãn, nền, tiến trình; bổ sung `AgendaEditor.tsx`, `GrowingTextarea.tsx`, `SessionProgress.tsx`.
- `app/src/contexts/UiSettingsContext.tsx`: áp dụng/reset thuộc tính giao diện theo đơn vị.
- `app/src/pages/`: cập nhật trình bày các trang quản trị, thành viên và dùng chung; giữ yêu cầu dịch vụ và hàm xử lý nghiệp vụ.
- `app/src/utils/agenda.ts`: đọc cấu trúc chương trình và bảo toàn nội dung mở rộng.
- `app/tests/ui-regression.test.mjs`, `app/tests/ui-preview.html`, `app/tests/ui-preview.tsx`, `app/scripts/check-ui-lint.mjs`: kiểm tra hồi quy và trang minh họa cô lập. Trang minh họa không nằm trong bộ định tuyến/bản dựng production, không ghi dữ liệu.
- `docs/screenshots/ui-login-20261002.png`: ảnh bản dựng đã kiểm tra, không chứa thông tin cá nhân hay khóa truy cập.

## 4. Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` trong `app` | Thành công |
| `node --test tests/*.test.mjs` trong `app` | 15/15 đạt |
| `node scripts/check-ui-lint.mjs` trong `app` | Không phát sinh lỗi/cảnh báo mới trên phần thay đổi |
| Lỗi lint có sẵn của 31 file được đối chiếu | Từ 145 xuống 142; không phải toàn repo sạch lint |
| `git diff --check` | Đạt |
| Đăng nhập quản trị chung và đảng viên cả hai xã | Đạt trên bản chạy tại máy |
| Sai mật khẩu, đăng xuất, chặn truy cập sau đăng xuất | Đạt |
| Đổi xã, lọc danh sách thành viên/chi bộ | Đạt trên màn quản lý thành viên |
| Biểu mẫu chương trình, hủy biểu mẫu, giữ trường mở rộng | Đạt, không lưu phiên thử vào DB |
| Kích thước 360/390/430/768/1366; sáng/tối, cỡ chữ, trình chiếu | Đã kiểm tra, không tràn ngang tại các màn được kiểm tra |
| Bản dựng tại `http://127.0.0.1:4174/login` | Tải được danh mục hai xã, không có lỗi/cảnh báo console khi kiểm tra |

Kiểm tra hồi quy xác nhận backend/auth/bộ bảo vệ đường dẫn/phụ thuộc không đổi; đối chiếu mọi lời gọi dịch vụ và các hàm xử lý nghiệp vụ của các trang với bản gốc. Bộ test cũng xác nhận `meeting_session_id`, cột GPS, xử lý lỗi DB, giới hạn sai số GPS và khả năng thi không cần điểm danh.

`package.json` không có script `npm test`; chạy bộ kiểm tra bằng lệnh Node nêu trên. Build vẫn có cảnh báo kích thước chunk của màn quản lý câu hỏi; không phải lỗi build.

## 5. Giới hạn và vấn đề có sẵn

- Hai xã chưa có phiên hoạt động khi kiểm tra. Chưa xác minh việc ghi điểm danh GPS thực địa, nộp bài thi thật, kết quả của phiên thực hoặc tải đồng thời trên production. Không tạo dữ liệu nghiệp vụ giả để thử.
- Chưa kiểm tra trên thiết bị iPhone/Safari thực, zoom trình duyệt 200% và thử tải nhiều người đồng thời.
- Với quản trị chung, bộ lọc chi bộ của bản đồ có thể hiện cả 15 chi bộ thay vì chỉ xã đang chọn, do truy vấn cũ không lọc đơn vị. Không tự thay đổi truy vấn nghiệp vụ trong đợt làm mới giao diện; cần xử lý riêng trước khi dùng bộ lọc này để giám sát theo xã.
- Lint toàn dự án còn lỗi từ bản nguồn. Không coi việc build đạt là bằng chứng toàn bộ tính năng production đã được kiểm thử.

## 6. Đưa vào sử dụng và quay lại bản cũ

1. Xem bản kiểm tra tại máy và tài liệu này; duyệt diện mạo mới.
2. Đẩy nhánh `codex/ui-refresh-hai-xa` lên repo đúng `vn24hbnb/sinh_hoat_duoi_co_cap_xa` và tạo bản Preview, chưa thay thế Production.
3. Trên Vercel tài khoản `vn24h.bnb`, giữ Root Directory `app`, biến môi trường công khai hiện có và cấu hình triển khai của dự án. Không đưa service-role key vào frontend. Việc triển khai Vercel vẫn thực hiện thủ công theo yêu cầu trước đây.
4. Kiểm tra quản trị từng xã, đăng nhập thành viên, phiên được phép thử, điểm danh GPS, làm/nộp bài và báo cáo theo cùng `meeting_session_id`; kiểm tra hai xã không lẫn dữ liệu. Nếu cần tạo phiên thử thật, phải xác định rõ dữ liệu thử và quyền thực hiện trước.
5. Chỉ chuyển bản đã nghiệm thu sang Production. Nếu gặp vấn đề, quay lại deployment cũ `10398f3`; đợt giao diện này không yêu cầu rollback database.

Không đưa `files.zip`, thư mục tài liệu thiết kế `files/`, danh sách Excel hoặc thông tin đăng nhập vào commit giao diện.
