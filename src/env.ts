import { createEnv } from "@t3-oss/env-nextjs";

import { clientEnvSchema, serverEnvSchema } from "./env.schema";

export const env = createEnv({
	client: clientEnvSchema,
	server: serverEnvSchema,
	runtimeEnv: {
		NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY,
		DATABASE_URL: process.env.DATABASE_URL,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENROUTER_APP_URL: process.env.OPENROUTER_APP_URL,
		OPENROUTER_APP_TITLE: process.env.OPENROUTER_APP_TITLE,
		OPENROUTER_MANIFEST_MODEL: process.env.OPENROUTER_MANIFEST_MODEL,
		OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		OPENROUTER_VIDEO_MODEL: process.env.OPENROUTER_VIDEO_MODEL,
	},
	emptyStringAsUndefined: true,
});
