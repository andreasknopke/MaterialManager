import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { type, subject, description, screenshot } = req.body;

    if (!type || !subject || !description) {
      return res.status(400).json({ error: 'Typ, Betreff und Beschreibung sind erforderlich.' });
    }

    // Sende E-Mail (Fallback: Logge das Ticket, wenn SMTP nicht konfiguriert ist)
    const userEmail = (req.user as any)?.email || 'unknown';

    try {
      let transporter: any = null;
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Dynamischer Import, falls nodemailer nicht installiert ist
        const nodemailer = require('nodemailer');
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      }

      if (transporter) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: process.env.FEEDBACK_EMAIL || process.env.SMTP_USER,
          subject: `[${type}] ${subject}`,
          text: `Typ: ${type}\nBetreff: ${subject}\nBeschreibung:\n${description}\n\nGemeldet von: ${userEmail}`,
          attachments: screenshot
            ? [
                {
                  filename: 'screenshot.png',
                  content: screenshot.replace(/^data:image\/\w+;base64,/, ''),
                  encoding: 'base64',
                },
              ]
            : undefined,
        });
      } else {
        console.log('SMTP nicht konfiguriert – Feedback wird nur geloggt:');
        console.log(JSON.stringify({ type, subject, description, user: userEmail }, null, 2));
      }
    } catch (emailErr) {
      console.error('Fehler beim Senden der Feedback-E-Mail:', emailErr);
      // Trotzdem Erfolg melden, um den Nutzer nicht zu verunsichern
    }

    res.json({ message: 'Ticket erfolgreich gesendet.' });
  } catch (error: any) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Interner Fehler beim Senden des Tickets.' });
  }
});

export default router;
