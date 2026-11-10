import { describe, expect, it } from 'vitest';
import { countForFilter, matchesFilter, selectRecent } from './videoList';
import type { Video } from '../types';

function makeVideo(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    platform: 'douyin',
    url: `https://example.com/${id}`,
    title: id,
    tags: [],
    dateAdded: '2026-11-03',
    summary: null,
    keyPoints: null,
    status: 'unread',
    folderId: null,
    ...overrides,
  };
}

describe('selectRecent', () => {
  it('returns the newest videos from the head of the list', () => {
    // store 约定：新视频 unshift 到头部。
    const videos = [makeVideo('newest'), makeVideo('middle'), makeVideo('oldest')];
    expect(selectRecent(videos, 2).map((v) => v.id)).toEqual(['newest', 'middle']);
  });

  it('handles a shorter list without reversing it', () => {
    const videos = [makeVideo('a'), makeVideo('b')];
    expect(selectRecent(videos, 6).map((v) => v.id)).toEqual(['a', 'b']);
  });
});

describe('matchesFilter / countForFilter', () => {
  const videos = [
    makeVideo('unread-1', { status: 'unread' }),
    makeVideo('unread-2', { status: 'unread' }),
    makeVideo('reading', { status: 'reading' }),
    makeVideo('done', { status: 'done' }),
    makeVideo('starred', { status: 'starred' }),
    makeVideo('bili', { platform: 'bilibili', status: 'done' }),
    makeVideo('summarized', { status: 'unread', summary: '有总结' }),
  ];

  it('counts status tabs instead of falling back to platform', () => {
    expect(countForFilter(videos, 'unread')).toBe(3); // 含 summarized 那条
    expect(countForFilter(videos, 'reading')).toBe(1);
    expect(countForFilter(videos, 'done')).toBe(2);
    expect(countForFilter(videos, 'starred')).toBe(1);
  });

  it('counts platform and summary tabs', () => {
    expect(countForFilter(videos, 'douyin')).toBe(6);
    expect(countForFilter(videos, 'bilibili')).toBe(1);
    expect(countForFilter(videos, 'summarized')).toBe(1);
    expect(countForFilter(videos, 'unsummarized')).toBe(6);
  });

  it('matches list filtering with the same rule used for counts', () => {
    expect(matchesFilter(videos[1], 'unread')).toBe(true);
    expect(matchesFilter(videos[5], 'unread')).toBe(false);
    expect(matchesFilter(videos[0], 'all')).toBe(true);
  });
});
