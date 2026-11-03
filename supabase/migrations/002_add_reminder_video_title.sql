-- =====================================================
-- Migration 002: Add reminder video title column
-- File: 002_add_reminder_video_title.sql
-- Date: 2026-11-03 16:30
-- Depends on: 001_fix_missing_videos_table.sql
-- Run: Supabase SQL Editor, execute once
-- =====================================================
-- Note: The Reminder type carries videoTitle for the
--       dashboard/notification display, but the reminders
--       table had no column for it, so the title vanished
--       after any cloud reload. Add the column; the row
--       mapper treats an empty string as absent.
-- -----------------------------------------------------

alter table public.reminders
  add column if not exists video_title text not null default '';
