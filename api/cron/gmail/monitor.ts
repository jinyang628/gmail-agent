// js suffix and relative path is required for the vercel build to work
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import httpStatus from 'http-status';

import { EmailProcessResultType } from '../../../types/result.js';
import { SYSTEM_PROMPT, getLlmApiUrl } from '../../../utils/llm.js';

const GMAIL_AGENT_LABEL: string = 'gmail-agent';
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
      error: 'Unauthorized origin',
    });
  }

  if (request.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(httpStatus.UNAUTHORIZED).json({
      error: 'Failed to provide correct cron job secret',
    });
  }

  try {
    google.options({
      auth: oauth2Client,
    });

    const gmailAgentLabelId: string = await getOrCreateGmailAgentLabelId();

    const messages = await getRecentUnprocessedMessages(gmailAgentLabelId);

    const results: EmailProcessResultType[] = [];
    for (const msg of messages) {
      const headers = msg.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
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
      if (!responseData.candidates || responseData.candidates.length === 0) {
        console.error('Error: LLM response does not contain candidates.', responseData.error || '');
        continue;
      }
      const parts = responseData.candidates[0].content.parts;
      console.log('LLM Response:', parts);
      const functionCallPart = parts.find((part: any) => part.functionCall);
      const shouldSee: boolean = functionCallPart?.functionCall?.args?.shouldSee;

      if (!shouldSee) {
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id!,
          requestBody: {
            removeLabelIds: ['UNREAD'],
            addLabelIds: [gmailAgentLabelId],
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

async function getRecentUnprocessedMessages(labelId: string): Promise<any[]> {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const queryDate = Math.floor(date.getTime() / 1000);
  const query = `is:unread -label:${labelId} (in:inbox OR is:important) after:${queryDate}`;

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
  return messageDetails;
}

async function getOrCreateGmailAgentLabelId(): Promise<string> {
  try {
    const createRes = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: GMAIL_AGENT_LABEL,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    if (createRes.data.id) {
      return createRes.data.id;
    }
  } catch (error: any) {
    if (error.code === httpStatus.CONFLICT) {
      const listRes = await gmail.users.labels.list({ userId: 'me' });
      const labels = listRes.data.labels || [];
      const existingLabel = labels.find((label) => label.name === GMAIL_AGENT_LABEL);
      if (existingLabel?.id) {
        return existingLabel.id;
      }
    }
    throw error;
  }
  throw new Error(`Could not create or find the label: ${GMAIL_AGENT_LABEL}`);
}
