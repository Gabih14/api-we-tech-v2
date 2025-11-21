import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [ConfigModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}