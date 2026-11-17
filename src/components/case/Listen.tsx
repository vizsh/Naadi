'use client';
import { useEffect, useRef, useState } from 'react';
import { play, stop, synth, type SoundKind } from '@/lib/audio/synth';
import { Icon } from '@/components/shell/Icons';

const LABEL: Record<SoundKind, string> = { base: 'Healthy week', now: 'Now', env: 'Now, demodulated' };

function drawWave(canvas: HTMLCanvasElement, data: Float32Array) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const c = canvas.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, r.width, r.height);
  const step = Math.max(1, Math.floor(data.length / r.width));
  c.fillStyle = '#17191C';
  for (let x = 0; x < r.width; x++) {
    let lo = 1, hi = -1;
    for (let i = x * step; i < (x + 1) * step && i < data.length; i++) { if (data[i] < lo) lo = data[i]; if (data[i] > hi) hi = data[i]; }
    const y0 = (0.5 - hi * 0.48) * r.height, y1 = (0.5 - lo * 0.48) * r.height;
    c.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }
}

export function Listen() {
  const wave = useRef<HTMLCanvasElement>(null);
  const cache = useRef<Partial<Record<SoundKind, Float32Array>>>({});
  const [on, setOn] = useState<SoundKind | null>(null);
  const get = (k: SoundKind) => (cache.current[k] = cache.current[k] ?? synth(k));
  useEffect(() => {
    if (wave.current) drawWave(wave.current, get('now'));
    return () => stop();
  }, []);
  const click = async (k: SoundKind) => {
    if (on === k) { stop(); setOn(null); return; }
    const d = get(k);
    if (wave.current) drawWave(wave.current, d);
    setOn(k);
    await play(d, () => setOn((cur) => (cur === k ? null : cur)));
  };
  return (
    <>
      <div className="listen">
        {(Object.keys(LABEL) as SoundKind[]).map((k) => (
          <button key={k} type="button" className="btn sound" aria-pressed={on === k} onClick={() => click(k)}>
            <Icon name={on === k ? 'stop' : 'speaker'} />{LABEL[k]}
          </button>
        ))}
      </div>
      <canvas ref={wave} className="wave-canvas" aria-hidden="true" />
      <p className="fine">Synthesised from the bearing model: 100 Hz magnetic hum, shaft at 23.9 Hz, and an impact at every ball pass ringing the housing near 3.2 kHz. Real recordings replace this in the field build.</p>
    </>
  );
}
