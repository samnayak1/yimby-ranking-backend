import { z } from 'zod';

export const contactSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, 'Message is too short')
    .max(2000, 'Message is too long (2,000 characters max)'),

  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name is too long'),

  email: z
    .string()
    .trim()
    .max(200, 'Email is too long')
    .pipe(z.email('Enter a valid email address')),

  // Honeypot. Hidden from people, filled in by naive bots. Accepted by the
  // schema on purpose: rejecting it with a 400 would tell the bot which field
  // gave it away. The controller drops the message silently instead.
  website: z.string().max(500).optional(),
});

export type ContactDto = z.infer<typeof contactSchema>;
