import { Telegraf, Context } from "telegraf";
import TelegrafI18n from "telegraf-i18n";
// @ts-ignore - missing types for telegraf-ratelimit
import rateLimit from "telegraf-ratelimit";
import path from "node:path";
import * as html from "html-escaper";
import type { Message, PhotoSize, MessageEntity } from "telegraf/types";
import * as treeify from "./treeify";
import getAge from "./idage";

// Extend Context to include i18n property
declare module "telegraf" {
  interface Context {
    i18n: any;
  }
}

const BOT_TOKEN = process.env.BOT_TOKEN;
if (BOT_TOKEN === undefined) {
  console.error(
    "ERROR: You need to provide an environment variable called BOT_TOKEN with the telegram bot token.",
  );
  process.exit(1);
}
if (
  BOT_TOKEN.split(":").length !== 2 ||
  BOT_TOKEN.split(":")[1].length !== 35
) {
  console.error(
    "ERROR: The environment variable BOT_TOKEN seems to be malformatted.",
  );
  process.exit(1);
}

const bot = new Telegraf<Context>(BOT_TOKEN);

const i18n = new TelegrafI18n({
  defaultLanguage: "en",
  allowMissing: true,
  directory: path.resolve(__dirname, "../locales"),
});

bot.use(i18n.middleware());

interface LimitConfig {
  window: number;
  limit: number;
  keyGenerator: (ctx: Context) => number;
  onLimitExceeded: (ctx: Context, next: () => void) => void;
}

const limitConfig: LimitConfig = {
  window: 12000,
  limit: 4,
  keyGenerator: (ctx: Context) => {
    if (ctx.chat !== undefined) {
      return ctx.chat.id;
    }

    if (ctx.from === undefined) {
      return 0;
    }

    return ctx.from.id;
  },
  onLimitExceeded: (ctx: Context, next: () => void) => {
    // Only rate limit in group chats:
    if (ctx.chat?.type === "private") {
      next();
    }
  },
};

bot.use(rateLimit(limitConfig));

let botName = "";

const getAgeString = (
  ctx: Context & { message?: Message.CommonMessage },
  key: "from" | "forward_from",
): string => {
  const idAgeHelpLink = `<a href="https://t.me/${botName}?start=idhelp">(?)</a>`;
  const message = ctx.message as any;
  const createDate = getAge(message[key].id);
  return ctx.i18n.t(createDate[0]) + " " + createDate[1] + " " + idAgeHelpLink;
};

const getDateString = (
  ctx: Context & { message?: Message.CommonMessage },
): string => {
  const message = ctx.message as any;
  const date = new Date((message.forward_date || 0) * 1000);
  return date.toUTCString();
};

const getAdminsString = async (chatId: number): Promise<string> => {
  const admins = await bot.telegram.getChatAdministrators(chatId);
  console.log(admins);
  const resStr = admins
    .map((a) => {
      let icon = "👤";
      if (a.status === "creator") {
        icon = "⭐️";
      } else if (a.user.is_bot) {
        icon = "🤖";
      }

      const prefix = a.user.username
        ? '<a href="https://t.me/' + a.user.username + '">'
        : "";
      const suffix = a.user.username ? "</a>" : "";
      const escapedName = html
        .escape(
          a.user.first_name + (a.user.last_name ? " " + a.user.last_name : ""),
        )
        .substring(0, 35);

      return icon + " " + prefix + escapedName + suffix;
    })
    .join("\n");

  console.log("AdminsString:", "'" + resStr + "'");
  return resStr;
};

bot.start(async (ctx: Context) => {
  // Filter out group chats
  if (ctx.message?.chat.type !== "private") {
    return;
  }

  try {
    if ((ctx.message as any).text === "/start idhelp") {
      ctx.replyWithHTML(ctx.i18n.t("idhelp"), {
        link_preview_options: { is_disabled: true },
      } as any);
    } else {
      // username may be not defined, first_name may be empty
      const userIdentity =
        (ctx.chat as any)?.username || (ctx.chat as any)?.first_name;

      let comma = "";
      let username: string;
      if (userIdentity) {
        username = html.escape(userIdentity);
        comma = ",";
      } else {
        username = ctx.i18n.t("human");
      }

      let msgText = ctx.i18n.t("start", { comma, username });

      msgText +=
        "\n\n" + treeify.renderTree(ctx.from as any, ctx.i18n.t("you_header"));
      ctx.replyWithHTML(msgText);
    }
  } catch (error) {
    console.error(error);
  }
});

bot.help((ctx: Context) => {
  try {
    ctx.replyWithHTML(ctx.i18n.t("help"), {
      link_preview_options: { is_disabled: true },
    } as any);
  } catch (error) {
    console.error(error);
  }
});

// Alias for help command:
bot.command("about", (ctx: Context) => {
  try {
    ctx.replyWithHTML(ctx.i18n.t("help"), {
      link_preview_options: { is_disabled: true },
    } as any);
  } catch (error) {
    console.error(error);
  }
});

