import { NextResponse } from 'next/server';
import { generateLlmsTxt } from '@/lib/seo/llms-generator';

export const dynamic = 'force-static';

export async function GET() {
  const content = generateLlmsTxt();

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
