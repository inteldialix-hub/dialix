'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, MicOff, Volume2, Volume1, VolumeX, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface AudioPlayerProps {
  src: string | null;
  loading: boolean;
  error: boolean;
  duration?: number;
  conversationId: string;
  token: string;
  provider?: string;
}

function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Generate pseudo-random waveform bars for visual effect
function generateWaveform(count: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = 0.2;
    const variation = Math.sin(i * 0.15) * 0.3 + Math.sin(i * 0.4) * 0.2;
    const noise = (Math.sin(i * 2.3 + 7) * Math.cos(i * 1.7 + 3)) * 0.25;
    bars.push(Math.min(1, Math.max(0.1, base + variation + noise)));
  }
  return bars;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const BAR_COUNT = 64; // Adjusted for a clean dense look

export default function AudioPlayer({
  src, loading, error, duration: fallbackDuration,
  conversationId, token, provider,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const waveform = useMemo(() => generateWaveform(BAR_COUNT), []);

  const effectiveDuration = duration || fallbackDuration || 0;

  // Audio event handlers
  const onTimeUpdate = useCallback(() => {
    if (audioRef.current && !isDragging) {
      const ct = audioRef.current.currentTime;
      setCurrentTime(ct);
      setProgress(audioRef.current.duration ? (ct / audioRef.current.duration) * 100 : 0);
    }
  }, [isDragging]);

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const onEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const onError = useCallback(() => {
    // handled by parent
  }, []);

  // Play / Pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current || error || !src) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, error, src]);

  // Seek via waveform click
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!audioRef.current || !src || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    // Update local state immediately for snappy UI
    setProgress(pct * 100);
    const newTime = pct * (audioRef.current.duration || effectiveDuration);
    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;
  }, [src, effectiveDuration]);

  // Drag seeking for smooth scrubbing
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handleSeek(e);
    }
  }, [isDragging, handleSeek]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handleSeek(e);
      setIsDragging(false);
    }
  }, [isDragging, handleSeek]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Speed control
  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(speed);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  // Volume
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
    } else {
      setVolume(prevVolume);
      if (audioRef.current) audioRef.current.volume = prevVolume;
    }
  }, [volume, prevVolume]);

  // Download
  const handleDownload = useCallback(async () => {
    if (!src) return;
    try {
      let blob: Blob;
      if (src.startsWith('blob:')) {
        const resp = await fetch(src);
        blob = await resp.blob();
      } else if (src.startsWith('http')) {
        const resp = await fetch(src);
        blob = await resp.blob();
      } else {
        const providerParam = provider === 'vapi' ? '?provider=vapi' : '';
        const resp = await fetch(`${API_BASE}/api/calls/conversation/${conversationId}/audio${providerParam}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        blob = await resp.blob();
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-${conversationId.slice(0, 12)}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [src, conversationId, token, provider]);

  // No recording state
  if (!loading && (error || !src)) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <MicOff className="size-5 text-muted-foreground mx-auto mb-2" />
        <span className="text-sm text-muted-foreground">No recording available</span>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="size-5 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin mx-auto mb-2" />
        <span className="text-sm text-muted-foreground">Loading audio...</span>
      </div>
    );
  }

  return (
    <div 
      className="rounded-lg border border-border bg-card p-4"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      {src && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onError={onError}
          preload="metadata"
        />
      )}

      <div className="flex items-center gap-3">
        {/* Play Button */}
        <button 
          className="flex size-9 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors shrink-0"
          onClick={togglePlay} 
          disabled={!src}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </button>

        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{fmtTime(currentTime)}</span>

        {/* Waveform Area */}
        <div
          className="flex-1 flex items-center gap-px h-12 cursor-pointer"
          ref={progressRef}
          onMouseDown={(e) => {
            setIsDragging(true);
            handleSeek(e);
          }}
        >
          {waveform.map((h, i) => {
            const barPct = (i / BAR_COUNT) * 100;
            const isPlayed = barPct <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-colors",
                  isPlayed ? "bg-foreground" : "bg-muted-foreground/30"
                )}
                style={{ height: `${Math.max(12, h * 100)}%` }}
              />
            );
          })}
        </div>

        <span className="text-xs text-muted-foreground tabular-nums w-10">{fmtTime(effectiveDuration)}</span>
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
        <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors" onClick={cycleSpeed} title="Playback speed">
          {speed}x Speed
        </button>

        <div className="flex items-center gap-2">
          <button className="text-muted-foreground hover:text-foreground" onClick={toggleMute} title={volume === 0 ? 'Unmute' : 'Mute'}>
            {volume === 0 ? <VolumeX className="size-4" /> : volume < 0.5 ? <Volume1 className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 accent-foreground"
          />
        </div>

        <div className="flex-1" />

        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors" onClick={handleDownload} title="Download recording">
          <Download className="size-3.5" /> Download
        </button>
      </div>
    </div>
  );
}
