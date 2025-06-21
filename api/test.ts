import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

const gmail = google.gmail('v1');

const oauth2Client = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    google.options({
      auth: oauth2Client,
    });

    const profile = await gmail.users.getProfile({
      userId: 'me',
    });

    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    const messages = res.data.messages || [];

    return response.status(200).json({
      success: true,
      profile: profile.data,
      messageCount: messages.length,
      messages: messages.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test error:', error);
    return response.status(500).json({
      error: 'Failed to test Gmail API',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
