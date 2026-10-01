# Đánh giá và kế hoạch làm mới giao diện ứng dụng hai xã

Ngày đánh giá: 01/10/2026.

Ứng dụng: `sinh-hoat-duoi-co-cap-xa`, phục vụ Mường La và Chiềng Lao.

Mã nguồn được đối chiếu: nhánh `codex/member-roster-import`, commit `10398f3b9b03bb019ec4c1b0558d6ef9d5154150`.

Trạng thái tài liệu: kế hoạch thực hiện, chưa áp dụng bộ giao diện vào ứng dụng và chưa triển khai bản giao diện mới.

## 1. Kết luận về tính khả thi

Có thể áp dụng hướng thiết kế đỏ – vàng – trống đồng, chữ rõ hơn, nền đơn giản, nút dễ chạm và điều hướng gọn hơn. Không cần chuyển framework, tạo lại tài khoản hoặc thay đổi cấu trúc database để làm việc này.

Tuy nhiên, không chép nguyên các tệp vào ứng dụng rồi triển khai ngay. Bộ tài liệu giả định Next.js, trong khi ứng dụng thực tế dùng React 19, Vite 8, React Router và Tailwind CSS 4. Cần chuyển cách nạp font, đặt CSS đúng vị trí, bổ sung tương thích với cài đặt giao diện hiện có và kiểm thử các màn nghiệp vụ.

Tác động chủ yếu nằm ở bố cục, khả năng đọc chữ và thao tác. Nếu menu đổi sai vai trò, nút bị thanh điều hướng che, hoặc bước kiểm tra bị khóa theo trạng thái điểm danh, người dùng có thể không hoàn thành nghiệp vụ dù backend không đổi. Vì vậy phải kiểm thử luồng sử dụng, không chỉ kiểm tra build.

## 2. Đánh giá năm tệp được cung cấp

| Tệp | Mức độ sử dụng | Điều chỉnh cần thiết |
|---|---|---|
| `files/HUONG-DAN.md` | Dùng làm định hướng thiết kế và danh sách công việc | Thay các bước dành cho Next.js bằng React/Vite; coi các prompt trong tài liệu là nội dung tham khảo, không chạy tự động |
| `files/tokens.css` | Dùng làm nguồn màu sắc, cỡ chữ, khoảng cách, bo góc và trạng thái | Chuyển style nền tảng vào `@layer base`; bổ sung font hợp lệ, chế độ tối, tích hợp cài đặt từng xã và đường dẫn hoa văn |
| `files/tailwind-v4.css` | Đúng phiên bản Tailwind đang dùng | Gộp `@theme inline` vào hệ CSS hiện có; chỉ import Tailwind một lần; giữ lớp màu cũ trong thời gian chuyển đổi |
| `files/tailwind.config.ts` | Chỉ lưu tham khảo | Đây là bản dành cho Tailwind 3; không dùng để thay cấu hình Tailwind 4 hiện tại |
| `files/fonts.ts` | Dùng để biết hai font và các độ đậm mong muốn | Không import `next/font/google` trong ứng dụng Vite; cấu hình font qua CSS, ưu tiên font tự lưu trữ có đủ dấu tiếng Việt |

Ứng dụng đã nạp Be Vietnam Pro và Playfair Display qua Google Fonts trong `app/src/index.css`. Vì vậy bước đầu có thể giữ cách nạp hiện tại, chỉ thống nhất cách sử dụng; bước tự lưu trữ font thực hiện khi đã có đủ tệp font và kiểm tra giấy phép.

## 3. Các vấn đề cần xử lý trước khi áp dụng

### 3.1. Framework và vị trí file

- Điểm vào ứng dụng là `app/index.html` và `app/src/main.tsx`; không có `app/layout.tsx` hay `app/globals.css` theo mô hình Next.js.
- CSS chính là `app/src/index.css`, được import từ `main.tsx`.
- Vite đã dùng plugin `@tailwindcss/vite`; giữ cơ chế build này.
- Đặt bản token đã thích nghi vào `app/src/styles/tokens.css`. Các tệp trong `files/` giữ nguyên làm tài liệu nguồn.

