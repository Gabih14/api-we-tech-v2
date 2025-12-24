import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Pedido } from '../src/pedido/entities/pedido.entity';
import { WhatsappService } from '../src/whatsapp/whatsapp.service';
import { MailerService } from '../src/mailer/mailer.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const pedidoRepo = app.get<Repository<Pedido>>(
    getRepositoryToken(Pedido, 'back'),
  );

  const whatsappService = app.get(WhatsappService);
  const mailerService = app.get(MailerService);

  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: npx ts-node -r tsconfig-paths/register scripts/test-notify.ts <id|external_id>');
    await app.close();
    process.exit(1);
  }

  let pedido: Pedido | null = null;

  // Try numeric id first
  if (/^\d+$/.test(arg)) {
    pedido = await pedidoRepo.findOne({
      where: { id: Number(arg) },
      relations: ['productos'],
    });
  }

  // Fallback to external_id
  if (!pedido) {
    pedido = await pedidoRepo.findOne({
      where: { external_id: arg },
      relations: ['productos'],
    });
  }

  if (!pedido) {
    console.error(`Pedido '${arg}' no encontrado.`);
    await app.close();
    process.exit(2);
  }

  console.log('Pedido encontrado:', { id: pedido.id, external_id: pedido.external_id, estado: pedido.estado });

  // Mark as approved locally so messages reflect approved state
  pedido.estado = 'APROBADO';
  pedido.aprobado = new Date();
  await pedidoRepo.save(pedido);

  // Prepare and send WhatsApp
  try {
    const waMsg = whatsappService.formatearMensajePedido(pedido as any);
    console.log('=== Mensaje WhatsApp ===\n', waMsg);
    await whatsappService.enviarMensaje(waMsg);
    console.log('WhatsApp enviado con éxito.');
  } catch (err: any) {
    console.error('Error enviando WhatsApp:', err?.message || err);
  }

  // Enviar también al delivery (si está configurado)
  try {
    const mensajeDelivery = whatsappService.formatearMensajeParaDelivery(pedido as any);
    const deliveryPhone = process.env.DELIVERY_WHATSAPP_PHONE;
    const deliveryApiKey = process.env.DELIVERY_WHATSAPP_API_KEY;
    if (deliveryPhone && deliveryApiKey) {
      console.log('=== Mensaje WhatsApp Delivery ===\n', mensajeDelivery);
      await whatsappService.enviarMensaje(mensajeDelivery, deliveryPhone, deliveryApiKey);
      console.log('WhatsApp a delivery enviado con éxito.');
    } else {
      console.warn('No se enviará WhatsApp a delivery: faltan DELIVERY_WHATSAPP_PHONE o DELIVERY_WHATSAPP_API_KEY');
    }
  } catch (err: any) {
    console.error('Error enviando WhatsApp a delivery:', err?.message || err);
  }

  // Prepare and send email to secretaria + cliente
  try {
    const secretariaEmail = process.env.SECRETARIA_EMAIL;
    const destinatarios = secretariaEmail
      ? `${secretariaEmail}, ${pedido.cliente_mail}`
      : pedido.cliente_mail;

    const productosHtml = (pedido.productos || [])
      .map(
        (p: any) => `
          <div>
            <strong>${p.nombre}</strong> — Cantidad: ${p.cantidad} — $${Number(p.precio_unitario).toFixed(2)}
          </div>
        `,
      )
      .join('');

    const html = `
      <h3>Pedido Aprobado (Prueba)</h3>
      <p>Cliente: ${pedido.cliente_nombre} (${pedido.cliente_mail})</p>
      <p>CUIT: ${pedido.cliente_cuit}</p>
      <div>${productosHtml}</div>
      <p>Total: $${Number(pedido.total).toFixed(2)}</p>
    `;

    console.log('Enviando correo a:', destinatarios);
    await mailerService.enviarCorreo(destinatarios, '📦 Pedido Aprobado - Prueba', html);
    console.log('Correo enviado con éxito.');
  } catch (err: any) {
    console.error('Error enviando correo:', err?.message || err);
  }

  await app.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Error en script test-notify:', err?.message || err);
  process.exit(99);
});
