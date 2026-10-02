# Bàn giao sửa bản đồ, báo cáo và tách dữ liệu hai xã

Ngày kiểm tra: 02/10/2026. Repo: sinh-hoat-duoi-co-cap-xa. Nhánh: codex/ui-refresh-hai-xa.

## Kết quả

Đã sửa mã nguồn và kiểm tra tại máy. Chưa đẩy GitHub hoặc triển khai Vercel. Không sửa schema, migration, RLS, tài khoản, mật khẩu, quy tắc điểm danh hay thuật toán chấm thi. Không tạo phiên thử, không ghi điểm danh/bài thi thử vào DB.

### Bản đồ

- Nguyên nhân cũ: cả ba màn hình vẫn khởi tạo Mapbox GL, dù nút ghi Google. Mapbox yêu cầu token hợp lệ; nhật ký trình duyệt cũ có lỗi thiếu token. Các đường dẫn tile Google cũ không phải tích hợp Maps JavaScript API chính thức.
- Người dùng xác nhận chuyển sang Esri vệ tinh do chưa có Google API key và không muốn dùng dịch vụ có phí.
- Thay bằng Leaflet + nền Esri World Imagery; có lựa chọn OpenStreetMap đường phố, ghi nguồn ảnh và nút mở Google Maps. Không còn yêu cầu VITE_MAPBOX_TOKEN, không cần tạo biến môi trường bản đồ mới.
- Giữ chọn vị trí bằng click/kéo, dán tọa độ và tìm địa điểm; giữ vòng bán kính, marker thành viên, tập trung vào thành viên, sao chép tọa độ, zoom và toàn màn hình. Màn điểm danh giữ marker thiết bị, hội trường và đường nối hai điểm.
- Không thay đổi GPS gửi lên server, giới hạn sai số, bán kính cấu hình hoặc kết luận gps_valid từ server.
- Leaflet và type definitions được khóa phiên bản 1.9.4 / 1.9.22. Bộ npm audit production: 0 lỗ hổng được báo cáo.
- Đã xác minh ảnh Esri tải thực sự trên bản dựng: các ảnh tile có naturalWidth 256, hiển thị ảnh vệ tinh và marker. Tọa độ trong ảnh minh chứng chỉ được nhập tạm để thử và đã hủy; không phải địa điểm hội trường được lưu.

