// Dynamic import of Wasender SDK will be used inside methods to avoid build-time failures

interface WhatsAppMessage {
  to: string;
  message: string;
  type?: 'text' | 'image' | 'document';
  mediaUrl?: string;
}

interface NotificationConfig {
  apiKey: string;
  instanceId: string;
}

class WhatsAppNotificationService {
  private api: any;
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.api = null;
  }

  private async ensureSdk(): Promise<boolean> {
    if (this.api) return true;
    try {
      // Attempt to load the SDK at runtime
      const mod: any = await import('wasenderapi');
      const Ctor = mod?.default || (mod as any)?.WhatsAppAPI || (mod as any)?.WasenderAPI;
      if (!Ctor) {
        console.warn('Wasender SDK loaded but API constructor not found');
        // Use direct REST API fallback
        this.api = {
          sendMessage: async (params: any) => {
            const url = `https://www.wasenderapi.com/api/send-message`;

            const payload = {
              to: `+${params.to}`,
              text: params.message
            };

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
            }

            return await response.json();
          }
        };
        return true;
      }

      this.api = new Ctor({
        apiKey: this.config.apiKey,
        instanceId: this.config.instanceId
      });
      return true;
    } catch (error) {
      console.error('Failed to initialize WhatsApp SDK:', error);
      return false;
    }
  }

  async sendTaskNotification(phoneNumber: string, taskTitle: string, projectName?: string, status?: string, link?: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = this.formatTaskMessage(taskTitle, projectName, status, link);

      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''), // Remove non-numeric characters
        message: message,
        type: 'text'
      });

      console.log('WhatsApp notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp notification:', error);
      return false;
    }
  }

  async sendProjectUpdateNotification(phoneNumber: string, projectName: string, updateType: 'created' | 'updated' | 'completed'): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = this.formatProjectMessage(projectName, updateType);

      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''),
        message: message,
        type: 'text'
      });

      console.log('WhatsApp project notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp project notification:', error);
      return false;
    }
  }

  async sendSnagNotification(phoneNumber: string, description: string, projectName: string, status: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = this.formatSnagMessage(description, projectName, status);

      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''),
        message: message,
        type: 'text'
      });

      console.log('WhatsApp snag notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp snag notification:', error);
      return false;
    }
  }

  async sendProposalNotification(phoneNumber: string, proposalTitle: string, projectName: string, status: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = this.formatProposalMessage(proposalTitle, projectName, status);

      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''),
        message: message,
        type: 'text'
      });

      console.log('WhatsApp proposal notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp proposal notification:', error);
      return false;
    }
  }

  async sendInvoiceNotification(phoneNumber: string, invoiceNumber: string, projectName: string, status: string, amount?: number): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = this.formatInvoiceMessage(invoiceNumber, projectName, status, amount);

      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''),
        message: message,
        type: 'text'
      });

      console.log('WhatsApp invoice notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp invoice notification:', error);
      return false;
    }
  }

  async sendCustomNotification(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) {
        console.error('SDK not ready');
        return false;
      }

      const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

      const result = await this.api.sendMessage({
        to: cleanPhone,
        message: message,
        type: 'text'
      });

      console.log('WhatsApp custom notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp custom notification:', error);
      return false;
    }
  }

  async sendDPRNotification(phoneNumber: string, pdfUrl: string, projectName: string, date: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = `🏢 *Daily Progress Report - ${projectName}*\n\nDate: ${date}\n\nA new DPR has been generated for your project. You can view the full report here:\n\n🔗 ${pdfUrl}`;

      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''),
        message: message,
        type: 'text' // For now sending as text link, can upgrade to document if SDK supports file buffer
      });

      console.log('WhatsApp DPR notification sent:', result);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp DPR notification:', error);
      return false;
    }
  }

  private formatTaskMessage(taskTitle: string, projectName?: string, status?: string, link?: string): string {
    let message = `📋 *Task Update*\n\n`;
    message += `*Task:* ${taskTitle}\n`;

    if (projectName) {
      message += `*Project:* ${projectName}\n`;
    }

    if (status) {
      const statusEmoji = this.getStatusEmoji(status);
      message += `*Status:* ${statusEmoji} ${status.replace('_', ' ').toUpperCase()}\n`;
    }

    message += `\n🔗 Login to your dashboard for more details.`;
    if (link) {
      message += `\n\nOpen: ${link}`;
    }

    return message;
  }

  private formatProjectMessage(projectName: string, updateType: 'created' | 'updated' | 'completed'): string {
    let message = `🏢 *Project Update*\n\n`;
    message += `*Project:* ${projectName}\n`;

    switch (updateType) {
      case 'created':
        message += `*Status:* ✅ CREATED\n`;
        message += `Your new project has been created successfully.`;
        break;
      case 'updated':
        message += `*Status:* 🔄 UPDATED\n`;
        message += `Project details have been updated.`;
        break;
      case 'completed':
        message += `*Status:* 🎉 COMPLETED\n`;
        message += `Congratulations! Your project has been completed.`;
        break;
    }

    message += `\n🔗 Login to your dashboard for more details.`;

    return message;
  }

  private formatSnagMessage(description: string, projectName: string, status: string): string {
    let message = `⚠️ *Snag Update*\n\n`;
    message += `*Project:* ${projectName}\n`;
    message += `*Snag:* ${description}\n`;

    const statusEmoji = this.getStatusEmoji(status);
    message += `*Status:* ${statusEmoji} ${status.toUpperCase()}\n`;

    message += `\n🔗 Login to your dashboard for more details.`;

    return message;
  }

  private formatProposalMessage(proposalTitle: string, projectName: string, status: string): string {
    let message = `📄 *Proposal Update*\n\n`;
    message += `*Project:* ${projectName}\n`;
    message += `*Proposal:* ${proposalTitle}\n`;
    message += `*Status:* ${status.toUpperCase()}\n`;
    message += `\n🔗 Login to your dashboard for more details.`;
    return message;
  }

  private formatInvoiceMessage(invoiceNumber: string, projectName: string, status: string, amount?: number): string {
    let message = `💰 *Invoice Update*\n\n`;
    message += `*Project:* ${projectName}\n`;
    message += `*Invoice:* ${invoiceNumber}\n`;
    if (amount) message += `*Amount:* ₹${amount}\n`;
    message += `*Status:* ${status.toUpperCase()}\n`;
    message += `\n🔗 Login to your dashboard for more details.`;
    return message;
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'todo':
      case 'open':
        return '📝';
      case 'in_progress':
      case 'assigned':
        return '🔄';
      case 'blocked':
        return '🚫';
      case 'done':
      case 'resolved':
      case 'verified':
      case 'closed':
        return '✅';
      default:
        return '📋';
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      if (typeof this.api.getAccountInfo === 'function') {
        const result = await this.api.getAccountInfo();
        console.log('WhatsApp API connection test:', result);
        return true;
      }
      // If SDK doesn’t expose getAccountInfo, consider SDK ready as success
      return true;
    } catch (error) {
      console.error('WhatsApp API connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let whatsappService: WhatsAppNotificationService | null = null;

export function getWhatsAppService(): WhatsAppNotificationService | null {
  if (!whatsappService) {
    const apiKey = process.env.WHATSAPP_API_KEY;
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;

    if (!apiKey || !instanceId) {
      console.warn('WhatsApp API credentials not configured');
      return null;
    }

    whatsappService = new WhatsAppNotificationService({
      apiKey,
      instanceId
    });
  }

  return whatsappService;
}

export async function sendTaskWhatsAppNotification(
  phoneNumber: string,
  taskTitle: string,
  projectName?: string,
  status?: string,
  link?: string
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendTaskNotification(phoneNumber, taskTitle, projectName, status, link);
}

export async function sendProjectWhatsAppNotification(
  phoneNumber: string,
  projectName: string,
  updateType: 'created' | 'updated' | 'completed'
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendProjectUpdateNotification(phoneNumber, projectName, updateType);
}

export async function sendSnagWhatsAppNotification(
  phoneNumber: string,
  description: string,
  projectName: string,
  status: string
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendSnagNotification(phoneNumber, description, projectName, status);
}

export async function sendProposalWhatsAppNotification(
  phoneNumber: string,
  proposalTitle: string,
  projectName: string,
  status: string
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendProposalNotification(phoneNumber, proposalTitle, projectName, status);
}

export async function sendInvoiceWhatsAppNotification(
  phoneNumber: string,
  invoiceNumber: string,
  projectName: string,
  status: string,
  amount?: number
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendInvoiceNotification(phoneNumber, invoiceNumber, projectName, status, amount);
}

export async function sendCustomWhatsAppNotification(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendCustomNotification(phoneNumber, message);
}

export async function sendDPRWhatsAppNotification(
  phoneNumber: string,
  pdfUrl: string,
  projectName: string,
  date: string
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) return false;
  return await service.sendDPRNotification(phoneNumber, pdfUrl, projectName, date);
}
