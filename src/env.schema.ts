import { z } from "zod";

export const clientEnvSchema = {
	NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
};
