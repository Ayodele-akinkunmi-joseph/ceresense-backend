import { Injectable, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
  private readonly baseUploadDir = 'uploads';
  private readonly galleryDir = 'uploads/gallery';
  private readonly blogDir = 'uploads/blog';

  constructor() {
    // Create upload directories if they don't exist
    [this.galleryDir, this.blogDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getStorageConfig(type: 'gallery' | 'blog' = 'gallery') {
    const targetDir = type === 'gallery' ? this.galleryDir : this.blogDir;
    
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, targetDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${type}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.',
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    };
  }

  getFileUrl(filename: string, type: 'gallery' | 'blog' = 'gallery'): string {
    return `/uploads/${type}/${filename}`;
  }

  deleteFile(filename: string, type: 'gallery' | 'blog' = 'gallery'): void {
    const filePath = path.join(this.baseUploadDir, type, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async saveBase64Image(base64Data: string, type: 'gallery' | 'blog' = 'gallery'): Promise<string> {
    try {
      // Remove data URL prefix if present
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
      
      const buffer = Buffer.from(base64Image, 'base64');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `${type}-${uniqueSuffix}.jpg`;
      const filePath = path.join(this.baseUploadDir, type, filename);

      await fs.promises.writeFile(filePath, buffer);
      
      return this.getFileUrl(filename, type);
    } catch (error) {
      throw new BadRequestException('Failed to save base64 image');
    }
  }
}
