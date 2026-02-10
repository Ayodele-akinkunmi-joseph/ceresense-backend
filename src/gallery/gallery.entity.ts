import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/users.entity';

export enum GalleryCategory {
  LEARNING = 'learning',
  PROJECTS = 'projects',
  EVENTS = 'events',
  WORKSHOPS = 'workshops',
  GRADUATION = 'graduation',
}

export enum GalleryStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  ARCHIVED = 'archived',
}

@Entity('gallery')
export class Gallery {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({
    type: 'enum',
    enum: GalleryCategory,
    default: GalleryCategory.PROJECTS,
  })
  category: GalleryCategory;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: false })
  featured: boolean;

  @Column()
  date: string; // Format: "Month Year"

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  downloads: number;

  @Column({
    type: 'enum',
    enum: GalleryStatus,
    default: GalleryStatus.PENDING,
  })
  status: GalleryStatus;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}