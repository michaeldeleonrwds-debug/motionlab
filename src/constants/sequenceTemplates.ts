import type { AspectRatio, FrameRate, ResolutionPreset } from '../types/editor';

export interface SequenceTemplate {
  id: string;
  category: 'social' | 'broadcast' | 'custom';
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x' | 'broadcast' | 'custom';
  name: string;
  description: string;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  resolution: ResolutionPreset;
  defaultFps: FrameRate;
  badge?: string;
  tag: string;
}

export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  // --- INSTAGRAM ---
  {
    id: 'ig-story-reels',
    category: 'social',
    platform: 'instagram',
    name: 'Instagram Story / Reels',
    description: 'Full-screen vertical immersive video for Stories and Reels',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    resolution: '1080p',
    defaultFps: 30,
    badge: 'POPULAR',
    tag: 'Instagram',
  },
  {
    id: 'ig-post-square',
    category: 'social',
    platform: 'instagram',
    name: 'Instagram Square Post',
    description: 'Classic 1:1 feed square post and carousel video',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    resolution: '1080p',
    defaultFps: 30,
    tag: 'Instagram',
  },
  {
    id: 'ig-post-portrait',
    category: 'social',
    platform: 'instagram',
    name: 'Instagram Portrait (4:5)',
    description: 'Maximum feed screen estate portrait video',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    resolution: '1080p',
    defaultFps: 30,
    badge: 'RECOMMENDED',
    tag: 'Instagram',
  },

  // --- FACEBOOK ---
  {
    id: 'fb-story-reels',
    category: 'social',
    platform: 'facebook',
    name: 'Facebook Story / Reels',
    description: 'Vertical 9:16 story & reel placement across Meta',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    resolution: '1080p',
    defaultFps: 30,
    tag: 'Facebook',
  },
  {
    id: 'fb-post-square',
    category: 'social',
    platform: 'facebook',
    name: 'Facebook Square Feed',
    description: 'Standard 1:1 square mobile feed ad & video',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    resolution: '1080p',
    defaultFps: 30,
    tag: 'Facebook',
  },
  {
    id: 'fb-video-landscape',
    category: 'social',
    platform: 'facebook',
    name: 'Facebook Video (16:9)',
    description: 'Landscape desktop and feed featured video',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    resolution: '720p',
    defaultFps: 30,
    tag: 'Facebook',
  },
  {
    id: 'fb-cover-video',
    category: 'social',
    platform: 'facebook',
    name: 'Facebook Cover Video',
    description: 'Page header banner format (1200×675)',
    width: 1200,
    height: 675,
    aspectRatio: '16:9',
    resolution: '720p',
    defaultFps: 30,
    tag: 'Facebook',
  },

  // --- TIKTOK & SHORTS ---
  {
    id: 'tiktok-video',
    category: 'social',
    platform: 'tiktok',
    name: 'TikTok Video',
    description: 'Native 9:16 vertical full screen with high engagement',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    resolution: '1080p',
    defaultFps: 30,
    badge: 'VIRAL',
    tag: 'TikTok',
  },
  {
    id: 'yt-shorts',
    category: 'social',
    platform: 'youtube',
    name: 'YouTube Shorts',
    description: 'YouTube mobile vertical feed format',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    resolution: '1080p',
    defaultFps: 30,
    tag: 'YouTube',
  },

  // --- YOUTUBE & BROADCAST ---
  {
    id: 'yt-video-1080p',
    category: 'broadcast',
    platform: 'youtube',
    name: 'YouTube Full HD (1080p)',
    description: 'Standard 16:9 widescreen broadcast & web video',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    resolution: '1080p',
    defaultFps: 30,
    badge: 'STANDARD',
    tag: 'YouTube',
  },
  {
    id: 'broadcast-4k-uhd',
    category: 'broadcast',
    platform: 'broadcast',
    name: '4K Ultra HD Broadcast',
    description: 'Ultra high-definition master 3840×2160',
    width: 3840,
    height: 2160,
    aspectRatio: '16:9',
    resolution: '1080p',
    defaultFps: 30,
    badge: '4K',
    tag: 'Cinema',
  },
  {
    id: 'cinematic-ultrawide',
    category: 'broadcast',
    platform: 'broadcast',
    name: 'Cinematic Ultrawide (21:9)',
    description: 'Epic theatrical anamorphic aspect ratio 2560×1080',
    width: 2560,
    height: 1080,
    aspectRatio: 'custom',
    resolution: '1080p',
    defaultFps: 24,
    badge: '24 FPS',
    tag: 'Cinema',
  },

  // --- X & LINKEDIN ---
  {
    id: 'x-twitter-post',
    category: 'social',
    platform: 'x',
    name: 'X (Twitter) Feed Video',
    description: 'High conversion 16:9 timeline video (1200×675)',
    width: 1200,
    height: 675,
    aspectRatio: '16:9',
    resolution: '720p',
    defaultFps: 30,
    tag: 'X / Twitter',
  },
];
