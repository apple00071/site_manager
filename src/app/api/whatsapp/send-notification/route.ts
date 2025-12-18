import { NextRequest, NextResponse } from 'next/server';
import { sendTaskWhatsAppNotification, sendProjectWhatsAppNotification, sendSnagWhatsAppNotification, sendProposalWhatsAppNotification, sendInvoiceWhatsAppNotification } from '@/lib/whatsapp';

export async function POST(request: NextRequest) {
  try {
    const { type, phoneNumber, taskTitle, projectName, status, updateType, description, proposalTitle, invoiceNumber, amount } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    let success = false;

    switch (type) {
      case 'task':
        if (!taskTitle) {
          return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
        }
        success = await sendTaskWhatsAppNotification(phoneNumber, taskTitle, projectName, status);
        break;

      case 'project':
        if (!projectName || !updateType) {
          return NextResponse.json({ error: 'Project name and update type are required' }, { status: 400 });
        }
        success = await sendProjectWhatsAppNotification(phoneNumber, projectName, updateType);
        break;

      case 'snag':
        if (!description || !projectName || !status) {
          return NextResponse.json({ error: 'Description, project name, and status are required' }, { status: 400 });
        }
        success = await sendSnagWhatsAppNotification(phoneNumber, description, projectName, status);
        break;

      case 'proposal':
        if (!proposalTitle || !projectName || !status) {
          return NextResponse.json({ error: 'Proposal title, project name, and status are required' }, { status: 400 });
        }
        success = await sendProposalWhatsAppNotification(phoneNumber, proposalTitle, projectName, status);
        break;

      case 'invoice':
        if (!invoiceNumber || !projectName || !status) {
          return NextResponse.json({ error: 'Invoice number, project name, and status are required' }, { status: 400 });
        }
        success = await sendInvoiceWhatsAppNotification(phoneNumber, invoiceNumber, projectName, status, amount);
        break;

      default:
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    if (success) {
      return NextResponse.json({ success: true, message: 'WhatsApp notification sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send WhatsApp notification' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in WhatsApp notification API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