### 3.2. Font có biến chưa được định nghĩa

`tokens.css` tham chiếu `--font-be-vietnam` và `--font-playfair`, nhưng ứng dụng Vite hiện không tạo hai biến này. Danh sách font đặt sau `var()` không tự cứu được trường hợp biến chưa tồn tại.

Giải pháp: khai báo hai biến font hợp lệ hoặc viết danh sách font trực tiếp trong token. Liên kết `--font-sans`/`--font-serif` hiện có với hệ font mới, đồng thời giữ lựa chọn `font_family` trong quản trị giao diện.

### 3.3. CSS nền tảng có thể ghi đè lớp Tailwind

Tệp token đang đặt màu, cỡ chữ và font của `h1`–`h4` ngoài CSS layer. Khi gộp nguyên bản, các khai báo này có thể thắng utility Tailwind nằm trong layer, khiến tiêu đề trên header đỏ nhận màu chữ tối hoặc không theo cỡ chữ của component.

Giải pháp: đưa reset/body/heading vào `@layer base`, dùng lớp ngữ nghĩa rõ ràng cho header và tiêu đề; kiểm tra computed style sau build. Không thay màu bằng thao tác tìm–thay toàn repo.

### 3.4. Cỡ chữ và trình chiếu có hai cơ chế khác nhau

Hiện tại `RedNavigationBar.tsx` dùng lớp `text-size-sm|md|lg`, lớp `presentation-mode`, lưu `user-text-size` và `presentation-font-size` trong localStorage. Bản token mới dùng `data-font` và `data-mode`.

CSS cũ còn dùng `!important` cho cỡ chữ nên có thể lấn át token mới. Trong 19 tệp TSX đang có utility cỡ chữ theo pixel, ví dụ `text-[10px]`; các chữ này không tự lớn theo cỡ chữ gốc.

Giải pháp: chọn một cơ chế thống nhất, đọc lại lựa chọn cũ khi chuyển đổi, giữ điều chỉnh cỡ chữ trình chiếu và nút thoát. Chuyển cỡ chữ nội dung/nút sang thang token; không đổi hàng loạt mọi kích thước pixel của bản đồ hoặc icon.

### 3.5. Chế độ tối và màu riêng từng xã

`UiSettingsContext.tsx` đang áp màu, font và chế độ sáng/tối/hệ thống vào root. Bộ token chỉ có bảng màu sáng; các lớp mới không tự nhận màu quản trị đang áp vào `--color-red-revolution` và `--color-gold`.

Giải pháp: bổ sung token tối; ánh xạ màu cấu hình vào token ngữ nghĩa và lớp tương thích cũ. Kiểm tra `dark:` theo lớp `.dark` để phù hợp cơ chế context. Khi đổi xã, đặt lại giá trị mặc định trước khi áp cài đặt mới để tránh giữ màu/font của xã trước.

### 3.6. Hoa văn và nền tùy chỉnh

`/hoa-van-trong-dong.png` trong tài liệu không có trong `app/public`. Ảnh trống đồng đang nằm ở `app/src/assets/bronze_drum.png` và được import qua Vite. `PatternBackground.tsx` còn hỗ trợ ảnh nền, độ mờ và tốc độ xoay lấy từ cài đặt.

Giải pháp: dùng asset hiện có hoặc asset mới đã được kiểm tra; giữ ảnh cấu hình ở đăng nhập/banner, dùng nền phẳng ở màn nghiệp vụ. Quy định rõ phạm vi hiển thị của ảnh nền để các mục quản trị giao diện vẫn có tác dụng dễ hiểu.

### 3.7. Điều hướng quản trị và màn hình nhỏ

