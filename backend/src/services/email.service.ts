import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'console'; // 'console', 'smtp', 'sendgrid'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@materialmanager.local';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const sendVerificationEmail = async (email: string, token: string, username: string): Promise<void> => {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  
  const emailContent = {
    to: email,
    from: FROM_EMAIL,
    subject: 'E-Mail-Adresse verifizieren - Material Manager',
    text: `
Hallo ${username},

bitte verifizieren Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Link klicken:

${verificationUrl}

Dieser Link ist 24 Stunden gültig.

Mit freundlichen Grüßen
Material Manager Team
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1976d2; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
        }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>E-Mail-Adresse verifizieren</h2>
        <p>Hallo ${username},</p>
        <p>bitte verifizieren Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Button klicken:</p>
        <a href="${verificationUrl}" class="button">E-Mail verifizieren</a>
        <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>Dieser Link ist 24 Stunden gültig.</p>
        <div class="footer">
            <p>Wenn Sie diese E-Mail nicht angefordert haben, ignorieren Sie sie bitte.</p>
            <p>Material Manager Team</p>
        </div>
    </div>
</body>
</html>
    `,
  };

  await sendEmail(emailContent);
};

export const sendPasswordResetEmail = async (email: string, token: string, username: string): Promise<void> => {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  
  const emailContent = {
    to: email,
    from: FROM_EMAIL,
    subject: 'Passwort zurücksetzen - Material Manager',
    text: `
Hallo ${username},

Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.

Klicken Sie auf den folgenden Link, um ein neues Passwort zu setzen:

${resetUrl}

Dieser Link ist 1 Stunde gültig.

Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.

Mit freundlichen Grüßen
Material Manager Team
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #f44336; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
        }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Passwort zurücksetzen</h2>
        <p>Hallo ${username},</p>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.</p>
        <a href="${resetUrl}" class="button">Neues Passwort setzen</a>
        <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Dieser Link ist 1 Stunde gültig.</p>
        <div class="footer">
            <p>Wenn Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
            <p>Material Manager Team</p>
        </div>
    </div>
</body>
</html>
    `,
  };

  await sendEmail(emailContent);
};

interface EmailContent {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

const sendEmail = async (content: EmailContent): Promise<void> => {
  switch (EMAIL_SERVICE) {
    case 'console':
      // Entwicklungsmodus: Ausgabe in Console
      console.log('\n========== E-MAIL ==========');
      console.log('An:', content.to);
      console.log('Von:', content.from);
      console.log('Betreff:', content.subject);
      console.log('\n--- Text ---');
      console.log(content.text);
      console.log('============================\n');
      break;

    case 'smtp':
      // TODO: SMTP-Integration (z.B. mit nodemailer)
      console.log('SMTP E-Mail-Versand an:', content.to);
      // Beispiel:
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransport({...});
      // await transporter.sendMail(content);
      break;

    case 'sendgrid':
      // TODO: SendGrid-Integration
      console.log('SendGrid E-Mail-Versand an:', content.to);
      // Beispiel:
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send(content);
      break;

    default:
      console.log('E-Mail-Versand an:', content.to);
  }
};

export default {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
