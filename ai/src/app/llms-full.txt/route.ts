import { NextResponse } from 'next/server';
import { generateLlmsFullTxt } from '@/lib/seo/llms-generator';

export const dynamic = 'force-static';

export async function GET() {
  const content = generateLlmsFullTxt();

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
