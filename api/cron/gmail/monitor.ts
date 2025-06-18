import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';

// Initialize the Gmail API client
const gmail = google.gmail('v1');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3000/auth/callback', // This won't be used in production
);

// Set credentials using refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // Verify the request is from Vercel Cron
  if (request.headers['x-vercel-cron'] !== 'true') {
    return response.status(401).json({
      error: 'Unauthorized',
    });
  }

  try {
    // Set auth client
    google.options({
      auth: oauth2Client,
    });

    // Get messages from the last 24 hours
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const query = `after:${date.getTime() / 1000}`;

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
    });

    // Process the messages here
    const messages = res.data.messages || [];
    console.log(`Found ${messages.length} messages in the last 24 hours`);

    // Add your email processing logic here

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
