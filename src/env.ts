import { createEnv } from "@t3-oss/env-nextjs";

import { clientEnvSchema } from "./env.schema";

export const env = createEnv({
	client: clientEnvSchema,
	runtimeEnv: {
		NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY,
	},
	emptyStringAsUndefined: true,
});
