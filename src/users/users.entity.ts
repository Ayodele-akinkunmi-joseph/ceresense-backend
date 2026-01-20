import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

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

  @Column({ name: 'reset_password_token', nullable: true, type: 'varchar' })
  @Exclude()
  resetPasswordToken: string | null; // Make it explicitly nullable

  @Column({ name: 'reset_password_expires', nullable: true, type: 'timestamp' })
  @Exclude()
  resetPasswordExpires: Date | null; // Make it explicitly nullable

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}