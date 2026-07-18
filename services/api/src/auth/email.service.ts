/**
 * @fileoverview Envío de emails vía SMTP (OTP, etc.).
 */
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getSystemSettingsRuntime } from '../system-settings/system-settings.client';

const OTP_VALID_MINUTES = 5;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOtpEmailHtml(params: {
  code: string;
  magicLinkHtml: string;
  domainLineHtml: string;
}): string {
  const safeCode = escapeHtml(params.code);
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Código Ariadne</title>
</head>
<body style="margin:0;padding:0;background-color:#ececf4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#ececf4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(24,18,43,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#2d2640 0%,#1e1b2e 45%,#312e81 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-family:Inter,Segoe UI,system-ui,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#f5f3ff;">Ariadne</p>
              <p style="margin:10px 0 0;font-family:Inter,Segoe UI,system-ui,sans-serif;font-size:13px;font-weight:500;color:rgba(245,243,255,0.78);">Acceso seguro</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:Inter,Segoe UI,system-ui,sans-serif;">
              <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#475569;text-align:center;">Tu código de un solo uso es:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
                <tr>
                  <td align="center" style="background:linear-gradient(180deg,#faf5ff 0%,#f3e8ff 100%);border:1px solid #e9d5ff;border-radius:16px;padding:22px 16px;">
                    <p style="margin:0;font-family:ui-monospace,Courier New,monospace;font-size:34px;font-weight:700;letter-spacing:0.42em;color:#4c1d95;text-indent:0.42em;">${safeCode}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#64748b;text-align:center;">Introduce este código en la pantalla de inicio de sesión de Ariadne.</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#94a3b8;text-align:center;">Caduca en <strong style="color:#64748b;">${String(OTP_VALID_MINUTES)} minutos</strong>. Si no solicitaste este acceso, puedes ignorar este mensaje.</p>
              ${params.magicLinkHtml}
              ${params.domainLineHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;font-family:Inter,Segoe UI,system-ui,sans-serif;">
              <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;">Ariadne / AriadneSpecs · mapa de arquitectura y conocimiento del código</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;
  private transporterKey: string | null = null;

  private async getTransporter(): Promise<Transporter | null> {
    const cfg = await getSystemSettingsRuntime();
    const { host, port, user, pass } = cfg.smtp;
    if (!host || !user || !pass) return null;

    const key = `${host}:${port}:${user}`;
    if (this.transporter && this.transporterKey === key) return this.transporter;

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.transporterKey = key;
    } catch (e) {
      console.error('[email] createTransport falló:', (e as Error)?.message ?? e);
      this.transporter = null;
      this.transporterKey = null;
      return null;
    }

    return this.transporter;
  }

  /** Envía OTP por email. Devuelve true si se envió correctamente. */
  async sendOtp(to: string, code: string): Promise<boolean> {
    const cfg = await getSystemSettingsRuntime();
    const trans = await this.getTransporter();
    if (!trans) {
      console.warn('[email] SMTP no configurado (host, user, pass en Ajustes → Sistema)');
      return false;
    }

    const fromName = cfg.smtp.from || 'Ariadne';
    const fromUser = cfg.smtp.user || 'noreply@localhost';

    const rawHost = (cfg.webAppHost || '').trim().toLowerCase();
    const appHost = rawHost
      ? rawHost.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/^\./, '')
      : null;
    const domainLine = appHost && /^[\w.-]+$/.test(appHost) && !appHost.includes('..')
      ? `@${appHost} #${code}`
      : null;
    const magicLink = domainLine
      ? `https://${appHost}/auth/magic-link?otp=${code}&email=${encodeURIComponent(to)}`
      : null;

    const textLines = [
      'ARIADNE — Código de acceso',
      '',
      code,
      '',
      `Introduce este código en el inicio de sesión. Caduca en ${String(OTP_VALID_MINUTES)} minutos.`,
      '',
      'Si no solicitaste este correo, ignóralo.',
    ];
    if (domainLine) textLines.push('', domainLine);
    if (magicLink) textLines.push('', `Abrir enlace (opcional): ${magicLink}`);
    const textBody = textLines.join('\n');

    const htmlMagicLink = magicLink
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
           <tr>
             <td align="center" style="padding:8px 0 4px;">
               <a href="${escapeHtml(magicLink)}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);color:#ffffff;font-family:Inter,Segoe UI,system-ui,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 2px 12px rgba(91,33,182,0.35);">Abrir Ariadne</a>
             </td>
           </tr>
           <tr>
             <td align="center" style="padding:0 0 8px;">
               <p style="margin:0;font-size:12px;color:#94a3b8;">O copia el código de la tarjeta superior.</p>
             </td>
           </tr>
         </table>`
      : '';

    const htmlDomainLine = domainLine
      ? `<p style="margin:16px 0 0;padding:12px 14px;background:#f8fafc;border-radius:10px;font-size:12px;color:#64748b;word-break:break-all;font-family:ui-monospace,monospace;text-align:center;border:1px solid #e2e8f0;">${escapeHtml(domainLine)}</p>`
      : '';

    const html = buildOtpEmailHtml({
      code,
      magicLinkHtml: htmlMagicLink,
      domainLineHtml: htmlDomainLine,
    });

    try {
      await trans.sendMail({
        from: `"${fromName}" <${fromUser}>`,
        to,
        subject: `Ariadne — Tu código de acceso (${code})`,
        text: textBody,
        html,
      });
      return true;
    } catch (err) {
      console.error('[email] Error enviando OTP:', (err as Error)?.message ?? err);
      return false;
    }
  }
}
