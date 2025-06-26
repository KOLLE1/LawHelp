import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import fetch from 'node-fetch';
import MailtrapClient from 'mailtrap'


export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export class TwoFactorService {
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
   * Send verification code via FormSubmit
   */
  async sendEmailCode(email: string, code: string, type: string = 'verification'): Promise<void> {
    // const subject = this.getEmailSubject(type);
    // const message = this.getEmailMessage(code, type);

    console.log(`code: ${code}`)
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
      default:
        return `${baseMessage}\n\nThis code will expire soon, please use it promptly.`;
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
}

export const twoFactorService = new TwoFactorService();