`MemberManager.tsx` đang gọi `RedNavigationBar` mà không truyền vai trò; component mặc định vai trò `member`. Đây là vấn đề hiện có cần xử lý khi chuẩn hóa shell quản trị, để trang quản lý đảng viên có menu đúng vai trò.

Mobile hiện có padding dành cho menu dưới ở cả `body` và `main`; một số màn còn có thanh hành động cố định. Header mới và cỡ chữ lớn có thể tạo chồng lấn. `app/index.html` hiện cũng hạn chế phóng to bằng viewport.

Giải pháp: truyền vai trò/tên/callback đăng xuất từ AuthContext hiện có, thống nhất chiều cao menu và vùng an toàn, cho phép người dùng phóng to trên mobile. Giữ bộ chọn xã của quản trị chung luôn tìm thấy được.

### 3.8. Nội dung chuyên đề và trạng thái báo cáo

`MeetingManager.tsx` dùng `formAgenda` để đọc/ghi chuỗi JSON của chương trình. Không thể chỉ thay textarea bằng danh sách rồi ghi lại nội dung văn bản, vì có thể làm mất cấu trúc được các màn khác sử dụng.

Giải pháp: thêm lớp trình bày danh sách từ dữ liệu hiện có; nếu có chỉnh sửa bằng form, phải giữ nguyên cấu trúc và các trường chưa hiển thị khi serialize. Với báo cáo, trạng thái “Chưa có dữ liệu” phải dựa vào số bài thi đã hoàn tất, không dựa vào điểm bằng 0; điểm 0 vẫn có thể là kết quả thật.

## 4. Phạm vi và nguyên tắc triển khai

### Được thực hiện

- CSS, design token, component dùng chung, bố cục và JSX trình bày.
- Trạng thái tương tác giao diện: menu, cỡ chữ, trình chiếu, textarea tự giãn, cách hiển thị dữ liệu đã có.
- Thích nghi `UiSettingsContext` ở phần áp style, không đổi hợp đồng truy vấn hoặc lưu cài đặt.
- Sử dụng icon Lucide đã có; giữ nhận diện cơ quan và đủ dấu tiếng Việt.

### Hợp đồng nghiệp vụ phải giữ

- Đăng nhập đảng viên: chọn xã → chi bộ → tên → nhập mật khẩu; quản trị có lối đăng nhập riêng.
- Không đổi mật khẩu mặc định hay yêu cầu đổi mật khẩu bằng công việc làm giao diện.
- Mọi điểm danh, bài thi và báo cáo tiếp tục gắn với `meeting_session_id` và đúng xã.
- Giữ bán kính, kiểm tra GPS và quy tắc điểm danh do nghiệp vụ hiện hành quyết định.
- Được thi khi chưa điểm danh thành công, nếu đang trong khung giờ thi hợp lệ. Stepper chỉ diễn tả trạng thái, không tạo điều kiện khóa thi mới.
- Giữ số câu, thời lượng, số lượt, hạn nộp và cách chấm trên server.
- Giữ quyền của quản trị xã và quản trị chung; không chuyển kiểm tra quyền về phía trình duyệt.
- Không sửa migration, RLS, RPC, Edge Function, dịch vụ Auth/điểm danh/thi/báo cáo trong các commit đổi giao diện.
- Không dùng tên, điểm hoặc số lượng đảng viên giả để làm đẹp màn hình; không đưa danh sách cá nhân vào Git.

Nếu phát hiện lỗi nghiệp vụ ngoài phạm vi, ghi lại riêng. Thay đổi đó cần kế hoạch và kiểm thử riêng, tránh trộn vào việc thay CSS.

## 5. Các giai đoạn thực hiện

### Giai đoạn 0 — Chốt bản nền và bộ ảnh đối chiếu

**Mục tiêu:** có bản đối chiếu và đường quay lại trước khi đổi giao diện.

