import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { User, UserRole } from '../users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ accessToken: string; user: any }> {
    // ... keep your register method as is ...
    const { fullName, username, email, password } = registerDto;

    const existingUser = await this.usersService.findOneByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const existingUsername = await this.usersService.findOneByUsername(username);
    if (existingUsername) {
      throw new BadRequestException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.usersService.create({
      fullName,
      username,
      email,
      password: hashedPassword,
      role: UserRole.ADMIN,
    });

    const payload = { 
      sub: user.id, 
      username: user.username,
      role: user.role 
    };
    const accessToken = this.jwtService.sign(payload);

    const { password: _, resetPasswordToken, resetPasswordExpires, otpCode, otpExpires, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: any }> {
    // ... keep your login method as is ...
    const { username, password } = loginDto;

    let user = await this.usersService.findOneByUsername(username);
    if (!user) {
      user = await this.usersService.findOneByEmail(username);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      sub: user.id, 
      username: user.username,
      role: user.role 
    };
    const accessToken = this.jwtService.sign(payload);

    const { password: _, resetPasswordToken, resetPasswordExpires, otpCode, otpExpires, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      // Don't reveal that user doesn't exist for security
      return { message: 'If an account exists with this email, you will receive an OTP code' };
    }

    // ✅ FIXED: Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // ✅ FIXED: Save OTP using setOtpCode method (NOT setResetPasswordToken)
    await this.usersService.setOtpCode(email, otpCode, otpExpires);

    // ✅ FIXED: Send OTP email (NOT reset link email)
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset OTP - Ceresense',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; }
              .header h1 { color: white; margin: 0; }
              .content { padding: 30px; background: #f9f9f9; }
              .otp-box { 
                background: #fff; 
                border: 2px dashed #667eea;
                padding: 20px; 
                text-align: center; 
                font-size: 32px; 
                font-weight: bold; 
                letter-spacing: 10px;
                margin: 20px 0;
                color: #333;
                border-radius: 8px;
              }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              .note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 12px; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Ceresense</h1>
              </div>
              <div class="content">
                <h2>Password Reset OTP</h2>
                <p>Hello ${user.fullName},</p>
                <p>You requested to reset your password for your Ceresense account.</p>
                <p>Use the OTP code below to reset your password:</p>
                
                <div class="otp-box">${otpCode}</div>
                
                <div class="note">
                  <p><strong>⚠️ Important:</strong></p>
                  <p>1. Copy this 6-digit code</p>
                  <p>2. Go to the password reset page in your app</p>
                  <p>3. Enter this code along with your new password</p>
                </div>
                
                <p><strong>This OTP will expire in 10 minutes.</strong></p>
                <p>If you didn't request this, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Ceresense. All rights reserved.</p>
                <p>This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new BadRequestException('Failed to send OTP email');
    }

    return { message: 'If an account exists with this email, you will receive an OTP code' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { email, otp, newPassword } = resetPasswordDto;

    // ✅ FIXED: Find user by OTP (NOT by reset token)
    const user = await this.usersService.findByOtpCode(email, otp);
    
    if (!user) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ✅ FIXED: Update password (this will clear OTP in usersService.updatePassword)
    await this.usersService.updatePassword(user.id, hashedPassword);

    // Send confirmation email
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Successful - Ceresense',
        html: `
          <!DOCTYPE html>
          <html>
          <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #667eea;">Password Reset Successful</h2>
              <p>Hello ${user.fullName},</p>
              <p>Your password has been successfully reset.</p>
              <p>You can now login with your new password.</p>
              <p>If you did not perform this action, please contact support immediately.</p>
            </div>
          </body>
          </html>
        `,
      });
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      // Don't throw error - password was reset successfully
    }

    return { message: 'Password has been reset successfully' };
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      return null;
    }
    const { password, ...result } = user;
    return result;
  }
}