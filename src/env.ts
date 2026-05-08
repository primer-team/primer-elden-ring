import { createEnv } from "@t3-oss/env-nextjs";

import { clientEnvSchema, serverEnvSchema } from "./env.schema";

export const env = createEnv({
	client: clientEnvSchema,
	server: serverEnvSchema,
	runtimeEnv: {
		NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY,
		DATABASE_URL: process.env.DATABASE_URL,
	},
	emptyStringAsUndefined: true,
});
