# Tag-All Telegram Bot (NestJS)

A small NestJS bot that mentions every group member it has seen with a single
`/tagall` command.

## Why "members it has seen"?

The Telegram Bot API **does not expose a full group member list** to bots.
Only chat administrators can be fetched directly. Every "tag all" bot works the
same way: it collects users as they post messages in the group and mentions
that collected set when asked.

This bot:

- Tracks any non-bot user who sends a message in the group.
- Adds users from `new_chat_members` events.
- Removes users on `left_chat_member` events.
- Persists the list to a JSON file so it survives restarts.

## Requirements

- Node.js 18+
- A bot token from [@BotFather](https://t.me/BotFather)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and put your BOT_TOKEN
```

### Important BotFather settings

For the bot to see every message in the group (and therefore track members),
go to `@BotFather` -> `/mybots` -> *your bot* -> **Bot Settings** ->
**Group Privacy** -> **Turn off**. Then remove and re-add the bot to the group.

Add the bot to your group. Promoting it to admin is recommended.

## Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Commands

| Command   | Where    | Description                                      |
| --------- | -------- | ------------------------------------------------ |
| `/tagall` | In group | Mentions every tracked member of the group       |
| `/count`  | In group | Shows how many members have been tracked         |
| `/help`   | Anywhere | Lists available commands                         |
| `/start`  | Anywhere | Friendly welcome message                         |

Mentions are sent in chunks of 50 users to stay under Telegram's message-length
limit. Users without a `@username` are mentioned via a clickable text mention.

## Project structure

```
src/
  main.ts                 # Nest bootstrap
  app.module.ts           # Wires Config + Telegraf + Bot modules
  bot/
    bot.module.ts
    bot.update.ts         # Commands & message handlers
    users.service.ts      # File-backed user store per chat
```
