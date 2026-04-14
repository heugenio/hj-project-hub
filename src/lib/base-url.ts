export const DEFAULT_API_BASE_URL = 'http://3.214.255.198:8085';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_API_BASE_URL;

  return localStorage.getItem('hj_system_url_base') || DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;

  const normalizedUrl = url.trim();

  if (normalizedUrl) {
    localStorage.setItem('hj_system_url_base', normalizedUrl);
    return;
  }

  localStorage.removeItem('hj_system_url_base');
}