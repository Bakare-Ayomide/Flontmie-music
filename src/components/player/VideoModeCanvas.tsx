import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { Track } from '../../types/music';

interface VideoModeCanvasProps {
  currentTrack: Track | null;
  isPlaying: boolean;
}

export const VideoModeCanvas: React.FC<VideoModeCanvasProps> = ({ currentTrack, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let hue = 0;

    const render = () => {
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // Dark translucent clear for motion blur trail
      ctx.fillStyle = 'rgba(10, 10, 12, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const freqData = audioEngine.getAnalyserData();
      const numBars = 48;
      const barWidth = width / numBars;

      hue = (hue + 0.3) % 360;

      // Draw center pulsating bass ring
      const centerX = width / 2;
      const centerY = height / 2;
      const bassVal = freqData ? freqData[2] || 20 : (isPlaying ? 50 + Math.sin(Date.now() / 200) * 30 : 20);
      const ringRadius = 50 + (bassVal / 255) * 80;

      const grad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, ringRadius * 1.4);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
      grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw frequency bars across bottom
      for (let i = 0; i < numBars; i++) {
        let value = 10;
        if (freqData && freqData.length > 0) {
          const index = Math.floor((i / numBars) * (freqData.length * 0.7));
          value = freqData[index] || 10;
        } else if (isPlaying) {
          value = 40 + Math.sin(i * 0.3 + Date.now() / 150) * 35;
        }

        const barHeight = Math.max(4, (value / 255) * (height * 0.65));
        const x = i * barWidth;
        const y = height - barHeight;

        const barGrad = ctx.createLinearGradient(0, y, 0, height);
        barGrad.addColorStop(0, `hsl(${(hue + i * 4) % 360}, 85%, 60%)`);
        barGrad.addColorStop(1, 'rgba(239, 68, 68, 0.2)');

        ctx.fillStyle = barGrad;
        ctx.fillRect(x + 1.5, y, barWidth - 3, barHeight);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  return (
    <div className="relative w-full h-full min-h-[360px] max-h-[520px] rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-full object-cover"
      />

      {/* Center Track Artwork & Info Overlay */}
      {currentTrack && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="w-48 h-48 md:w-60 md:h-60 rounded-xl overflow-hidden shadow-2xl border border-white/20 relative group">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
              <div className="text-left w-full">
                <span className="text-[10px] uppercase font-bold tracking-widest text-red-400">Now Streaming</span>
                <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
                <p className="text-xs text-neutral-300 truncate">{currentTrack.artist}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-neutral-300">
            <span>Video Canvas Mode</span>
            <span aria-hidden="true">·</span>
            <span>{currentTrack.genre.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>{currentTrack.bpm} BPM</span>
          </div>
        </div>
      )}
    </div>
  );
};
