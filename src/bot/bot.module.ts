import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { UsersService } from './users.service';

@Module({
  providers: [BotUpdate, UsersService],
})
export class BotModule {}
