import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// GET /install-agent.sh - Serve the agent installer script
export async function GET(request: NextRequest) {
  try {
    const scriptPath = join(process.cwd(), '../install-agent.sh');
    const script = readFileSync(scriptPath, 'utf-8');

    // Get panel URL from request or env
    const panelUrl = request.headers.get('host') || process.env.NEXT_PUBLIC_APP_URL || 'https://panel.example.com';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const fullUrl = `${protocol}://${panelUrl}`;

    // Replace placeholder with actual URL
    const modifiedScript = script.replace(/PANEL_URL="https:\/\/panel\.example\.com"/g, `PANEL_URL="${fullUrl}"`);

    return new NextResponse(modifiedScript, {
      headers: {
        'Content-Type': 'text/x-shellscript',
        'Content-Disposition': 'attachment; filename="install-agent.sh"',
      },
    });
  } catch (error) {
    console.error('Serve installer error:', error);
    return new NextResponse('Installer script not found', { status: 404 });
  }
}
