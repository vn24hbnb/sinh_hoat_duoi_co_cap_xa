-- Shared devices are allowed. Do not retain member-to-device identifiers.
alter table public.meeting_ui_settings drop column if exists device_mapping;
