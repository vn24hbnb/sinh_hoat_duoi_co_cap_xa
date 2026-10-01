# Sinh hoạt chính trị dưới nghi thức chào cờ — triển khai cấp xã

Bản triển khai riêng cho xã Mường La và xã Chiềng Lao, dùng một dự án Supabase chung và tách dữ liệu theo xã. Không thay đổi ứng dụng nguồn.

## Chạy và dựng ứng dụng

Ứng dụng nằm trong thư mục `app/`.

1. Sao chép `app/.env.example` thành `app/.env.local`.
2. Điền URL và publishable/anon key lấy từ Supabase project dành cho hai xã. Không đưa service-role key vào biến `VITE_*`.
3. Trong `app/`, chạy `npm ci`, sau đó `npm run dev` để chạy thử hoặc `npm run build` để tạo bản dựng trong `app/dist/`.

## Cấu hình triển khai Vercel thủ công

- Import repository này vào tài khoản Vercel `vn24h.bnb`.
- Chọn Root Directory là `app`.
- Framework: Vite; Build Command: `npm run build`; Output Directory: `dist`.
- Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong Vercel Project Settings → Environment Variables cho Production (và Preview nếu cần).
- Không thêm Supabase service-role key vào Vercel frontend variables.
- Deploy thủ công sau khi đã áp dụng migration, tạo tài khoản quản trị và kiểm thử đăng nhập.

Các bước khởi tạo quản trị lần đầu ở `docs/KHOI_TAO_QUAN_TRI.md`.
