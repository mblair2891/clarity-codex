import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase() ?? '';
  const pathname = request.nextUrl.pathname;

  if (pathname !== '/') {
    return NextResponse.next();
  }

  if (host.startsWith('beta-clinical.')) {
    const url = request.nextUrl.clone();
    url.pathname = '/clinical';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/']
};
