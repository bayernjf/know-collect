-- VideoVault Supabase Schema
-- 在 Supabase SQL Editor 中执行此文件

-- 视频表
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

-- 文件夹/合集表
create table if not exists folders (
  id text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  icon text default '📁',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 报告表
create table if not exists reports (
  id text primary key,
  user_id uuid not null default auth.uid(),
  title text not null,
  date text not null,
  video_count int default 0,
  platforms text[] default '{}',
  tags text[] default '{}',
  content text not null,
  video_ids text[] default '{}',
  created_at timestamptz default now()
);

-- AI 模型配置表
create table if not exists ai_configs (
  id text primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  provider text not null default 'openai',
  api_base_url text not null,
  api_key text not null,
  model_name text not null,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 笔记表
create table if not exists notes (
  id text primary key,
  user_id uuid not null default auth.uid(),
  video_id text not null references videos(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 学习提醒表（间隔重复）
create table if not exists reminders (
  id text primary key,
  user_id uuid not null default auth.uid(),
  video_id text not null references videos(id) on delete cascade,
  due_date timestamptz not null,
  interval_days int not null default 1,
  repetition int not null default 0,
  status text not null default 'active' check (status in ('active', 'snoozed')),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- 索引
create index if not exists idx_videos_user on videos(user_id);
create index if not exists idx_videos_platform on videos(platform);
create index if not exists idx_videos_status on videos(status);
create index if not exists idx_videos_folder on videos(folder_id);
create index if not exists idx_videos_date on videos(date_added desc);
create index if not exists idx_folders_user on folders(user_id);
create index if not exists idx_reports_user on reports(user_id);
create index if not exists idx_ai_configs_user on ai_configs(user_id);
create index if not exists idx_notes_video on notes(video_id);
create index if not exists idx_reminders_user on reminders(user_id);
create index if not exists idx_reminders_due on reminders(due_date);

-- RLS (Row Level Security)
alter table videos enable row level security;
alter table folders enable row level security;
alter table reports enable row level security;
alter table ai_configs enable row level security;
alter table notes enable row level security;
alter table reminders enable row level security;

-- 用户只能访问自己的数据
create policy "user_videos" on videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_folders" on folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_reports" on reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_ai_configs" on ai_configs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_notes" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_reminders" on reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