1. Tạo nhánh `codex/ui-refresh-hai-xa` từ commit đã xác nhận của ứng dụng hai xã; giữ nguyên các tệp người dùng cung cấp.
2. Ghi phiên bản Node/dependency đang dùng; không nâng React/Vite/Tailwind trong đợt này.
3. Chạy build và các kiểm thử hiện có; ghi lỗi lint nền nếu chạy lint để phân biệt với lỗi mới.
4. Chụp các trạng thái chính của đăng nhập, trang chủ đảng viên, quản trị, phiên họp, danh sách, bài thi, báo cáo và bản đồ ở mobile/desktop.
5. Ghi trước/sau các request, payload và thao tác nghiệp vụ quan trọng; các thao tác ghi thử dùng dữ liệu kiểm thử riêng.

**Đầu ra:** ghi nhận bản nền và ảnh đối chiếu không chứa dữ liệu cá nhân dùng làm mẫu công khai.

### Giai đoạn 1 — Thích nghi token, font và cài đặt giao diện

**Tệp dự kiến:** `app/src/styles/tokens.css` (mới), `app/src/index.css`, `app/src/main.tsx` nếu cần, `app/index.html`, `app/src/contexts/UiSettingsContext.tsx`; thư mục font và giấy phép nếu tự lưu trữ.

1. Thêm token đã sửa cho Vite, gom style nền tảng vào base layer.
2. Gộp theme Tailwind 4, giữ alias cho màu/font cũ trong lúc chuyển từng màn; giữ cả màu vàng không có số đang được dùng ở `text-gold`/`border-gold`.
3. Khai báo font hợp lệ và `font-display: swap`; kiểm tra dấu, dòng chữ và khả năng dự phòng khi font tải chậm.
4. Thêm token tối và ánh xạ cài đặt màu/font từng xã, kiểm tra đổi xã liên tiếp.
5. Xác định một cơ chế cỡ chữ/trình chiếu, giữ lựa chọn cũ trong localStorage và quy tắc thoát trình chiếu.
6. Kiểm tra focus, giảm chuyển động, viewport cho phép zoom và cỡ chữ ô nhập mobile.

**Nghiệm thu:** build đạt; các màn vẫn đọc được ở sáng/tối; tiêu đề trên nền đỏ đúng màu; ba cỡ chữ hoạt động; màu/font của hai xã không bị giữ nhầm khi chuyển.

### Giai đoạn 2 — Component dùng chung và điều hướng

**Tệp dự kiến:** `PortalHeader.tsx`, `RedNavigationBar.tsx`, `HeroBanner.tsx`, `NewsTicker.tsx`, `PatternBackground.tsx`, `GlassCard.tsx`, `RevolutionaryButton.tsx`, `StatusBadge.tsx`, `AlertMessage.tsx`, `StatCard.tsx` và các điểm gọi component liên quan.

1. Header thu gọn cho trang trong; banner lớn cho đăng nhập/trang tổng quan hoặc trang chủ phù hợp.
2. Nền nghiệp vụ phẳng, card có viền và bo góc thống nhất; giảm bóng, blur và hiệu ứng chuyển động.
3. Desktop có tối đa 5 mục chính; mục ít dùng nằm trong “Thêm” hoặc menu người dùng. Mọi màn quản trị vẫn truy cập được.
4. Member giữ các mục trang chủ, điểm danh, kiểm tra, kết quả; admin/organizer nhận menu đúng vai trò.
5. Giữ bộ chọn xã, menu cỡ chữ, trình chiếu, giao diện và đăng xuất; đăng xuất gọi hàm `logout` hiện có.
6. Thanh dưới và thanh hành động mobile chừa đủ vùng an toàn, không che nút tiếp tục hoặc nộp bài.
7. Dải thông tin dùng dòng tĩnh hoặc cơ chế dừng chuyển động, vẫn đọc được nội dung cấu hình.

**Nghiệm thu:** menu đúng vai trò ở mọi trang; chuyển xã được; đăng xuất kết thúc phiên; màn rộng 360px và cỡ chữ lớn không che nút; trình chiếu có nút thoát luôn truy cập được.

### Giai đoạn 3 — Đăng nhập và các màn đảng viên

