export function resolveApiBaseUrl() {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.origin);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    url.port = '4000';
    return url.toString().replace(/\/$/, '');
  }

  if (/-3000\.app\.github\.dev$/.test(url.hostname)) {
    url.hostname = url.hostname.replace(/-3000\.app\.github\.dev$/, '-4000.app.github.dev');
    return url.toString().replace(/\/$/, '');
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
