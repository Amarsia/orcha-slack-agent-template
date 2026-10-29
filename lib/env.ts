import { z } from "zod";

const baseSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1, "OPENAI_API_KEY is required."),
  AMARSIA_PROJECT_KEY: z.string().trim().optional(),
  AMARSIA_API_URL: z.url().optional(),
  ORCHA_SESSION_DIRECTORY: z.string().trim().optional(),
  SLACK_WORKSPACE_NAME: z.string().trim().optional(),
  SLACK_WORKSPACE_URL: z.url().optional(),
  VISITOR_COOKIE_SECRET: z.string().min(32).optional(),
});

const slackSchema = baseSchema.extend({
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-", "SLACK_BOT_TOKEN must start with xoxb-."),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-", "SLACK_APP_TOKEN must start with xapp-."),
});

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentValidationError";
  }
}

function parse<T extends z.ZodType>(schema: T): z.output<T> {
  const result = schema.safeParse(process.env);
  if (result.success) return result.data;

  const message = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(" ");
  throw new EnvironmentValidationError(message);
}

export function getServerEnv() {
  const env = parse(baseSchema);
  if (process.env.NODE_ENV === "production" && !env.VISITOR_COOKIE_SECRET) {
    throw new EnvironmentValidationError(
      "VISITOR_COOKIE_SECRET must contain at least 32 characters in production.",
    );
  }
  return env;
}

export function getSlackEnv() {
  return parse(slackSchema);
}

export function getSetupStatus() {
  return {
    provider: Boolean(process.env.OPENAI_API_KEY?.trim()),
    slackBot: Boolean(process.env.SLACK_BOT_TOKEN?.startsWith("xoxb-")),
    slackApp: Boolean(process.env.SLACK_APP_TOKEN?.startsWith("xapp-")),
    workspaceName: process.env.SLACK_WORKSPACE_NAME?.trim() || undefined,
    workspaceUrl: process.env.SLACK_WORKSPACE_URL?.trim() || undefined,
  };
}
