import emailjs from '@emailjs/browser';

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';

interface ComplaintEmailData {
  complaintId: string;
  originalText: string;
  translatedText: string;
  category: string;
  department: string;
  departmentEmail: string;
  urgency: string;
  emotion: string;
  location: string;
  areaName: string;
  userEmail: string;
  userName: string;
}

export async function sendComplaintEmail(data: ComplaintEmailData): Promise<boolean> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn('[EmailJS] Credentials not configured — skipping email');
    return false;
  }

  try {
    const templateParams = {
      to_email: data.departmentEmail || 'squardsummit@gmail.com',
      complaint_id: data.complaintId?.slice(0, 8).toUpperCase() || 'N/A',
      from_name: data.userName || 'Anonymous',
      from_email: data.userEmail || 'N/A',
      category: data.category || 'General',
      department: data.department || 'General',
      urgency: data.urgency || 'Medium',
      emotion: data.emotion || 'Neutral',
      original_text: data.originalText || 'N/A',
      translated_text: data.translatedText || data.originalText || 'N/A',
      location: data.areaName
        ? `${data.areaName} (${data.location})`
        : data.location || 'Not available',
      maps_link: data.location
        ? `https://www.google.com/maps?q=${data.location}`
        : '',
      submitted_at: new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('[EmailJS] Complaint email sent successfully');
    return true;
  } catch (error) {
    console.error('[EmailJS] Failed to send email:', error);
    return false;
  }
}
