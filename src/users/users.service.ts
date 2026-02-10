import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { User } from './users.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return await this.usersRepository.save(user);
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { username } });
  }

  async findOneById(id: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { id } });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, updateData);
    return await this.usersRepository.save(user);
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(
      userId,
      {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        otpCode: null,
        otpExpires: null,
      }
    );
  }

  async setResetPasswordToken(email: string, token: string, expires: Date): Promise<void> {
    const user = await this.findOneByEmail(email);
    if (user) {
      user.resetPasswordToken = token;
      user.resetPasswordExpires = expires;
      await this.usersRepository.save(user);
    }
  }

  async findByResetToken(token: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: LessThan(new Date()),
      },
    });
  }

  async clearResetToken(userId: string): Promise<void> {
    await this.usersRepository.update(
      userId, 
      {
        resetPasswordToken: null,
        resetPasswordExpires: null,
      }
    );
  }

  // NEW OTP METHODS
  async setOtpCode(email: string, otpCode: string, otpExpires: Date): Promise<void> {
    await this.usersRepository.update(
      { email },
      { otpCode, otpExpires }
    );
  }

  async findByOtpCode(email: string, otpCode: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: {
        email,
        otpCode,
        otpExpires: MoreThan(new Date()), // OTP not expired
      }
    });
  }

  async clearOtpCode(email: string): Promise<void> {
    await this.usersRepository.update(
      { email },
      { otpCode: null, otpExpires: null }
    );
  }
}