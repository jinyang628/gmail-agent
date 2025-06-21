import { z } from 'zod';

export const emailProcessResult = z.object({
  shouldSee: z.boolean(),
  subject: z.string(),
});

export type EmailProcessResultType = z.infer<typeof emailProcessResult>;
