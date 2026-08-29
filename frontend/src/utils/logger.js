import { API_URL } from '../config';

const sendLog = async (level, message, meta = {}) => {
  try {
    // Append browser info to meta
    const logMeta = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    const payload = JSON.stringify({ level, message, meta: logMeta });

    // Use sendBeacon if available, or fallback to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(`${API_URL}/api/logs/client`, blob);
    } else {
      await fetch(`${API_URL}/api/logs/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    }
  } catch (err) {
    console.warn('Failed to send log to server:', err);
  }
};

export const clientLogger = {
  info: (message, meta) => {
    console.log(`[INFO] ${message}`, meta || '');
    sendLog('info', message, meta);
  },
  warn: (message, meta) => {
    console.warn(`[WARN] ${message}`, meta || '');
    sendLog('warn', message, meta);
  },
  error: (message, meta) => {
    console.error(`[ERROR] ${message}`, meta || '');
    sendLog('error', message, meta);
  },
};

// Global error handler initialization
export const initGlobalErrorLogging = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    clientLogger.error(event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : null,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    clientLogger.error(`Unhandled Promise Rejection: ${event.reason}`, {
      reason: event.reason ? (event.reason.stack || event.reason.toString()) : null,
    });
  });
};
export default clientLogger;
