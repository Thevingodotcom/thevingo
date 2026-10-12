import { useState, useEffect, useCallback } from 'react';

export const RESEND_OTP_COOLDOWN_SECONDS = 60;

/** Formats a number of seconds as m:ss (e.g. 59 -> "0:59"). */
export const formatCountdown = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Countdown used to throttle "Resend OTP".
 * The timer is anchored to a wall-clock end time so it stays accurate even if
 * the tab is throttled in the background. The interval is cleared on unmount.
 *
 * @param {number} duration Cooldown length in seconds.
 * @param {boolean} startImmediately Start counting down on mount (OTP was just sent).
 */
const useResendTimer = (duration = RESEND_OTP_COOLDOWN_SECONDS, startImmediately = true) => {
  const [endsAt, setEndsAt] = useState(() => (startImmediately ? Date.now() + duration * 1000 : 0));
  const [secondsLeft, setSecondsLeft] = useState(startImmediately ? duration : 0);

  useEffect(() => {
    if (!endsAt) return undefined;

    let intervalId = null;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    intervalId = setInterval(tick, 1000);
    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [endsAt]);

  const restart = useCallback(() => {
    setEndsAt(Date.now() + duration * 1000);
    setSecondsLeft(duration);
  }, [duration]);

  return { secondsLeft, canResend: secondsLeft === 0, restart };
};

export default useResendTimer;
