-- =====================================================
-- Migration 001: Fix missing videos table
-- File: 001_fix_missing_videos_table.sql
-- Date: 2026-11-03 12:30
-- Depends on: none (repairs databases initialised with the pre-fix supabase-schema.sql)
-- Run: Supabase SQL Editor, execute once
-- =====================================================
-- Note: The original supabase-schema.sql created `videos`
--       (with a foreign key to `folders`) BEFORE `folders`,
--       so a fresh run aborted at the videos statement.
--       Databases initialised that way may be missing the
--       videos table (and its indexes / RLS policy) while
--       later tables exist. This migration creates exactly
--       the missing pieces; every statement is idempotent
--       so it is a no-op on healthy databases.
-- -----------------------------------------------------

create table if not exists videos (
  id text primary key,
  user_id uuid not null default auth.uid(),
  platform text not null check (platform in ('douyin', 'bilibili', 'xiaohongshu')),
  url text not null,
  title text not null,
  author text default '',
  description text default '',
  tags text[] default '{}',
  transcript text default '',
  duration text default '',
  cover_url text default '',
  date_added date not null default current_date,
  summary text,
  key_points text[],
  status text default 'unread' check (status in ('unread', 'reading', 'done', 'starred')),
  folder_id text references folders(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_videos_user on videos(user_id);
create index if not exists idx_videos_platform on videos(platform);
create index if not exists idx_videos_status on videos(status);
create index if not exists idx_videos_folder on videos(folder_id);
create index if not exists idx_videos_date on videos(date_added desc);

alter table videos enable row level security;

drop policy if exists "user_videos" on videos;
create policy "user_videos" on videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
