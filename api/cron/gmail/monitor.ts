import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { z } from 'zod';

const gmail = google.gmail('v1');

const oauth2Client = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return response.status(500).json({
      error: 'GEMINI_API_KEY is not set',
    });
  }

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
    const queryDate = Math.floor(date.getTime() / 1000);
    const query = `is:unread after:${queryDate} (in:inbox OR is:important)`;

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
    });

    const messages = res.data.messages || [];
    const messageDetails = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });
        return detail.data;
      }),
    );

    let shouldSee: boolean = false;
    const results: EmailProcessResultType[] = [];
    messageDetails.forEach(async (msg) => {
      const headers = msg.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
      const body = msg.snippet || 'No content available';
      console.log(`Email ID: ${msg.id}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${body}`);
      const response = await fetch(getLlmApiUrl(geminiApiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'system',
              parts: [{ text: SYSTEM_PROMPT }],
            },
            {
              role: 'user',
              parts: [{ text: `Subject: ${subject}\nBody: ${body}` }],
            },
          ],
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'shouldUserSeeEmail',
                  description: 'Determine if the user needs to see this email',
                  parameters: {
                    type: 'object',
                    properties: {
                      shouldSee: {
                        type: 'boolean',
                        description: 'Whether the user needs to see this email',
                      },
                    },
                    required: ['shouldSee'],
                  },
                },
              ],
            },
          ],
        }),
      });

      const responseData = (await response.json()) as any;
      shouldSee = responseData.candidates[0].content.parts[0].functionCall?.args?.shouldSee;
      results.push({
        shouldSee,
        subject,
      });
    });

    return response.status(200).json({
      results,
      message: `Successfully processed ${messages.length} unread messages`,
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    return response.status(500).json({
      error: 'Failed to process emails',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

const MODEL_NAME: string = 'gemini-2.5-flash-preview-04-17';
function getLlmApiUrl(geminiApiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
}
const SYSTEM_PROMPT: string = `
You are a helpful assistant for a busy professional. Your task is to analyze an email and determine if it's important enough for the user to see.

The user is looking for emails that are:
1.  **Urgent**: Requiring immediate attention.
2.  **Important**: Related to work, personal finance, or critical projects.
3.  **From key contacts**: From their boss, family, or important clients.

The user wants to IGNORE emails that are:
1.  **Spam/Junk**: Unsolicited marketing or promotional content.
2.  **Newsletters**: Automated updates that are not time-sensitive.
3.  **Social media notifications**: Updates from platforms like LinkedIn, Twitter, etc.

Analyze the following email and decide if the user should see it. Call the \`shouldUserSeeEmail\` function with your decision.`;

const emailProcessResult = z.object({
  shouldSee: z.boolean(),
  subject: z.string(),
});

type EmailProcessResultType = z.infer<typeof emailProcessResult>;
