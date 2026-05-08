import { z } from "zod";

export const clientEnvSchema = {
	NEXT_PUBLIC_PRIMER_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
};

export const serverEnvSchema = {
	DATABASE_URL: z.string().url(),
};
