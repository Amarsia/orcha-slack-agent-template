import Image from "next/image";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { botConfig } from "@/config/bot";
import type { ChatMessage as ChatMessageValue } from "@/lib/chat-types";

export function ChatMessage({ message }: { message: ChatMessageValue }) {
  if (message.role === "user") {
    return (
      <article className="message message-user">
        <div>{message.content}</div>
      </article>
    );
  }
  return (
    <article className="message message-assistant">
      <Image
        src={botConfig.avatar.src}
        alt=""
        width={30}
        height={30}
        aria-hidden="true"
      />
      <div className="markdown">
        {message.content ? (
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        ) : (
          <span className="thinking" aria-label={`${botConfig.name} is thinking`}>
            <i />
            <i />
            <i />
          </span>
        )}
        {message.pending && message.content ? <span className="cursor" /> : null}
      </div>
    </article>
  );
}
