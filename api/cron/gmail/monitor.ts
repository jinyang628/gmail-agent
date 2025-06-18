import { NextRequest, NextResponse } from 'next/server';

import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron (optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Gmail API with service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      },
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      subject: process.env.GMAIL_USER_EMAIL, // The email to impersonate
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Get unread emails count
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
    });

    const unreadCount = response.data.messages?.length || 0;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] Unread emails: ${unreadCount}`);

    // Optional: Send notification if count is high
    if (unreadCount > 10) {
      await sendNotification(unreadCount);
    }

    return NextResponse.json({
      success: true,
      unreadCount,
      timestamp,
      message: `Found ${unreadCount} unread emails`,
    });
  } catch (error) {
    console.error('Gmail monitoring error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

async function sendNotification(count: number) {
  // Example: Send to a webhook (Slack, Discord, etc.)
  const webhookUrl = process.env.WEBHOOK_URL;

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Gmail Alert: You have ${count} unread emails!`,
        }),
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}
