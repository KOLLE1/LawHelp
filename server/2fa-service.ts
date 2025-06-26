import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

// Gmail SMTP configuration interface
interface EmailConfig {
  gmail: {
    user: string;
    pass: string; // App password, not regular password
  };
  from: {
    name: string;
    address: string;
  };
}

export class TwoFactorService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    // Initialize Gmail SMTP configuration
    this.config = {
      gmail: {
        user: process.env.GMAIL_USER || 'your-email@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password',
      },
      from: {
        name: process.env.FROM_NAME || 'LawHelp',
        address: process.env.FROM_EMAIL || 'your-email@gmail.com',
      },
    };

    // Create Gmail transporter
    this.transporter = createTransport({
      service: 'gmail',
      auth: {
        user: this.config.gmail.user,
        pass: this.config.gmail.pass,
      },
    });
  }

  /**
   * Verify Gmail SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Gmail SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('Gmail SMTP connection failed:', error);
      return false;
    }
  }

  /**
   * Generate TOTP secret and QR code for user setup
   */
  async generateTOTPSecret(userEmail: string, appName: string = 'LawHelp'): Promise<TwoFactorSetup> {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: appName,
      length: 32,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32!,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Generate backup codes for 2FA
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Verify TOTP code
   */
  verifyTOTP(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      token,
      window: 1, // Allow 1 window of time drift
      encoding: 'base32',
    });
  }

  /**
   * Generate 6-digit verification code for email
   */
  generateEmailCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Get email subject based on type
   */
  private getEmailSubject(type: string): string {
    switch (type) {
      case 'email_verification':
        return 'Verify Your Email Address - LawHelp';
      case '2fa_email':
        return 'Two-Factor Authentication Code - LawHelp';
      case 'password_reset':
        return 'Password Reset Verification - LawHelp';
      case 'registration':
        return 'Complete Your Registration - LawHelp';
      case 'login':
        return 'Login Verification Code - LawHelp';
      default:
        return 'Verification Code - LawHelp';
    }
  }

  /**
   * Get email message based on type
   */
  private getEmailMessage(code: string, type: string): string {
    const baseMessage = `Your verification code is: ${code}`;
    
    switch (type) {
      case 'email_verification':
        return `${baseMessage}\n\nPlease use this code to verify your email address. This code will expire in 24 hours.`;
      case '2fa_email':
        return `${baseMessage}\n\nPlease use this code to complete your two-factor authentication. This code will expire in 10 minutes.`;
      case 'password_reset':
        return `${baseMessage}\n\nPlease use this code to reset your password. This code will expire in 1 hour.`;
      case 'registration':
        return `${baseMessage}\n\nWelcome to LawHelp! Please use this code to complete your registration. This code will expire in 10 minutes.`;
      case 'login':
        return `${baseMessage}\n\nPlease use this code to complete your login. This code will expire in 5 minutes.`;
      default:
        return `${baseMessage}\n\nThis code will expire soon, please use it promptly.`;
    }
  }

  /**
   * Get HTML email template based on type
   */
  private getEmailHTML(code: string, type: string): string {
    const subject = this.getEmailSubject(type);
    const message = this.getEmailMessage(code, type);
    
    // Color scheme based on type
    const colorSchemes = {
      email_verification: { primary: '#4CAF50', secondary: '#e8f5e8' },
      '2fa_email': { primary: '#2196F3', secondary: '#e3f2fd' },
      password_reset: { primary: '#FF9800', secondary: '#fff3e0' },
      registration: { primary: '#4CAF50', secondary: '#e8f5e8' },
      login: { primary: '#2196F3', secondary: '#e3f2fd' },
      default: { primary: '#6c757d', secondary: '#f8f9fa' }
    };

    const colors = colorSchemes[type as keyof typeof colorSchemes] || colorSchemes.default;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4; 
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 0 20px rgba(0,0,0,0.1); 
          }
          .header { 
            background: ${colors.primary}; 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: 600; 
          }
          .content { 
            padding: 40px 30px; 
            text-align: center; 
          }
          .content p { 
            margin: 0 0 20px 0; 
            color: #555; 
            font-size: 16px; 
          }
          .code-container { 
            background: ${colors.secondary}; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 30px 0; 
          }
          .code { 
            font-size: 36px; 
            font-weight: bold; 
            letter-spacing: 8px; 
            color: ${colors.primary}; 
            font-family: 'Courier New', monospace; 
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            border-top: 1px solid #e9ecef; 
          }
          .footer p { 
            margin: 0; 
            color: #6c757d; 
            font-size: 14px; 
          }
          .logo { 
            font-size: 20px; 
            font-weight: bold; 
            color: white; 
            margin-bottom: 10px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">⚖️ LawHelp</div>
            <h1>${subject.replace(' - LawHelp', '')}</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${message.split('\n\n')[1] || 'Please use the verification code below:'}</p>
            <div class="code-container">
              <div class="code">${code}</div>
            </div>
            <p><strong>Important:</strong> If you didn't request this code, please ignore this email and contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from LawHelp. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} LawHelp. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send verification code via Gmail SMTP
   */
  async sendEmailCode(email: string, code: string, type: string = 'verification'): Promise<void> {
    try {
      const subject = this.getEmailSubject(type);
      const textMessage = this.getEmailMessage(code, type);
      const htmlMessage = this.getEmailHTML(code, type);

      const mailOptions = {
        from: {
          name: this.config.from.name,
          address: this.config.from.address,
        },
        to: email,
        subject: subject,
        text: textMessage,
        html: htmlMessage,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent successfully to ${email}:`, info.messageId);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error(`Email sending failed: ${error}`);
    }
  }

  /**
   * Validate email code format
   */
  isValidEmailCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate TOTP code format
   */
  isValidTOTPCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate backup code format
   */
  isValidBackupCode(code: string): boolean {
    return /^[A-Z0-9]{8}$/.test(code);
  }

  /**
   * Generate a secure random backup code
   */
  generateSecureBackupCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Create and export singleton instance
export const twoFactorService = new TwoFactorService();

// Updated send verification code function
export async function sendVerificationCode(email: string, code: string, type: string): Promise<void> {
  try {
    // Verify connection before sending (optional, for debugging)
    const isConnected = await twoFactorService.verifyConnection();
    if (!isConnected) {
      throw new Error('Gmail SMTP connection failed');
    }

    await twoFactorService.sendEmailCode(email, code, type);
    console.log(`Verification email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    // For development purposes, also log the code
    console.log(`Verification code for ${email} (${type}): ${code}`);
    throw error;
  }
}