const DEFAULT_API_URL = 'https://invest-3-n031.onrender.com/api';

function normalizeApiUrl(url: string) {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const API_BASE_URL = normalizeApiUrl(import.meta.env.VITE_API_URL || DEFAULT_API_URL);
export const API_ORIGIN_URL = API_BASE_URL.replace(/\/api$/, '');
