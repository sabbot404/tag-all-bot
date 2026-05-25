import { Logger } from '@nestjs/common';
import { Command, Ctx, On, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UsersService, TrackedUser } from './users.service';

// Max users we can mention in a single Telegram message before it gets too long.
// We chunk mentions to stay safely below the 4096-char message limit.
const MENTIONS_PER_MESSAGE = 50;

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(private readonly users: UsersService) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    if (this.isPrivate(ctx)) {
      await ctx.reply(
        'Hi! Add me to a group and make me an admin. ' +
          'Once members chat, I will be able to tag everyone with /tagall.',
      );
      return;
    }
    await ctx.reply(
      'Tag-All bot is ready. I will collect members as they chat. ' +
        'Use /tagall to mention everyone I have seen.',
    );
  }

  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(
      [
        'Commands:',
        '/tagall - Mention every group member I have seen so far',
        '/count  - How many members I have tracked in this chat',
        '/help   - Show this message',
        '',
        'Note: Telegram does not let bots fetch a full group member list.',
        'I learn members as they send messages while I am in the group.',
      ].join('\n'),
    );
  }

  @Command('count')
  async onCount(@Ctx() ctx: Context) {
    if (!ctx.chat || this.isPrivate(ctx)) {
      await ctx.reply('Use this command in a group.');
      return;
    }
    const total = this.users.count(ctx.chat.id);
    await ctx.reply(`I have tracked ${total} member(s) in this chat.`);
  }

  @Command('tagall')
  async onTagAll(@Ctx() ctx: Context) {
    if (!ctx.chat || this.isPrivate(ctx)) {
      await ctx.reply('Use /tagall inside a group.');
      return;
    }

    const tracked = this.users.getUsers(ctx.chat.id);

    if (tracked.length === 0) {
      await ctx.reply(
        'I have no members tracked yet. Ask people to send a message first.',
      );
      return;
    }

    const mentions = tracked.map((u) => this.buildMention(u));

    for (let i = 0; i < mentions.length; i += MENTIONS_PER_MESSAGE) {
      const chunk = mentions.slice(i, i + MENTIONS_PER_MESSAGE).join(' ');
      try {
        await ctx.reply(chunk, { parse_mode: 'HTML' });
      } catch (err: any) {
        this.logger.error(`Failed to send tagall chunk: ${err.message}`);
      }
    }
  }

  // Track everyone who sends any message in the group.
  @On('message')
  async onMessage(@Ctx() ctx: Context) {
    if (!ctx.chat || this.isPrivate(ctx)) return;
    if (!ctx.from || ctx.from.is_bot) return;

    const user: TrackedUser = {
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    };
    this.users.trackUser(ctx.chat.id, user);

    // Also catch newly added members so they get tracked immediately.
    const msg: any = ctx.message;
    if (msg?.new_chat_members && Array.isArray(msg.new_chat_members)) {
      for (const m of msg.new_chat_members) {
        if (m.is_bot) continue;
        this.users.trackUser(ctx.chat.id, {
          id: m.id,
          username: m.username,
          firstName: m.first_name,
          lastName: m.last_name,
        });
      }
    }

    // Remove users that leave the group.
    if (msg?.left_chat_member && !msg.left_chat_member.is_bot) {
      this.users.removeUser(ctx.chat.id, msg.left_chat_member.id);
    }
  }

  private isPrivate(ctx: Context): boolean {
    return ctx.chat?.type === 'private';
  }

  // Build an HTML mention. Prefer @username; fall back to a clickable text mention
  // using tg://user?id=... which works even for users without a username.
  private buildMention(user: TrackedUser): string {
    if (user.username) {
      return `@${user.username}`;
    }
    const name = this.escapeHtml(
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'user',
    );
    return `<a href="tg://user?id=${user.id}">${name}</a>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
