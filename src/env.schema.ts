import { z } from "zod";

export const clientEnvSchema = {
	NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
};

export const serverEnvSchema = {
	DATABASE_URL: z.string().url(),
	OPENROUTER_API_KEY: z.string().min(1),
	OPENROUTER_APP_URL: z.string().url().optional(),
	OPENROUTER_APP_TITLE: z.string().min(1).optional(),
	OPENROUTER_MANIFEST_MODEL: z.string().min(1).default("google/gemini-3.1-pro-preview"),
	OPENROUTER_IMAGE_MODEL: z.string().min(1).default("openai/gpt-5.4-image-2"),
	OPENROUTER_VIDEO_MODEL: z.string().min(1).default("bytedance/seedance-2.0"),
};