**Tệp dự kiến:** `pages/shared/Login.tsx`, `Overview.tsx`, `ChangePassword.tsx`; `pages/member/MemberHome.tsx`, `Attendance.tsx`, `ExamIntro.tsx`, `ExamResult.tsx`, `MemberResults.tsx`.

1. Làm rõ hai chế độ đăng nhập, nhãn trường và thông báo lỗi; giữ thứ tự chọn xã/chi bộ/tên và xử lý trùng tên.
2. Ẩn dòng giới thiệu mật khẩu mặc định theo định hướng tài liệu; cách đăng nhập và giá trị mật khẩu không đổi.
3. Trang chủ có bước hiện tại và một hành động chính; trạng thái nghi lễ hiển thị như thông tin, không giống nút.
4. Stepper phản ánh trạng thái thực tế; cho phép truy cập bài thi hợp lệ dù chưa điểm danh.
5. Tăng vùng chạm, chỉnh cỡ chữ nội dung, nút và thông báo; giữ các handler, đồng hồ và cơ chế nộp bài.
6. Phân biệt trạng thái đang tải, không có phiên, chưa mở thi, đang thi và đã nộp bằng nội dung lẫn icon, không chỉ màu.

**Nghiệm thu:** đăng nhập đúng xã; tiếp tục đến điểm danh/thi theo quy tắc hiện có; đồng hồ và nút nộp bài hoạt động; không phát sinh điều kiện bắt buộc điểm danh hoặc đổi mật khẩu mới.

### Giai đoạn 4 — Các màn quản trị

**Tệp dự kiến:** `pages/admin/AdminDashboard.tsx`, `MemberManager.tsx`, `MeetingManager.tsx`, `QuestionManager.tsx`, `AdminReports.tsx`, `AdminLiveMap.tsx`, `AdminUiSettings.tsx`, `AdminAuditLogs.tsx`.

1. Danh sách đảng viên: giữ một tiêu đề, lọc rõ ràng, bảng cuộn ngang hoặc trình bày mobile; giữ nguyên nhập Excel, xem trước, phân biệt trùng tên và các thao tác tài khoản.
2. Phiên họp: nhóm form theo thông tin/điểm danh/bài thi; trình bày chương trình thành danh sách. Giữ nguyên đọc/ghi JSON, có fallback khi gặp dữ liệu cũ hoặc không parse được.
3. Câu hỏi: đáp án đúng có dấu kiểm, chữ và nền trạng thái; giữ lựa chọn đáp án và thao tác lưu.
4. Báo cáo: số thẳng cột, điểm theo màu ngữ nghĩa, top 3 dùng biểu tượng phù hợp; chưa có bài hoàn tất thì hiển thị trạng thái trống thay vì bảng xếp hạng giả.
5. Bản đồ: đổi tab/icon/nhãn khoảng cách, giữ tọa độ, kết luận bán kính do server và bộ lọc phiên. Popup HTML dùng style token thích hợp, giữ xử lý escape dữ liệu. Kiểm tra `map.resize()` khi vùng chứa đổi kích thước.
6. Giao diện: giải thích nơi áp ảnh nền/banner; giữ các lựa chọn sáng/tối/hệ thống và cài đặt riêng từng xã.

**Nghiệm thu:** thao tác quản trị tìm thấy dễ dàng trên mobile; các form lưu payload tương đương trước; chuyển xã/phiên không trộn dữ liệu; trạng thái trống được hiển thị đúng.

### Giai đoạn 5 — Kiểm thử toàn luồng và phát hành

