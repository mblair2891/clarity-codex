import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'clarity-web',
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'unknown'
  });
}
