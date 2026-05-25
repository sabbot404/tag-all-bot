import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface TrackedUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

// chatId -> userId -> TrackedUser
type Store = Record<string, Record<string, TrackedUser>>;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly dataFile: string;
  private store: Store = {};
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.dataFile = path.resolve(
      config.get<string>('DATA_FILE') ?? './data/users.json',
    );
  }

  async onModuleInit() {
    await this.load();
  }

  private async load() {
    try {
      const raw = await fs.readFile(this.dataFile, 'utf8');
      this.store = JSON.parse(raw);
      this.logger.log(`Loaded users store from ${this.dataFile}`);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.logger.log('No existing users store found, starting empty');
        this.store = {};
      } else {
        this.logger.error(`Failed to load store: ${err.message}`);
        this.store = {};
      }
    }
  }

  // Serialize writes so concurrent updates don't corrupt the JSON file.
  private persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
        await fs.writeFile(
          this.dataFile,
          JSON.stringify(this.store, null, 2),
          'utf8',
        );
      } catch (err: any) {
        this.logger.error(`Failed to persist store: ${err.message}`);
      }
    });
  }

  /**
   * Record (or update) a user seen in a given chat.
   * Returns true if a new user was added.
   */
  trackUser(chatId: number, user: TrackedUser): boolean {
    const chatKey = String(chatId);
    const userKey = String(user.id);

    if (!this.store[chatKey]) {
      this.store[chatKey] = {};
    }

    const existing = this.store[chatKey][userKey];
    const isNew = !existing;
    const changed =
      isNew ||
      existing.username !== user.username ||
      existing.firstName !== user.firstName ||
      existing.lastName !== user.lastName;

    this.store[chatKey][userKey] = user;

    if (changed) {
      this.persist();
    }
    return isNew;
  }

  removeUser(chatId: number, userId: number): void {
    const chatKey = String(chatId);
    const userKey = String(userId);
    if (this.store[chatKey] && this.store[chatKey][userKey]) {
      delete this.store[chatKey][userKey];
      this.persist();
    }
  }

  clearChat(chatId: number): void {
    const chatKey = String(chatId);
    if (this.store[chatKey]) {
      delete this.store[chatKey];
      this.persist();
    }
  }

  getUsers(chatId: number): TrackedUser[] {
    const chatKey = String(chatId);
    return Object.values(this.store[chatKey] ?? {});
  }

  count(chatId: number): number {
    return this.getUsers(chatId).length;
  }
}
