import { z } from "zod";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:5173"),
    AWS_REGION: z.string().min(1).default("eu-central-1"),
    S3_DOCUMENT_BUCKET: z.string().min(3),
    DOCUMENT_INGEST_FUNCTION: z.string().min(1),
    REDCAP_API_URL: z.url().default("https://redcap.mou.cz/api/"),
    REDCAP_API_TOKEN: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{32}$/i)
      .optional(),
    REDCAP_GATEWAY_COOKIE_FILE: z.string().min(1).optional(),
    MIGRATIONS_DIR: z.string().min(1).default("../../packages/db/migrations"),
  })
  .readonly();

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }

  return parsed.data;
}
