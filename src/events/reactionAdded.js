import {
  unverifiedRequest,
  getEmojiRecord,
  getReactionRecord,
  updateExists,
  emojiExists,
  react,
  getMessage,
  updateExistsTS,
  getPublicFileUrl,
  incrementStreakCount,
  formatText,
  isFullMember,
  createPost,
  postEphemeral,
} from "../lib/api-utils.js";
import { t } from "../lib/transcript.js";
import { getUserRecord } from "../lib/users.js";
import { SEASON_EMOJI } from "../lib/seasonEmoji.js";
import prisma from "../lib/prisma.js";
import Bottleneck from "bottleneck";
import fetch from "node-fetch";
const limiter = new Bottleneck({ maxConcurrent: 1 });
import channelKeywords from "../lib/channelKeywords.js";
import emojiKeywords from "../lib/emojiKeywords.js";

export default async ({ event }) => {
  const { item, user, reaction, item_user } = event;
  const { channel, ts } = item;
  if (reaction !== SEASON_EMOJI && user === "U015D6A36AG") return;
  if (
    (await updateExistsTS(ts)) &&
    (reaction === "scrappy" || reaction === "scrappyparrot") &&
    channel !== process.env.CHANNEL
  )
    return;
  if ((await updateExistsTS(ts)) && reaction === "scrappy-retry") {
    try {
      if (userRecord.webhookURL) {
        fetch(userRecord.webhookURL);
      }
    } catch (err) {}
    const message = await getMessage(ts, channel);
    if (typeof channelKeywords[channel] !== "undefined")
      await react("add", channel, ts, channelKeywords[channel]);
    Object.keys(emojiKeywords).forEach(async (keyword) => {
      if (
        message.text
          .toLowerCase()
          .search(new RegExp("\\b" + keyword + "\\b", "gi")) !== -1
      ) {
        await react("add", channel, ts, emojiKeywords[keyword]);
      }
    });
    await react("remove", channel, ts, "beachball");
    await react("add", channel, ts, SEASON_EMOJI);
    return;
  }
  // If someone reacted with a Scrappy emoji in a non-#scrapbook channel, then maybe upload it.
  if (
    (reaction === "scrappy" || reaction === "scrappyparrot") &&
    channel !== process.env.CHANNEL
  ) {
    if (item_user != user) {
      // If the reacter didn't post the original message, then show them a friendly message
      postEphemeral(
        channel,
        t("messages.errors.anywhere.op", { reaction }),
        user
      );
    } else {
      const message = await getMessage(ts, channel);
      if (!message) return;
      await createPost(message.files, channel, ts, user, message.text);
    }
    return;
  }

  if (reaction === "scrappy-retry" && channel == process.env.CHANNEL) {
    const message = await getMessage(ts, channel);
    if (!message) return;
    if (!message.files || message.files.length == 0) {
      postEphemeral(channel, t("messages.errors.anywhere.files"), user);
      return;
    }
    await createPost(message.files, channel, ts, item_user, message.text);
  }
  limiter.schedule(async () => {
    const emojiRecord = await getEmojiRecord(reaction);
    const { ts } = item;
    const update = (
      await prisma.updates.findMany({
        where: {
          messageTimestamp: parseFloat(ts),
        },
      })
    )[0];
    if (!update) {
      console.log(
        startTS,
        "reaction was added to a message in a thread. skipping..."
      );
      return;
    }
    const postExists = await updateExists(update.id);
    const reactionExists = await emojiExists(reaction, update.id);
    if (!reactionExists) {
      // Post hasn't been reacted to yet at all, or it has been reacted to, but not with this emoji
      await prisma.emojiReactions.create({
        data: {
          updateId: update.id,
          emojiTypeName: emojiRecord.name,
        },
      });
    } else if (postExists && reactionExists) {
      const userRecord = await getUserRecord(user).catch((err) =>
        console.log("Cannot get user record", err)
      );
      // Post has been reacted to with this emoji
      const reactionRecord = await getReactionRecord(reaction, update.id).catch(
        (err) => console.log("Cannot get reaction record", err)
      );
      let usersReacted = reactionRecord.usersReacted;
      if (userRecord.id) {
        await usersReacted.push(userRecord.id);
      }
      await prisma.emojiReactions.update({
        where: { id: reactionRecord.id },
        data: { usersReacted: usersReacted },
      });
    }
  });
};
