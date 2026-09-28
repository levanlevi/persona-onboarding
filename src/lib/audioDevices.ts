"use client";

// Mic/speaker selection. The common failure on Macs: Chrome's default input is the
// iPhone (Continuity) mic or AirPods switch devices mid-call, so the user hears nothing
// or the agent hears nothing. We avoid the Continuity mic by default and remember choices.

const MIC_KEY = "persona-mic";
const SPEAKER_KEY = "persona-speaker";

const MIC_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const isVirtual = (d: MediaDeviceInfo) => d.deviceId === "default" || d.deviceId === "communications";
const isContinuity = (label: string) => /iphone|ipad|continuity/i.test(label);

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

export async function listDevices() {
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: all.filter((d) => d.kind === "audioinput" && !isVirtual(d)),
    outputs: all.filter((d) => d.kind === "audiooutput" && !isVirtual(d)),
  };
}

export const canPickSpeaker = () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

/** Opens the mic: saved choice first, otherwise the system default unless it's the iPhone mic. */
export async function openMic(deviceId?: string): Promise<MediaStream> {
  const wanted = deviceId ?? read(MIC_KEY) ?? undefined;
  let stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...MIC_CONSTRAINTS,
      // An explicit pick must be honored; a remembered one may be gone (AirPods off), so it's only preferred.
      ...(wanted ? { deviceId: deviceId ? { exact: wanted } : { ideal: wanted } } : {}),
    },
  });
  if (deviceId) {
    write(MIC_KEY, deviceId);
    return stream;
  }
  const label = stream.getAudioTracks()[0]?.label ?? "";
  if (isContinuity(label)) {
    const { inputs } = await listDevices();
    const alt = inputs.find((d) => !isContinuity(d.label));
    if (alt) {
      stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...MIC_CONSTRAINTS, deviceId: { exact: alt.deviceId } },
      });
    }
  }
  return stream;
}

export async function applySpeaker(el: HTMLAudioElement, deviceId?: string) {
  if (!canPickSpeaker()) return;
  const id = deviceId ?? read(SPEAKER_KEY);
  if (!id) return;
  try {
    await (el as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(id);
    if (deviceId) write(SPEAKER_KEY, deviceId);
  } catch {
    // Saved speaker no longer exists (e.g. AirPods disconnected): fall back to system default.
  }
}

export const currentSpeakerId = (el: HTMLAudioElement | null) =>
  (el as (HTMLAudioElement & { sinkId?: string }) | null)?.sinkId ?? "";

export function shortLabel(label: string) {
  return (
    label
      .replace(/^(Default|Communications)\s*-\s*/i, "")
      .replace(/\s*\((Built-in|Bluetooth|Virtual|[0-9a-f]{4}:[0-9a-f]{4})\)/gi, "")
      .trim() || "Unknown device"
  );
}