1. Chạy `npm run build` sau từng giai đoạn; chạy kiểm thử GPS/bản đồ hiện có.
2. Với phần agenda, thêm kiểm thử vòng đọc–ghi giữ trường chưa hiển thị nếu triển khai trình sửa có cấu trúc. Với cỡ chữ/menu, kiểm tra bằng trình duyệt các hành vi thật, không thêm test chỉ lặp lại className.
3. Chạy lint đối với tệp thay đổi, phân biệt lỗi nền; không coi lỗi có sẵn là lỗi do token mới nếu chưa có bằng chứng.
4. Kiểm thử ma trận ở mục 6, chụp ảnh bản mới và đối chiếu bản nền.
5. Xuất bản Vercel Preview từ nhánh giao diện khi bắt đầu công việc phát hành được giao; dùng cấu hình môi trường hiện có, không thay project Supabase.
6. Kiểm tra Preview trên điện thoại thật rồi mới đưa bản đã nghiệm thu lên production; xác nhận branch/commit production thực tế trước khi promote hoặc merge.
7. Giữ lại deployment ổn định trước đó để rollback giao diện nếu cần; không khôi phục DB để rollback một thay đổi UI.

**Đầu ra:** bản nghiệm thu, danh sách file sửa, kết quả build/test, ảnh đối chiếu, commit/deployment và cách quay lại bản trước.

## 6. Ma trận kiểm thử bắt buộc

| Nhóm | Kịch bản | Điều kiện đạt |
|---|---|---|
| Thiết bị | Mobile 360/390/430px, tablet 768px, desktop 1366px | Không tràn toàn trang; bảng dài cuộn trong vùng riêng |
| Trình duyệt | Safari iPhone và Chrome Android/desktop | Font tiếng Việt, menu, form và nút hoạt động |
| Chữ và màu | sm/md/lg; sáng/tối/hệ thống; zoom 200% | Đọc được, không che nút; tương phản chữ thường tối thiểu 4.5:1 |
| Đăng nhập | Member hai xã, admin từng xã, admin chung, sai mật khẩu | Giữ đúng luồng, đúng quyền và thông báo lỗi |
| Cô lập đơn vị | Admin chung chuyển xã liên tiếp | Tên, màu/font, chi bộ và dữ liệu theo đúng xã |
| Danh sách | Xem trước Excel, nhóm trùng tên, ngày sinh trống, nhập lại | Giữ cách xử lý hiện có; thao tác ghi thử trên dữ liệu kiểm thử riêng |
| Phiên họp | Hai phiên cùng ngày; mở/đóng điểm danh | UI và payload giữ đúng `meeting_session_id` |
| Điểm danh | GPS hợp lệ, ngoài bán kính, từ chối quyền, thiếu vị trí | Thông báo rõ và kết quả nghiệp vụ không đổi |
| Bài thi | Chưa điểm danh; trước giờ; đang thi; sát hạn; nộp lặp | UI không tạo điều kiện mới; hạn và chấm điểm vẫn do server |
| Agenda | JSON có cấu trúc, trường mở rộng, nội dung cũ | Hiển thị dễ đọc, không mất dữ liệu khi lưu |
| Báo cáo | Chưa có bài; có điểm 0 thật; có dữ liệu | Phân biệt trạng thái trống với kết quả 0; giữ số liệu/xuất báo cáo |
| Bản đồ | Có/không có GPS, lỗi dữ liệu, đổi phiên, đổi kích thước | Không biến lỗi thành 0 người; không trộn phiên; bản đồ vẽ đúng |
| Trình chiếu | Vào/thoát, đổi cỡ chữ, đọc tài liệu | Có nút thoát, nội dung không bị che hoặc tràn bất thường |
| Cài đặt giao diện | Màu/font/ảnh nền tùy chỉnh từng xã | Cài đặt tiếp tục có hiệu lực đúng phạm vi |

Các thử nghiệm ghi DB/thi/điểm danh phải dùng bộ dữ liệu kiểm thử được tách riêng; không nhập lại danh sách thật để thử giao diện. Kiểm thử tải đồng thời cần được ghi nhận riêng nếu thực hiện; build và bộ test hiện có không chứng minh năng lực tải.

## 7. Tiến độ đề xuất trước ngày 5/10