bot.settings((ctx: Context) => {
  try {
    ctx.replyWithHTML(ctx.i18n.t("nosettings"), {
      link_preview_options: { is_disabled: true },
    } as any);
  } catch (error) {
    console.error(error);
  }
});

bot.command("idhelp", (ctx: Context) => {
  try {
    ctx.replyWithHTML(ctx.i18n.t("idhelp"), {
      link_preview_options: { is_disabled: true },
    } as any);
  } catch (error) {
    console.error(error);
  }
});

bot.command("admins", async (ctx: Context) => {
  if (ctx.chat?.type === "private" || ctx.chat?.type === "channel") {
    try {
      await ctx.replyWithHTML(ctx.i18n.t("admin_private_chat"));
    } catch (e) {
      console.error(e);
    }
  } else {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      return;
    }

    const adminsStr = await getAdminsString(chatId);
    try {
      await ctx.replyWithHTML(ctx.i18n.t("admin_list", { adminsStr }), {
        disable_web_page_preview: true,
      } as any);
    } catch (error) {
      console.error(error);
    }
  }
});

bot.command("json", async (ctx: Context) => {
  if ((ctx.message as any)?.reply_to_message === undefined) {
    try {
      await ctx.replyWithHTML(ctx.i18n.t("json_needs_reply"));
    } catch (error) {
      console.error(error);
    }
  } else {
    const rtm = (ctx.message as any).reply_to_message;
    const jsonStr = html.escape(JSON.stringify(rtm, null, 2));
    if (jsonStr.length > 4096) {
      try {
        await ctx.replyWithHTML(ctx.i18n.t("json_too_long"), {
          disable_web_page_preview: true,
        } as any);
      } catch (error) {
        console.error(error);
      }
    } else {
      try {
        await ctx.replyWithHTML("<code>" + jsonStr + "</code>", {
          disable_web_page_preview: true,
        } as any);
      } catch (error) {
        console.error(error);
      }
    }
  }
});

bot.command("user", async (ctx: Context) => {
  try {
    if ((ctx.message as any)?.reply_to_message === undefined) {
      await ctx.replyWithHTML(ctx.i18n.t("user_needs_reply"));
    } else {
      const rtm = (ctx.message as any).reply_to_message;
      const fromUser = rtm.from;

      fromUser.created = getAgeString(
        { message: rtm, i18n: ctx.i18n } as any,
        "from",
      );
      await ctx.replyWithHTML(
        treeify.renderTree(fromUser, ctx.i18n.t("user_header")),
        {
          disable_web_page_preview: true,
        } as any,
      );
    }
  } catch (error) {
    console.error(error);
  }
});

bot.command("kill_process", async (ctx: Context) => {
  if (ctx.chat?.type === "private" && ctx.from?.id === 127782573) {
    setTimeout(() => {
      process.exit(1);
    }, 500);
  }
});

bot.on("message", (ctx: Context) => {
  try {
    if (ctx.message?.chat.type === "private") {
      handlePrivateChat(ctx);
    } else {
      handleGroupChat(ctx);
    }
  } catch (error) {
    console.error(error);
  }
});

async function handleGroupChat(ctx: Context): Promise<void> {
  const message = ctx.message as any;
  if (message?.new_chat_members !== undefined) {
    if (message.new_chat_members.some((m: any) => m.username === botName)) {
      // Bot was just added to group

      const chatId = ctx.chat?.id;
      if (chatId === undefined) {
        return;
      }

      const adminsStr = await getAdminsString(chatId);
      console.log(adminsStr);

      ctx.replyWithHTML(
        ctx.i18n.t("group_chat_start", {
          chatInfoStr: treeify.renderTree(
            ctx.chat as any,
            ctx.i18n.t("this_chat_header"),
          ),
          adminsStr,
        }),
        {
          disable_web_page_preview: true,
        } as any,
      );
    } else {
      // Other new members are intentionally ignored.
    }
  }
}

function handlePrivateChat(ctx: Context): void {
  const renders: string[] = [];
  const message = ctx.message as any;

  appendPrivateUserRenders(ctx, message, renders);
  appendPrivateMediaRenders(ctx, message, renders);

  const msgInfo = buildMessageInfo(ctx, message);
  if (Object.keys(msgInfo).length > 0) {
    renders.push(treeify.renderTree(msgInfo, ctx.i18n.t("message_header")));
  }

  ctx.reply(renders.join("\n\n"), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  } as any);

  // console.debug(JSON.stringify(ctx.message, null, 2))
}

