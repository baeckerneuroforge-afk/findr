import { z } from "zod";

export const GongTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  api_base_url_for_customer: z.string().url(),
});

export const GongUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    emailAddress: z.string().email().nullable().optional(),
    email: z.string().email().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
  })
  .passthrough();

export const GongCallSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    callId: z.union([z.string(), z.number()]).optional(),
    title: z.string().nullable().optional(),
    started: z.string().nullable().optional(),
    startedAt: z.string().nullable().optional(),
    scheduled: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    durationSeconds: z.number().nullable().optional(),
    url: z.string().nullable().optional(),
    callUrl: z.string().nullable().optional(),
    workspaceId: z.union([z.string(), z.number()]).nullable().optional(),
    primaryUserId: z.union([z.string(), z.number()]).nullable().optional(),
    parties: z.unknown().optional(),
  })
  .passthrough()
  .refine((value) => value.id !== undefined || value.callId !== undefined, {
    message: "Gong call must include id or callId",
  });

export const GongTranscriptSentenceSchema = z
  .object({
    start: z.number().nullable().optional(),
    end: z.number().nullable().optional(),
    startTime: z.number().nullable().optional(),
    endTime: z.number().nullable().optional(),
    startTimeSeconds: z.number().nullable().optional(),
    endTimeSeconds: z.number().nullable().optional(),
    text: z.string().min(1),
  })
  .passthrough();

export const GongTranscriptSegmentSchema = z
  .object({
    speakerId: z.union([z.string(), z.number()]).nullable().optional(),
    speakerName: z.string().nullable().optional(),
    speakerEmail: z.string().email().nullable().optional(),
    topic: z.string().nullable().optional(),
    sentences: z.array(GongTranscriptSentenceSchema).optional(),
    text: z.string().optional(),
    start: z.number().nullable().optional(),
    end: z.number().nullable().optional(),
  })
  .passthrough();

export const GongTranscriptSchema = z
  .object({
    callId: z.union([z.string(), z.number()]).transform(String),
    transcript: z.array(GongTranscriptSegmentSchema).optional(),
    segments: z.array(GongTranscriptSegmentSchema).optional(),
  })
  .passthrough();

export type GongTokenResponse = z.infer<typeof GongTokenResponseSchema>;
export type GongUser = z.infer<typeof GongUserSchema>;
export type GongCall = z.infer<typeof GongCallSchema>;
export type GongTranscript = z.infer<typeof GongTranscriptSchema>;
export type GongTranscriptSegment = z.infer<typeof GongTranscriptSegmentSchema>;
