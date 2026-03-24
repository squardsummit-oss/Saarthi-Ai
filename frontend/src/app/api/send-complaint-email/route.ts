import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      complaintId,
      originalText,
      translatedText,
      category,
      department,
      urgency,
      emotion,
      location,
      areaName,
      userEmail,
      userName,
      imageData, // base64 data URI or null
    } = body;

    // SMTP config from environment
    const smtpEmail = process.env.SMTP_EMAIL;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const helplineEmail = process.env.HELPLINE_EMAIL || smtpEmail;

    if (!smtpEmail || !smtpPassword) {
      console.error('[Email] SMTP credentials not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    // Build urgency color for HTML
    const urgencyColors: Record<string, string> = {
      Critical: '#ff1744',
      High: '#ff5252',
      Medium: '#ffab40',
      Low: '#66bb6a',
    };
    const urgencyColor = urgencyColors[urgency] || '#ffab40';

    // Build attachments array if image exists
    const attachments: { filename: string; content: string; encoding: string; cid: string }[] = [];
    if (imageData && imageData.startsWith('data:image')) {
      // Extract base64 content from data URI
      const base64Content = imageData.split(',')[1];
      const mimeType = imageData.split(';')[0].split(':')[1];
      const ext = mimeType?.split('/')[1] || 'png';
      attachments.push({
        filename: `complaint-photo.${ext}`,
        content: base64Content,
        encoding: 'base64',
        cid: 'complaint-photo',
      });
    }

    // HTML email body
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #0a0a0a; border-radius: 16px; overflow: hidden; border: 1px solid #222;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 28px 32px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">🛡️ SAARTHI AI</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">New Grievance Report — Complaint #${complaintId?.slice(0, 8).toUpperCase() || 'N/A'}</p>
        </div>
        
        <!-- Urgency Banner -->
        <div style="background: ${urgencyColor}15; border-bottom: 2px solid ${urgencyColor}; padding: 12px 32px; display: flex; align-items: center;">
          <span style="color: ${urgencyColor}; font-weight: 700; font-size: 14px;">⚡ Urgency: ${urgency || 'Medium'}</span>
          <span style="color: #888; margin-left: 16px; font-size: 13px;">Category: ${category || 'General'}</span>
        </div>

        <!-- Body -->
        <div style="padding: 28px 32px;">
          <!-- Complainant Info -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">Complainant</div>
            <div style="color: #e0e0e0; font-size: 14px;">
              <strong>${userName || 'N/A'}</strong>
              ${userEmail ? ` &middot; <a href="mailto:${userEmail}" style="color: #667eea;">${userEmail}</a>` : ''}
            </div>
          </div>

          <!-- Complaint Text -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">Complaint (Original)</div>
            <div style="background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 16px; color: #e0e0e0; font-size: 14px; line-height: 1.7;">
              ${originalText || 'N/A'}
            </div>
          </div>

          ${translatedText && translatedText !== originalText ? `
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">English Translation</div>
            <div style="background: #111; border: 1px solid #2a2a2a; border-left: 3px solid #66bb6a; border-radius: 10px; padding: 16px; color: #e0e0e0; font-size: 14px; line-height: 1.7;">
              ${translatedText}
            </div>
          </div>
          ` : ''}

          <!-- Details Grid -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 140px; background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px;">
              <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Department</div>
              <div style="color: #667eea; font-weight: 700; font-size: 14px;">${department || 'General'}</div>
            </div>
            <div style="flex: 1; min-width: 140px; background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px;">
              <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Emotion</div>
              <div style="color: #e0e0e0; font-weight: 600; font-size: 14px;">${emotion || 'Neutral'}</div>
            </div>
          </div>

          <!-- Location -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">📍 Location</div>
            <div style="background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px;">
              <div style="color: #e0e0e0; font-size: 14px; font-weight: 600;">${areaName || 'Not available'}</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px; font-family: monospace;">${location || 'GPS not available'}</div>
              ${location ? `<a href="https://www.google.com/maps?q=${location}" style="color: #667eea; font-size: 12px; text-decoration: none; margin-top: 6px; display: inline-block;">🗺️ View on Google Maps →</a>` : ''}
            </div>
          </div>

          <!-- Photo -->
          ${attachments.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">📸 Attached Photo</div>
            <div style="background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px; text-align: center;">
              <img src="cid:complaint-photo" alt="Complaint Photo" style="max-width: 100%; max-height: 400px; border-radius: 8px;" />
            </div>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background: #050505; padding: 20px 32px; text-align: center; border-top: 1px solid #222;">
          <p style="color: #666; font-size: 11px; margin: 0;">
            This is an automated alert from SAARTHI AI — Multilingual Grievance Portal.<br/>
            Submitted on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
          </p>
        </div>
      </div>
    `;

    // Send email
    await transporter.sendMail({
      from: `"SAARTHI AI Helpline" <${smtpEmail}>`,
      to: helplineEmail,
      replyTo: userEmail || smtpEmail,
      subject: `🛡️ [${urgency}] New Complaint — ${category || 'General'} | #${complaintId?.slice(0, 8).toUpperCase() || 'N/A'}`,
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
