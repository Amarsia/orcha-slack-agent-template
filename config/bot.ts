export type BotCapability = {
  title: string;
  description: string;
  command: string;
};

export type BotConfig = {
  name: string;
  description: string;
  avatar: {
    src: string;
    alt: string;
  };
  welcome: string;
  capabilities: readonly BotCapability[];
};

export const botConfig = {
  name: "Orbit",
  description:
    "A thoughtful Slack teammate that turns questions into clear, actionable answers.",
  avatar: {
    src: "/bot-avatar.svg",
    alt: "Orbit bot avatar",
  },
  welcome:
    "Hi! I’m Orbit. Mention me in a channel or send me a direct message and I’ll help your team think, write, and plan.",
  capabilities: [
    {
      title: "Summarize discussions",
      description: "Turn long threads or pasted notes into concise decisions and actions.",
      command: "@Orbit Summarize this discussion and list the owners.",
    },
    {
      title: "Draft clear writing",
      description: "Create announcements, updates, briefs, and polished replies.",
      command: "@Orbit Draft a launch update for the team.",
    },
    {
      title: "Plan the work",
      description: "Break a goal into practical milestones, risks, and next steps.",
      command: "@Orbit Turn this idea into a two-week delivery plan.",
    },
    {
      title: "Explain and explore",
      description: "Answer questions with useful context and concrete examples.",
      command: "Explain this concept for a non-technical audience.",
    },
  ],
} as const satisfies BotConfig;
