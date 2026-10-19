import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../../types/music';

interface YouTubePlayerEmbedProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number; // 0 to 1
  isVideoMode: boolean;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onPlayStateChange?: (playing: boolean) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubePlayerEmbed: React.FC<YouTubePlayerEmbedProps> = ({
  currentTrack,
  isPlaying,
  volume,
  isVideoMode,
  onTimeUpdate,
  onEnded,
  onPlayStateChange,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const timeUpdateInterval = useRef<number | null>(null);

  // Extract video ID from videoId, track id (trk_yt_ or yt_), or audioUrl
  const getVideoId = (track: Track | null): string | null => {
    if (!track) return null;
    if (track.videoId && track.videoId.length >= 8) return track.videoId;
    if (track.id) {
      if (track.id.startsWith('trk_yt_')) {
        const candidate = track.id.replace('trk_yt_', '');
        if (candidate.length >= 8) return candidate;
      }
      if (track.id.startsWith('yt_')) {
        const candidate = track.id.replace('yt_', '');
        if (candidate.length >= 8) return candidate;
      }
    }
    if (track.audioUrl) {
      const m = track.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{8,15})/);
      if (m) return m[1];
    }
    return null;
  };

  const videoId = getVideoId(currentTrack);

  // Load YouTube IFrame API script
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      setIsApiReady(true);
    };
  }, []);

  // Initialize YouTube Player
  useEffect(() => {
    if (!isApiReady || !videoId || playerRef.current) return;

    try {
      playerRef.current = new window.YT.Player('flontmie-yt-embed-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            setPlayerReady(true);
            event.target.setVolume(Math.round(volume * 100));
            if (isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              onEnded();
            }
            // YT.PlayerState.PLAYING === 1
            else if (event.data === 1) {
              if (onPlayStateChange) onPlayStateChange(true);
            }
            // YT.PlayerState.PAUSED === 2
            else if (event.data === 2) {
              if (onPlayStateChange) onPlayStateChange(false);
            }
          },
          onError: (e: any) => {
            console.warn('YouTube Player error:', e.data);
          }
        }
      });
    } catch (err) {
      console.warn('Error creating YT.Player:', err);
    }
  }, [isApiReady, videoId]);

  // Load new track when videoId changes
  useEffect(() => {
    if (playerReady && playerRef.current && videoId) {
      try {
        const currId = playerRef.current.getVideoData?.()?.video_id;
        if (currId !== videoId) {
          if (isPlaying) {
            playerRef.current.loadVideoById(videoId);
          } else {
            playerRef.current.cueVideoById(videoId);
          }
        }
      } catch (e) {
        console.warn('Failed to switch YouTube video:', e);
      }
    }
  }, [videoId, playerReady]);

  // Handle Play / Pause sync
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState?.();
      if (isPlaying && state !== 1 && state !== 3) {
        playerRef.current.playVideo?.();
      } else if (!isPlaying && state === 1) {
        playerRef.current.pauseVideo?.();
      }
    } catch (e) {}
  }, [isPlaying, playerReady]);

  // Handle Volume change
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    try {
      playerRef.current.setVolume?.(Math.round(volume * 100));
    } catch (e) {}
  }, [volume, playerReady]);

  // Time tracker loop
  useEffect(() => {
    if (timeUpdateInterval.current) {
      window.clearInterval(timeUpdateInterval.current);
    }

    if (isPlaying && playerReady && playerRef.current) {
      timeUpdateInterval.current = window.setInterval(() => {
        try {
          if (playerRef.current && playerRef.current.getCurrentTime) {
            const cur = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || (currentTrack?.duration || 180);
            onTimeUpdate(cur, dur);
          }
        } catch (e) {}
      }, 500);
    }

    return () => {
      if (timeUpdateInterval.current) {
        window.clearInterval(timeUpdateInterval.current);
      }
    };
  }, [isPlaying, playerReady, currentTrack]);

  // Fallback direct seek handler listener on window
  useEffect(() => {
    const handleSeekEvent = (e: CustomEvent) => {
      if (playerReady && playerRef.current && typeof e.detail === 'number') {
        try {
          playerRef.current.seekTo(e.detail, true);
        } catch (err) {}
      }
    };

    window.addEventListener('flontmie:seek' as any, handleSeekEvent);
    return () => {
      window.removeEventListener('flontmie:seek' as any, handleSeekEvent);
    };
  }, [playerReady]);

  if (!videoId) return null;

  return (
    <div
      ref={containerRef}
      className={
        isVideoMode
          ? 'w-full h-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10'
          : 'fixed -bottom-96 -left-96 w-1 h-1 opacity-0 pointer-events-none'
      }
    >
      <div id="flontmie-yt-embed-player" className="w-full h-full" />
    </div>
  );
};
