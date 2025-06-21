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
  // Only gets triggered by Vercel cron job
  if (request.headers['x-vercel-cron'] !== 'true') {
    return response.status(401).json({
      error: 'Unauthorized',
    });
  }

  try {
    google.options({
      auth: oauth2Client,
    });

    const date = new Date();
    date.setDate(date.getDate() - 1);
    const query = `after:${date.getTime() / 1000}`;

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
    });

    const messages = res.data.messages || [];
    console.log(`Found ${messages.length} messages in the last 24 hours`);

    return response.status(200).json({
      success: true,
      message: `Successfully processed ${messages.length} messages`,
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    return response.status(500).json({
      error: 'Failed to process emails',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
