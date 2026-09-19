import type { ReactElement } from "react";
import nodemailer from "nodemailer";
import { render } from "react-email";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

// Initialize Nodemailer SMTP Transporter with connection pooling
const transporter = nodemailer.createTransport({
  pool: true, // Reuses connections instead of reconnecting
  maxConnections: 5, // Max concurrent SMTP connections
  maxMessages: 100, // Messages per connection before recycling
  
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
  text?: string;
  attachments?: EmailAttachment[];
}

// Universal email dispatcher with React Email rendering
const sendEmail = async ({
  to,
  subject,
  template,
  text,
  attachments,
}: SendEmailOptions): Promise<void> => {
  try {
    const emailHtml = await render(template);
    const plainText = text || (await render(template, { plainText: true }));
    const senderEmail = env.SMTP_FROM;

    const mailOptions = {
      from: `Liminal Studio <${senderEmail}>`,
      to,
      replyTo: senderEmail,
      subject,
      html: emailHtml,
      text: plainText,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    logger.error({ err: error, subject }, "Failed to dispatch email");
  }
};

export { sendEmail };
