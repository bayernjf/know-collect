import type { Video, VideoStatus } from '../types';

export type VideoFilter =
  | 'all'
  | 'douyin'
  | 'bilibili'
  | 'xiaohongshu'
  | 'summarized'
  | 'unsummarized'
  | VideoStatus;

const STATUS_FILTERS: readonly VideoFilter[] = ['unread', 'reading', 'done', 'starred'];

/** 列表过滤与 tab 计数共用同一套判定，避免两处逻辑漂移。 */
export function matchesFilter(video: Video, filter: VideoFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'summarized') return Boolean(video.summary);
  if (filter === 'unsummarized') return !video.summary;
  if (STATUS_FILTERS.includes(filter)) return (video.status || 'unread') === filter;
  return video.platform === filter;
}

export function countForFilter(videos: Video[], filter: VideoFilter): number {
  return videos.filter((video) => matchesFilter(video, filter)).length;
}

/** store 约定新视频插到数组头部，因此“最近收藏”取前 N 条（而不是尾部）。 */
export function selectRecent(videos: Video[], limit: number): Video[] {
  return videos.slice(0, limit);
}
