import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BlogPost } from '../blog/blog.entity'; // Add this import
import { Comment } from '../blog/blog.entity'; // Add this import

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.ADMIN,
  })
  role: UserRole;

  @Column({ name: 'reset_password_token', nullable: true, type: 'varchar' })
  @Exclude()
  resetPasswordToken: string | null;

  @Column({ name: 'reset_password_expires', nullable: true, type: 'timestamp' })
  @Exclude()
  resetPasswordExpires: Date | null;

  // Add OTP columns
  @Column({ name: 'otp_code', nullable: true, type: 'varchar' })
  @Exclude()
  otpCode: string | null;

  @Column({ name: 'otp_expires', nullable: true, type: 'timestamp' })
  @Exclude()
  otpExpires: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Add relationships to blog posts and comments
  @OneToMany(() => BlogPost, blogPost => blogPost.author)
  blogPosts: BlogPost[];

  @OneToMany(() => Comment, comment => comment.user)
  comments: Comment[];
}