export const MODEL_NAME: string = 'gemini-2.5-flash-preview-04-17';
export const getLlmApiUrl = (geminiApiKey: string): string => {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
};
export const getSystemPrompt = (subject: string, body: string): string => {
  return `
You are a helpful assistant for a busy professional. Your task is to analyze an email and determine if it's important enough for the user to see.

The user is looking for emails that are:
1.  **Urgent**: Requiring immediate attention.
2.  **Important**: Related to work, personal finance, or critical projects.
3.  **From key contacts**: From their boss, family, or important clients.

The user wants to IGNORE emails that are:
1.  **Spam/Junk**: Unsolicited marketing or promotional content.
2.  **Newsletters**: Automated updates that are not time-sensitive.
3.  **Social media notifications**: Updates from platforms like LinkedIn, Twitter, etc.

Analyze the following email and decide if the user should see it. Call the \`shouldUserSeeEmail\` function with your decision.

**Email Subject**: ${subject}
**Email Body Snippet**:
${body.substring(0, 500)}...
`;
};
