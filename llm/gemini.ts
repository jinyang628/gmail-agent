export const MODEL_NAME: string = 'gemini-2.5-flash-preview-04-17';
export const getLlmApiUrl = (geminiApiKey: string): string => {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;
};
export const getSystemPrompt = (subject: string, body: string): string => {
  return `
You are an email assistant.
You are given an email with the following subject and body:
Subject: ${subject}
Body: ${body}

Your job is to analyze the email and decide whether it is an email that the user needs to see.
`;
};
