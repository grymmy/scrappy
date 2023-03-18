import { react } from "./slack.js"
import prisma from "./prisma.js";
import emojiKeywords from "./emojiKeywords.js";

export const getReactionRecord = async (emoji, updateId) =>
  await prisma.emojiReactions.findFirst({
    where: {
      emojiTypeName: emoji,
      updateId: updateId,
    },
  });

export const reactBasedOnKeywords = (channel, message, ts) => {
  Object.keys(emojiKeywords).forEach(async (keyword) => {
    if (
      message
      ?.text && message
        ?.text
        ?.toLowerCase()
        .search(new RegExp("\\b" + keyword + "\\b", "gi")) !== -1
    ) {
      try{
        await react("add", channel, ts, emojiKeywords[keyword]);
      } catch {}
    }
  });
};
