export const MODEL_NAME: string = 'gemini-2.5-flash-preview-04-17';
export function getLlmApiUrl(geminiApiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
}
export const SYSTEM_PROMPT: string = `
You are a helpful assistant for a busy professional. Your task is to analyze an email and determine if it's important enough for the user to see.

The user is looking for emails that are:
1.  **Urgent**: Requiring immediate attention.
2.  **Important**: Related to personal finance, critical projects or visa.
3.  **From key contacts**: Related to his current workplace Palantir Technologies.
4.  **Interviews/Meetings/Coding Challenges**: From any company reaching out for a job interview or assessment.

The user wants to IGNORE emails that are:
1.  **Spam/Junk**: Unsolicited marketing or promotional content.
2.  **Newsletters**: Automated updates that are not time-sensitive.
3.  **Social media notifications**: Updates from platforms like LinkedIn, Twitter, etc.
4. **Automated emails**: Emails that are sent by 3rd party systems, like successful account verification, password resets, job applications, etc.

Analyze the following email and decide if the user should see it. Call the \`shouldUserSeeEmail\` function with your decision.`;
