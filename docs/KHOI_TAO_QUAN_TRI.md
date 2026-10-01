# Khởi tạo ba tài khoản quản trị lần đầu

Migration tạo hai xã và hai chi bộ Mường La, nhưng không tạo Auth users hay mật khẩu quản trị. Việc tạo Auth users cần diễn ra qua Supabase Auth để mật khẩu được Supabase băm; tuyệt đối không chèn mật khẩu vào SQL hoặc commit vào Git.

## Tạo Auth users

Trong Supabase project `tdgiunafijgyxlqfdwgv`, mở Authentication → Users → Add user. Tạo ba người dùng đã xác nhận email với các email kỹ thuật sau (đây không phải địa chỉ liên hệ):

- `admin-muongla@admins.internal`
- `admin-chienglao@admins.internal`
- `admin-global@admins.internal`

Đặt mật khẩu theo quyết định của chủ dự án và lưu an toàn ngoài repository. Đánh dấu email là confirmed/verified vì các email kỹ thuật này không nhận thư xác minh.

## Gắn vai trò ứng dụng

Sau khi tạo đủ ba Auth users, chạy truy vấn dưới đây trong Supabase SQL Editor. Truy vấn chỉ dùng ID và email Auth để gắn hồ sơ; không đọc hoặc ghi mật khẩu.

```sql
insert into public.app_users (id, organization_id, username, role, must_change_password, is_active)
select
  u.id,
  case
    when u.email = 'admin-muongla@admins.internal' then o.id
    when u.email = 'admin-chienglao@admins.internal' then o.id
    else null
  end,
  case
    when u.email = 'admin-muongla@admins.internal' then 'admin@muongla'
    when u.email = 'admin-chienglao@admins.internal' then 'admin@chienglao'
    else 'admin@'
  end,
  case when u.email = 'admin-global@admins.internal' then 'super_admin' else 'admin' end,
  false,
  true
from auth.users u
left join public.organizations o on o.slug = case
  when u.email = 'admin-muongla@admins.internal' then 'muong-la'
  when u.email = 'admin-chienglao@admins.internal' then 'chieng-lao'
  else null
end
where u.email in (
  'admin-muongla@admins.internal',
  'admin-chienglao@admins.internal',
  'admin-global@admins.internal'
)
and (u.email = 'admin-global@admins.internal' or o.id is not null)
on conflict (id) do update set
  organization_id = excluded.organization_id,
  username = excluded.username,
  role = excluded.role,
  is_active = true,
  updated_at = now();
```

Kiểm tra kết quả không bao gồm mật khẩu:

```sql
select username, role, organization_id, is_active
from public.app_users
where username in ('admin@muongla', 'admin@chienglao', 'admin@');
```

## Nhập danh sách đảng viên

Đăng nhập bằng quản trị chung, vào mục Đảng viên, chọn xã/chi bộ, rồi tải Excel để xem trước và nhập. Trình nhập chỉ gửi Họ và tên, ngày sinh; không đưa tệp Excel vào Git. Chiềng Lao chỉ nhập sau khi nhận đủ tên chi bộ và danh sách được xác nhận.

Trước khi mở dùng thật, từng xã cần tự cấu hình địa điểm và giờ điểm danh; ngân hàng câu hỏi của mỗi xã phải được nhập riêng. Mật khẩu thành viên mặc định được tạo ở máy chủ khi tạo tài khoản; thành viên có thể tự đổi sau khi đăng nhập.
