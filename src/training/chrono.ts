/** Timing helpers for sessions: a ticking clock, a beep, and keeping the phone screen on. */
import { useEffect, useState } from 'react'

/** Re-renders every `ms` while `active`, and returns the current time in ms. Based on the real clock, so it stays right in the background. */
export function useTick(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(timer)
  }, [active, ms])
  return active ? now : Date.now()
}

let audio: AudioContext | null = null

/** Must be called from a tap once, so that the browser allows sounds later. */
export function unlockSound() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

/** A short beep and a vibration; `long` for the end of a timer. */
export function beep(long = false) {
  try {
    navigator.vibrate?.(long ? [200, 100, 200] : 120)
  } catch {
    // No vibration on this device.
  }
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = long ? 660 : 880
  gain.gain.setValueAtTime(0.2, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + (long ? 0.6 : 0.18))
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + (long ? 0.6 : 0.18))
}

/** Keeps the screen on during a session, where the browser allows it. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) void l.release()
          else lock = l
        })
        .catch(() => undefined)
    void request()
    const onVisible = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
