import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async enviarCorreo(to: string, subject: string, text: string) {
    try {
      await this.transporter.sendMail({
        from: `"WeTech Ventas" <${this.configService.get<string>('SMTP_USER')}>`,
        to,
        subject,
        text,
      });
    } catch (err) {
      throw new InternalServerErrorException(`Error al enviar el correo: ${err.message}`);
    }
  }
}
