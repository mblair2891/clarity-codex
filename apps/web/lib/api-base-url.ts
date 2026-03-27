export function resolveApiBaseUrl() {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.origin);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    url.port = '4000';
    return url.toString().replace(/\/$/, '');
  }

  if (url.hostname.endsWith('.app.github.dev')) {
    const parts = url.hostname.split('-');
    if (parts.length > 1) {
      parts[parts.length - 1] = '4000';
      url.hostname = parts.join('-');
      return url.toString().replace(/\/$/, '');
    }
  }

  if (url.hostname.startsWith('beta-app.')) {
    url.hostname = url.hostname.replace(/^beta-app\./, 'beta-api.');
    return url.toString().replace(/\/$/, '');
  }

  if (url.hostname.startsWith('beta-clinical.')) {
    url.hostname = url.hostname.replace(/^beta-clinical\./, 'beta-api.');
    return url.toString().replace(/\/$/, '');
  }

  return null;
}