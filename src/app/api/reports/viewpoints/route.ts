import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_VIEWPOINTS } from '@/lib/reports/viewpoints';

export async function GET(request: NextRequest) {
    // Return predefined viewpoints for all projects
    return NextResponse.json({ viewpoints: DEFAULT_VIEWPOINTS });
}
