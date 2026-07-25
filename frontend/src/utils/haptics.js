/**
 * Utility for providing haptic feedback across the application.
 * Supports Android (Vibration API) and iOS Safari / WebKit PWA (Web Audio transient pulse fallback).
 */

const HAPTICS_KEY = 'vingo_haptics_enabled';
let lastVibration = 0;
const THROTTLE_MS = 50;

// Web Audio Context singleton for iOS / Safari / Desktop browsers without navigator.vibrate
let audioCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// Web Audio synthetic haptic click generator for iOS & desktop WebKit fallback
const playAudioHaptic = (freq = 150, duration = 0.015, type = 'sine') => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio errors silently
  }
};

const isSupported = () => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

export const isEnabled = () => {
  if (typeof localStorage === 'undefined') return true;
  const setting = localStorage.getItem(HAPTICS_KEY);
  return setting === null ? true : setting === 'true';
};

export const setEnabled = (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(HAPTICS_KEY, String(value));
  }
};

const isVisible = () => {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
};

const prefersReducedMotion = () => {
  return typeof window !== 'undefined' && 
         window.matchMedia && 
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const trigger = (pattern, audioFreq = 140, audioDuration = 0.015) => {
  if (!isEnabled() || !isVisible() || prefersReducedMotion()) {
    return;
  }

  const now = Date.now();
  if (now - lastVibration < THROTTLE_MS) {
    return;
  }
  lastVibration = now;

  // 1. Trigger Vibration API (Android Chrome / Edge / Supported PWA)
  if (isSupported()) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }

  // 2. Trigger Web Audio transient tactile pulse (iOS Safari / WebKit PWA fallback)
  playAudioHaptic(audioFreq, audioDuration);
};

export const haptics = {
  light: () => trigger(12, 160, 0.012),
  medium: () => trigger(25, 120, 0.018),
  heavy: () => trigger(45, 80, 0.025),
  success: () => trigger([30, 40, 30], 220, 0.03),
  warning: () => trigger([40, 50, 40], 100, 0.035),
  error: () => trigger([80, 40, 80, 40, 80], 60, 0.04),
  selection: () => trigger(10, 180, 0.01),
  notification: () => trigger([20, 30, 20], 200, 0.02),
  impact: () => trigger(30, 110, 0.02),
};

export default haptics;
