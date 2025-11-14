import { NextRequest, NextResponse } from 'next/server';
import { sendTaskWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, taskTitle, projectName, status } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (!taskTitle) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const success = await sendTaskWhatsAppNotification(phoneNumber, taskTitle, projectName, status);

    if (success) {
      return NextResponse.json({ success: true, message: 'Task WhatsApp notification sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send task WhatsApp notification' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in task WhatsApp notification API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