| Thời điểm | Công việc ưu tiên | Điều kiện chuyển bước |
|---|---|---|
| 01/10 | Hoàn tất đánh giá và kế hoạch | Có danh sách tương thích, bản nền build/test đạt |
| 02/10 | Giai đoạn 0–2: token, font, cỡ chữ, shell và menu | Preview đọc rõ, đúng vai trò, không che nút |
| 03/10 | Giai đoạn 3 và màn quản trị dùng trong sự kiện | Đăng nhập, điểm danh, thi và cài phiên giữ đúng hành vi |
| 04/10 | Kiểm thử điện thoại thật, nghiệm thu, chốt deployment | Luồng chính đạt; có bản ổn định để quay lại |
| Sau 05/10 | Hoàn thiện các màn quản trị ít dùng hoặc chưa đủ thời gian kiểm thử | Triển khai từng nhóm đã nghiệm thu |

Đây là lịch mục tiêu, không phải cam kết hoàn thành toàn bộ trong ba ngày. Ưu tiên giao diện dùng trong sự kiện và chốt bản ổn định ngày 04/10. Nếu kiểm thử chưa đạt, giữ deployment đã vận hành và hoàn thiện phần còn lại sau sự kiện.

## 8. Phân công khi bắt đầu triển khai

- Người/agent phụ trách nền tảng: token, font, cài đặt giao diện, cỡ chữ/trình chiếu và component dùng chung.
- Người/agent phụ trách các màn: đăng nhập, đảng viên, quản trị; bắt đầu sau khi hợp đồng component dùng chung được chốt.
- Người/agent kiểm tra: đối chiếu diff nghiệp vụ, build/test, kiểm thử trình duyệt và hai xã; ghi bằng chứng cho từng tiêu chí.

Mỗi tệp chỉ có một người chỉnh tại một thời điểm. Không chạy song song các thay đổi cùng chạm `index.css`, header/menu hoặc context. Việc phân công này là kế hoạch, chưa có agent nào được khởi chạy trong lần đánh giá.

## 9. Bằng chứng và giới hạn của lần đánh giá này

- Đã đọc năm tệp người dùng gửi và đối chiếu CSS, package, Vite, router, component dùng chung, context giao diện và các điểm liên quan trong màn nghiệp vụ.
- `npm run build` trong `app`: thành công; có cảnh báo chunk JavaScript lớn, không làm build thất bại.
- `node --test tests/*.test.mjs` trong `app`: 9/9 đạt, tập trung GPS và truy vấn/xử lý dữ liệu bản đồ.
- Chưa chạy kiểm thử trình duyệt cho giao diện mới, vì chưa áp dụng giao diện mới. Chưa đánh giá tải đồng thời và chưa kiểm chứng trực tiếp mọi luồng Auth/thi/điểm danh trong lần này.
- Chưa sửa code ứng dụng, chưa đổi DB và chưa phát hành. Tệp mới duy nhất là kế hoạch này.

## 10. Tài liệu kỹ thuật dùng để đối chiếu

- [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme): theme Tailwind 4 và tham chiếu biến bằng `@theme inline`.
- [Tailwind CSS — Dark mode](https://tailwindcss.com/docs/dark-mode): cấu hình dark variant phù hợp cơ chế lựa chọn giao diện.
- [Next.js — Font optimization](https://nextjs.org/docs/app/getting-started/fonts): `next/font` là cách nạp font của Next.js, cần thích nghi cho ứng dụng này.
- [MDN — CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties): xử lý biến CSS chưa định nghĩa và fallback.

## 11. Bước tiếp theo

Khi bắt đầu thực hiện, ưu tiên giai đoạn 0–1: nhánh giao diện, bản nền, token và font tương thích Vite. Sau mỗi giai đoạn ghi file đã sửa, hành vi hoàn thành, cách kiểm thử, kết quả build, lỗi còn lại và công việc tiếp theo. Chỉ chuyển sang chỉnh các màn lớn khi nền CSS, cỡ chữ và cài đặt từng xã đã hoạt động ổn định.
