import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '../users/users.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ accessToken: string; user: any }> {
    const { fullName, username, email, password } = registerDto;

    // Check if user exists
    const existingUser = await this.usersService.findOneByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const existingUsername = await this.usersService.findOneByUsername(username);
    if (existingUsername) {
      throw new BadRequestException('Username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.usersService.create({
      fullName,
      username,
      email,
      password: hashedPassword,
    });

    // Generate token
    const payload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);

    // Remove password from response
    const { password: _, resetPasswordToken, resetPasswordExpires, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: any }> {
    const { username, password } = loginDto;

    // Find user by username or email
    let user = await this.usersService.findOneByUsername(username);
    if (!user) {
      user = await this.usersService.findOneByEmail(username);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate token
    const payload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);

    // Remove password from response
    const { password: _, resetPasswordToken, resetPasswordExpires, ...userWithoutPassword } = user;

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
      return { message: 'If an account exists with this email, you will receive a password reset link' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save token to user
    await this.usersService.setResetPasswordToken(email, resetToken, resetTokenExpiry);

    // Send email
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello ${user.fullName},</p>
          <p>You requested to reset your password. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new BadRequestException('Failed to send reset email');
    }

    return { message: 'If an account exists with this email, you will receive a password reset link' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersService.findByResetToken(token);
    
    if (!user) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await this.usersService.updatePassword(user.id, hashedPassword);

    // Send confirmation email
    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Password Reset Successful',
        html: `
          <h2>Password Reset Successful</h2>
          <p>Hello ${user.fullName},</p>
          <p>Your password has been successfully reset.</p>
          <p>If you did not perform this action, please contact support immediately.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
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