Nguồn và điều kiện sử dụng: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), [Leaflet](https://leafletjs.com/examples/quick-start/), [OSM tile usage](https://operations.osmfoundation.org/policies/tiles/). Không cấu hình thanh toán hay API có phí. Dịch vụ ảnh công khai vẫn phụ thuộc điều kiện cấp phép, nguồn cung và mạng; không cam kết miễn phí vô hạn/SLA. Không tải hàng loạt hoặc cache để dùng ngoại tuyến, không bỏ attribution. Ứng dụng không gửi tên đảng viên lên dịch vụ nền bản đồ; trình duyệt vẫn gửi yêu cầu ảnh theo vùng đang xem.

### Tách dữ liệu

- Nguyên nhân bảng xếp hạng trộn: reportService lấy tất cả chi_bos đang hoạt động mà không lọc organization_id. Quản trị chung được quyền đọc cả hai xã nên RLS không tự hiểu xã đang chọn trên màn hình.
- Báo cáo hiện kiểm tra phiên thuộc đúng organization_id; người tham gia, điểm danh, kết quả thi, chi bộ và top cá nhân đều lọc rõ organization_id; dữ liệu theo phiên vẫn lọc meeting_session_id. Top cá nhân kiểm tra cả đơn vị của quan hệ members.
- Chụp organization_id một lần khi bắt đầu tác vụ, không đọc lại xã đang chọn sau từng await. Trang báo cáo tiếp tục bỏ kết quả yêu cầu cũ; khi đổi phiên, xóa ngay báo cáo cũ và hiển thị trạng thái tải để tránh xuất nhầm hồ sơ.
- Bản đồ kiểm tra phiên thuộc xã trước khi tải GPS; lọc GPS bằng cả organization_id và meeting_session_id. Cache hội trường có khóa xã + phiên. Dropdown chi bộ chỉ lấy xã đang chọn; lọc điểm theo ID chi bộ, không theo tên trùng.
- Quy tắc xếp hạng, mẫu số tính trung bình, số câu và thời gian thi không thay đổi. Bộ xuất CSV/Excel sử dụng đúng báo cáo đã tách; Word/PDF dùng nội dung màn hình đã tách.

### Bố cục laptop

- Nguyên nhân: hàng ngang chứa cả tiêu đề, dropdown và nhiều nút có độ rộng không co được, làm tiêu đề bị ép thành cột hẹp.
- Tách thành các hàng: tiêu đề đầy đủ → chọn hồ sơ phiên → nhóm thao tác có xuống dòng. Đã kiểm tra bản dựng ở 1366px: vùng tiêu đề 1216px, scrollWidth = viewport width; không tràn ngang. 390px cũng không tràn ngang.

## File thay đổi

- app/src/components/ui/SatelliteMap.tsx (mới): bản đồ dùng chung, marker, vòng bán kính, xử lý lỗi tile, ResizeObserver và cleanup.
- app/src/pages/admin/AdminLiveMap.tsx, MeetingManager.tsx; app/src/pages/member/Attendance.tsx: thay trình vẽ, giữ xử lý nghiệp vụ.
- app/src/pages/admin/AdminReports.tsx: bố cục và xóa dữ liệu cũ khi đổi phiên; truyền đơn vị rõ ràng.
- app/src/services/reportService.ts, mapAttendanceService.ts: phạm vi xã/phiên và cache.
- app/src/index.css, package.json, package-lock.json: kiểu marker và thư viện bản đồ.
- app/tests/tenant-report.test.mjs (mới), map-attendance.test.mjs, ui-regression.test.mjs, load-service.mjs, ui-preview.tsx; app/scripts/check-ui-lint.mjs: kiểm thử và đối chiếu.
- docs/screenshots/esri-ve-tinh-20261002.png: minh chứng bản đồ.

Các ngoại lệ trong kiểm thử đối chiếu mã gốc chỉ giới hạn ở phần bản đồ/báo cáo được yêu cầu và hai thư viện mới. Dịch vụ Auth, điểm danh, thi, schema, RLS, bảo vệ đường dẫn và những handler nghiệp vụ khác tiếp tục được kiểm tra không đổi.

## Kiểm chứng

- npm run build: đạt, còn cảnh báo chunk lớn của trang câu hỏi như trước.
- node --test tests/*.test.mjs: 21/21 đạt.
- node scripts/check-ui-lint.mjs: không phát sinh lỗi/cảnh báo mới. 33 file được đối chiếu có 147 lỗi nguồn, hiện còn 128; không tuyên bố toàn repo sạch lint.
- git diff --check: đạt.
- Giả lập hai phiên cùng ngày, chi bộ trùng tên: báo cáo, chi bộ gương mẫu dùng danh sách riêng, top cá nhân, điểm số và CSV không lẫn.
- Giả lập đổi xã giữa yêu cầu đang tải; phiên sai xã bị từ chối; thiếu xã không tải tổng hợp tất cả; hai bản đồ đồng thời có tọa độ/cache riêng.
- Thực tế trình duyệt: Mường La chỉ hiện 2 chi bộ; đổi sang Chiềng Lao không còn tên phiên hoặc chi bộ Mường La. Bản đồ Chiềng Lao chỉ có 13 chi bộ. Bản dựng cuối trang báo cáo mới mở không có lỗi/cảnh báo console.
- Kiểm tra DB chỉ đọc: FK ghép organization_id + phiên/member/chi bộ ngăn liên kết khác xã; UNIQUE theo phiên/member ngăn điểm danh trùng trong cùng phiên. RLS quản trị xã theo quyền can_manage/can_read; quản trị chung được đọc cả hai, nên UI phải lọc như bản sửa.
- Truy vấn kiểm tra sai xã ở meeting_participants, meeting_attendance, exam_attempts: 0 bản ghi vi phạm trong dữ liệu hiện có.

## Giới hạn còn lại và việc cần làm

Hiện DB có 1 phiên active của Mường La, 0 phiên của Chiềng Lao; phiên Mường La chưa có điểm danh/bài thi và chưa cấu hình tọa độ hội trường. Không coi các kiểm tra giả lập là thử tải/điểm danh đồng thời production. Chưa kiểm thử ghi GPS/nộp bài thực địa hoặc thiết bị iPhone/Safari thật.

Trước ngày sử dụng:

1. Đẩy nhánh lên GitHub và triển khai Preview trên Vercel bằng tài khoản đúng. Vẫn Root Directory app và cấu hình Supabase công khai hiện có; không cần key Google/Mapbox. Chưa tự thay thế Production trong đợt này.
2. Từng xã tạo/chọn phiên riêng, nhập đúng tọa độ hội trường, bán kính 200m và thời gian điểm danh/thi; không lấy tọa độ minh chứng làm địa điểm thực.
3. Trong phiên thử được phép, dùng thành viên mỗi xã để điểm danh và nộp bài đồng thời; kiểm tra người tham gia, báo cáo, vinh danh và các bản xuất chỉ thuộc xã/meeting_session_id đang chọn.
4. Quản trị chung phải kiểm tra nhãn xã trên header trước thao tác, nhất là sau reload hoặc phiên Auth được làm mới (hành vi chọn mặc định của bản nguồn không thay đổi).
5. Nghiệm thu rồi triển khai Production. Nếu có lỗi, quay lại deployment trước; không cần rollback DB vì không có thay đổi DB.

Không đưa files.zip, thư mục tài liệu nguồn files/, danh sách đảng viên, khóa truy cập hoặc mật khẩu vào commit.
# Bổ sung ngày 02/10/2026: vệ tinh có tên đường và địa danh

- Sửa `app/src/components/ui/SatelliteMap.tsx`: chồng hai lớp Esri `World_Transportation` và `World_Boundaries_and_Places` lên ảnh vệ tinh, mặc định bật.
- Có nút **Ẩn tên đường / Hiện tên đường**; lớp nhãn không bắt sự kiện chuột, nằm dưới marker và không đổi tọa độ, GPS, bán kính hay dữ liệu nghiệp vụ.
- Kiểm tra trình duyệt tại `http://127.0.0.1:4173/tests/ui-preview.html`: 24 tile nhãn tải thành công, thấy tên đường Lê Lợi, Chu Văn Thịnh và Thành phố Sơn La. Khi ẩn, nhãn được gỡ, ảnh và vòng bán kính vẫn còn; bật lại hoạt động, không có lỗi console.
- `npm run build` thành công; 21/21 kiểm thử đạt; kiểm tra lint không có lỗi mới. Cảnh báo kích thước bundle có sẵn vẫn còn.
- Chỉ sửa local, chưa push/deploy. Sau triển khai, mặc định tên đường sẽ xuất hiện ở cả chọn hội trường, bản đồ giám sát và bản đồ điểm danh.
- Đây là tên đường/địa danh tham khảo, **không bảo đảm địa chỉ số nhà hoặc tên hành chính mới đầy đủ**. Hai dịch vụ nhãn hiện công bố ở trạng thái mature support, không còn cập nhật; giữ chức năng tìm địa điểm và mở Google Maps để đối chiếu. Không thêm geocoding tự động cho vị trí cá nhân.
- Nguồn dịch vụ: [Địa danh](https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer), [Đường giao thông](https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer).