function appendPrivateUserRenders(
  ctx: Context,
  message: any,
  renders: string[],
): void {
  // Render CURRENT USER
  if (message?.from !== undefined) {
    (ctx.from as any).created = getAgeString(ctx as any, "from");
    renders.push(treeify.renderTree(ctx.from as any, ctx.i18n.t("you_header")));
  }

  // Render ORIGIN CHAT
  if (message?.forward_from_chat !== undefined) {
    renders.push(
      treeify.renderTree(
        message.forward_from_chat,
        ctx.i18n.t("origin_chat_header"),
      ),
    );
  }

  // Render ORIGIN ACCOUNT
  if (
    message?.forward_from !== undefined &&
    message.from?.id !== message.forward_from?.id
  ) {
    const fwfrom = message.forward_from;

    if (fwfrom.first_name !== undefined) {
      fwfrom.created = getAgeString(
        { message, i18n: ctx.i18n } as any,
        "forward_from",
      );
    }
    renders.push(
      treeify.renderTree(fwfrom, ctx.i18n.t("forwarded_from_header")),
    );
  }

  if (message?.forward_sender_name !== undefined) {
    const fwfrom = {
      hidden: ctx.i18n.t("user_hid_account"),
    };
    renders.push(
      treeify.renderTree(fwfrom, ctx.i18n.t("forwarded_from_header")),
    );
  }
}

function appendPrivateMediaRenders(
  ctx: Context,
  message: any,
  renders: string[],
): void {
  // Render PHOTOS
  if (message?.photo !== undefined) {
    const photos = message.photo as PhotoSize[];
    renders.push(
      treeify.renderTree(
        {
          file_size: photos.at(-1)?.file_size,
        },
        ctx.i18n.t("image_header"),
      ),
    );
  }

  // Render STICKERS
  if (message?.sticker !== undefined) {
    const sticker = message.sticker;

    // Remove all file_ids, as they vary between bots
    delete sticker.thumb;
    renders.push(treeify.renderTree(sticker, ctx.i18n.t("sticker_header")));
  }

  // Render AUDIO
  if (message?.audio !== undefined) {
    const audio = message.audio;

    // Remove all file_ids, as they vary between bots
    delete audio.thumb;
    delete audio.file_id;

    renders.push(treeify.renderTree(audio, ctx.i18n.t("audio_header")));
  }

  // Render VIDEOS
  if (message?.video !== undefined) {
    const video = message.video;

    // Remove all file_ids, as they vary between bots
    delete video.thumb;
    delete video.file_id;

    renders.push(treeify.renderTree(video, ctx.i18n.t("video_header")));
  }

  // Render DOCUMENTS
  if (message?.document !== undefined) {
    const document = message.document;

    // Remove all file_ids, as they vary between bots
    delete document.file_id;

    renders.push(treeify.renderTree(document, ctx.i18n.t("document_header")));
  }

  // Render native POLLS
  if (message?.poll !== undefined) {
    const poll = message.poll;

    // Rewrite options to plain array, since we don't get votes anyways.
    poll.options = poll.options.map((o: any) => o.text);

    renders.push(treeify.renderTree(poll, ctx.i18n.t("poll_header")));
  }
}

function buildMessageInfo(ctx: Context, message: any): Record<string, any> {
  const msgInfo: Record<string, any> = {};

  // add message_id with link to original chat's message
  if (message?.forward_from_message_id !== undefined) {
    const msgId = message.forward_from_message_id;
    const fwdFrom = message.forward_from_chat;
    msgInfo.message_id =
      fwdFrom?.username === undefined
        ? msgId
        : `<a href="https://t.me/${fwdFrom.username}/${msgId}">${msgId}</a>`;
  }

  // add original sending date of message
  if (message?.forward_date !== undefined) {
    msgInfo.forward_date = getDateString(ctx as any);
  }

  // display hidden links
  const hiddenLinks: string[] =
    message?.entities === undefined
      ? []
      : (message.entities as MessageEntity[])
          .filter((e) => e.type === "text_link")
          .map((e) => (e as any).url);
  if (hiddenLinks.length > 0) {
    msgInfo.urls = hiddenLinks;
  }

  return msgInfo;
}

bot.on("inline_query", (ctx: Context) => {
  if (ctx.from === undefined) {
    return;
  }

  const creationDate = getAge(ctx.from.id);
  const ageString = ctx.i18n.t(creationDate[0]) + " " + creationDate[1];
  (ctx.from as any).created = ageString;
  const msgText = treeify.renderTree(ctx.from as any, ctx.i18n.t("me_header"));
  const result = [
    {
      type: "article" as const,
      id: "me_" + ctx.from.id,
      title: ctx.i18n.t("inline_query_your_info_header"),
      description: ctx.i18n.t("inline_query_your_info_text"),
      input_message_content: {
        message_text: msgText,
        parse_mode: "HTML" as const,
        disable_web_page_preview: true,
      },
    },
  ];
  ctx.answerInlineQuery(result, {
    is_personal: true,
    cache_time: 30,
  });
});

const getUsername = async function (): Promise<void> {
  const botInfo = await bot.telegram.getMe();
  botName = botInfo.username || "";
};
getUsername();

// Enable graceful stop:
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

console.log(
  `Starting longPolling (chat_id of bot: ${BOT_TOKEN.split(":")[0]})...`,
);
bot.launch();
