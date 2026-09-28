"use client";

// Synthesized two-tone ring so we don't ship an audio file. Fails silently if audio is blocked.
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function burst() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const start = t + i * 0.45;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.03);
    gain.gain.setValueAtTime(0.08, start + 0.35);
    gain.gain.linearRampToValueAtTime(0, start + 0.4);
    gain.connect(ctx.destination);
    for (const f of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 0.42);
    }
  }
}

// Call from a user gesture (tap/keypress) so the context is allowed to play later.
export function primeAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

export function startRingtone() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    stopRingtone();
    burst();
    timer = setInterval(burst, 2600);
  } catch {}
}

export function stopRingtone() {
  if (timer) clearInterval(timer);
  timer = null;
}
