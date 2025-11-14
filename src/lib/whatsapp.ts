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
        return false;
      }
      this.api = new Ctor(this.config.apiKey, this.config.instanceId);
      return true;
    } catch (e) {
      console.warn('Wasender SDK not available; skipping WhatsApp send. Error:', e);
      return false;
    }
  }

  async sendTaskNotification(phoneNumber: string, taskTitle: string, projectName?: string, status?: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const message = this.formatTaskMessage(taskTitle, projectName, status);
      
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

  async sendCustomNotification(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const sdkReady = await this.ensureSdk();
      if (!sdkReady) return false;
      const result = await this.api.sendMessage({
        to: phoneNumber.replace(/[^\d]/g, ''),
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

  private formatTaskMessage(taskTitle: string, projectName?: string, status?: string): string {
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

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'todo':
        return '📝';
      case 'in_progress':
        return '🔄';
      case 'blocked':
        return '🚫';
      case 'done':
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
  status?: string
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) {
    console.warn('WhatsApp service not available');
    return false;
  }
  
  return await service.sendTaskNotification(phoneNumber, taskTitle, projectName, status);
}

export async function sendProjectWhatsAppNotification(
  phoneNumber: string, 
  projectName: string, 
  updateType: 'created' | 'updated' | 'completed'
): Promise<boolean> {
  const service = getWhatsAppService();
  if (!service) {
    console.warn('WhatsApp service not available');
    return false;
  }
  
  return await service.sendProjectUpdateNotification(phoneNumber, projectName, updateType);
}
