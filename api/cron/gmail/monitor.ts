// js suffix and relative path is required for the vercel build to work
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import httpStatus from 'http-status';

import { EmailProcessResultType } from '../../../types/result.js';
import { SYSTEM_PROMPT, getLlmApiUrl } from '../../../utils/llm.js';

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
    return response.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'GEMINI_API_KEY is not set',
    });
  }

  if (request.headers['x-vercel-cron'] !== 'true') {
    return response.status(httpStatus.UNAUTHORIZED).json({
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

    // Create label if it doesn't exist
    try {
      await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'gmail-agent',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
    } catch (error: any) {
      // Ignore error if label already exists
      if (error.code !== httpStatus.CONFLICT) {
        throw error;
      }
    }

    const results: EmailProcessResultType[] = [];
    for (const msg of messageDetails) {
      const headers = msg.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
      const body = msg.snippet || 'No content available';
      const response = await fetch(getLlmApiUrl(geminiApiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
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

      console.log('LLM Response:', JSON.stringify(responseData, null, 2));

      if (!responseData.candidates || responseData.candidates.length === 0) {
        console.error('Error: LLM response does not contain candidates.', responseData.error || '');
        continue;
      }

      const parts = responseData.candidates[0].content.parts;
      const functionCallPart = parts.find((part: any) => part.functionCall);
      const shouldSee: boolean = functionCallPart?.functionCall?.args?.shouldSee;
      if (!shouldSee) {
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id!,
          requestBody: {
            removeLabelIds: ['UNREAD'],
            addLabelIds: ['Label_gmail-agent'],
          },
        });
      }
      results.push({
        shouldSee,
        subject,
      });
    }

    return response.status(httpStatus.OK).json({
      results,
      message: `Successfully processed ${messages.length} unread messages`,
    });
  } catch (error) {
    console.error('Error processing emails:', error);
    return response.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to process emails',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
