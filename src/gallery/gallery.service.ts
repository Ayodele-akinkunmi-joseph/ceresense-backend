import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Between, FindOptionsWhere } from 'typeorm';
import { Gallery, GalleryCategory, GalleryStatus } from './gallery.entity';
import { User } from '../users/users.entity';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { FilterGalleryDto } from './dto/filter-gallery.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Gallery)
    private galleryRepository: Repository<Gallery>,
  ) {}

  async create(
    createGalleryDto: CreateGalleryDto,
    imageUrl: string,
    user: User,
  ): Promise<Gallery> {
    const gallery = this.galleryRepository.create({
      ...createGalleryDto,
      imageUrl,
      uploadedBy: user,
    });

    return await this.galleryRepository.save(gallery);
  }

  async findAll(filterDto: FilterGalleryDto): Promise<{
    data: Gallery[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { search, category, status, featured, tags, page = 1, limit = 10 } = filterDto;
    
    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<Gallery> = {};

    if (search) {
      where.title = Like(`%${search}%`);
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (featured !== undefined) {
      where.featured = featured;
    }

    if (tags && tags.length > 0) {
      where.tags = In(tags);
    }

    const [data, total] = await this.galleryRepository.findAndCount({
      where,
      relations: ['uploadedBy'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Gallery> {
    const gallery = await this.galleryRepository.findOne({
      where: { _id: id },
      relations: ['uploadedBy'],
    });

    if (!gallery) {
      throw new NotFoundException(`Gallery with ID ${id} not found`);
    }

    return gallery;
  }

  async update(
    id: string,
    updateGalleryDto: UpdateGalleryDto,
  ): Promise<Gallery> {
    const gallery = await this.findOne(id);

    Object.assign(gallery, updateGalleryDto);
    return await this.galleryRepository.save(gallery);
  }

  async remove(id: string): Promise<void> {
    const result = await this.galleryRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Gallery with ID ${id} not found`);
    }
  }

  async incrementViews(id: string): Promise<Gallery> {
    const gallery = await this.findOne(id);
    gallery.views += 1;
    return await this.galleryRepository.save(gallery);
  }

  async incrementDownloads(id: string): Promise<Gallery> {
    const gallery = await this.findOne(id);
    gallery.downloads += 1;
    return await this.galleryRepository.save(gallery);
  }

  async updateStatus(id: string, status: GalleryStatus): Promise<Gallery> {
    const gallery = await this.findOne(id);
    gallery.status = status;
    return await this.galleryRepository.save(gallery);
  }

  async toggleFeatured(id: string): Promise<Gallery> {
    const gallery = await this.findOne(id);
    gallery.featured = !gallery.featured;
    return await this.galleryRepository.save(gallery);
  }

  async findByCategory(category: GalleryCategory): Promise<Gallery[]> {
    return await this.galleryRepository.find({
      where: { category, status: GalleryStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getFeatured(): Promise<Gallery[]> {
    return await this.galleryRepository.find({
      where: { featured: true, status: GalleryStatus.ACTIVE },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async getStats() {
    const total = await this.galleryRepository.count();
    const active = await this.galleryRepository.count({ where: { status: GalleryStatus.ACTIVE } });
    const pending = await this.galleryRepository.count({ where: { status: GalleryStatus.PENDING } });
    const featured = await this.galleryRepository.count({ where: { featured: true } });
    
    const totalViews = await this.galleryRepository
      .createQueryBuilder('gallery')
      .select('SUM(gallery.views)', 'totalViews')
      .getRawOne();

    const totalDownloads = await this.galleryRepository
      .createQueryBuilder('gallery')
      .select('SUM(gallery.downloads)', 'totalDownloads')
      .getRawOne();

    return {
      total,
      active,
      pending,
      featured,
      totalViews: parseInt(totalViews.totalViews) || 0,
      totalDownloads: parseInt(totalDownloads.totalDownloads) || 0,
    };
  }

  async getCategoriesStats() {
    const categories = Object.values(GalleryCategory);
    const stats: { category: GalleryCategory; count: number }[] = [];

    for (const category of categories) {
      const count = await this.galleryRepository.count({ where: { category } });
      stats.push({ category, count });
    }

    return stats;
  }

  // FIXED: Image extension fix method with proper _id field
  async fixImageExtensions(): Promise<{
    fixed: number;
    notFound: number;
    total: number;
    details: Array<{ 
      _id: string; 
      oldUrl: string; 
      newUrl: string; 
      status: string;
      title?: string;
    }>;
  }> {
    console.log('🔍 Starting image extension fix...');
    
    // Get all gallery items
    const items = await this.galleryRepository.find();
    console.log(`📸 Found ${items.length} images to check`);
    
    let fixed = 0;
    let notFound = 0;
    const details = [];

    // Common image extensions to check
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    // Possible upload directories to check
    const possibleUploadDirs = [
      path.join(process.cwd(), 'uploads', 'gallery'),
      path.join(__dirname, '../../uploads/gallery'),
      path.join('/app/uploads/gallery'), // For Docker/Render
      path.join(process.cwd(), 'public', 'uploads', 'gallery'),
    ];

    for (const item of items) {
      // Extract the UUID/filename from the current path
      const currentPath = item.imageUrl || '';
      const uuid = currentPath.split('/').pop(); // Gets dd23f84217b330dcb6d900179bc48e8f
      
      // Skip if no UUID found
      if (!uuid) {
        console.log(`⚠️ No filename found for item ${item._id}`);
        details.push({
          _id: item._id,
          oldUrl: currentPath,
          newUrl: '',
          status: 'error - no filename',
          title: item.title
        });
        notFound++;
        continue;
      }
      
      // Check if it already has an extension
      if (uuid.includes('.')) {
        console.log(`⏭️ Skipping ${uuid} - already has extension`);
        details.push({
          _id: item._id,
          oldUrl: currentPath,
          newUrl: currentPath,
          status: 'skipped - already has extension',
          title: item.title
        });
        continue;
      }
      
      let found = false;
      let foundPath = '';
      
      // Try each extension
      for (const ext of extensions) {
        const fileName = `${uuid}${ext}`;
        
        // Check each possible directory
        for (const dir of possibleUploadDirs) {
          const fullPath = path.join(dir, fileName);
          
          try {
            if (fs.existsSync(fullPath)) {
              found = true;
              foundPath = fileName;
              console.log(`✅ Found: ${fileName} at ${dir}`);
              break;
            }
          } catch (err) {
            // Ignore errors, just continue checking
          }
        }
        
        if (found) break;
      }
      
      if (found && foundPath) {
        // Update database with correct path including extension
        const correctUrl = `/uploads/gallery/${foundPath}`;
        item.imageUrl = correctUrl;
        await this.galleryRepository.save(item);
        
        console.log(`✅ Fixed: ${uuid} → ${foundPath}`);
        fixed++;
        
        details.push({
          _id: item._id,
          oldUrl: currentPath,
          newUrl: correctUrl,
          status: 'fixed',
          title: item.title
        });
      } else {
        console.log(`❌ Not found: ${uuid} (no image file with common extensions)`);
        notFound++;
        
        // Try to find any file that starts with this UUID
        let alternativeFound = false;
        
        for (const dir of possibleUploadDirs) {
          try {
            if (fs.existsSync(dir)) {
              const files = fs.readdirSync(dir);
              const matchingFile = files.find(file => file.startsWith(uuid));
              
              if (matchingFile) {
                const correctUrl = `/uploads/gallery/${matchingFile}`;
                item.imageUrl = correctUrl;
                await this.galleryRepository.save(item);
                
                console.log(`✅ Fixed (alternative): ${uuid} → ${matchingFile}`);
                fixed++;
                alternativeFound = true;
                
                details.push({
                  _id: item._id,
                  oldUrl: currentPath,
                  newUrl: correctUrl,
                  status: 'fixed - alternative match',
                  title: item.title
                });
                break;
              }
            }
          } catch (err) {
            // Ignore errors
          }
        }
        
        if (!alternativeFound) {
          details.push({
            _id: item._id,
            oldUrl: currentPath,
            newUrl: '',
            status: 'not found',
            title: item.title
          });
        }
      }
    }
    
    const summary = {
      fixed,
      notFound,
      total: items.length,
      details
    };
    
    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed} images`);
    console.log(`   Not found: ${notFound} images`);
    console.log(`   Total: ${items.length} images`);
    
    return summary;
  }

  // Helper method to check if a file exists
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  // Method to get the correct image URL for a gallery item
  async getCorrectImageUrl(id: string): Promise<string> {
    const gallery = await this.findOne(id);
    
    // If URL already has extension, return it
    if (gallery.imageUrl.includes('.')) {
      return gallery.imageUrl;
    }
    
    // Try to find the file with extension
    const uuid = gallery.imageUrl.split('/').pop();
    if (!uuid) return gallery.imageUrl;
    
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    for (const ext of extensions) {
      const testPath = path.join(process.cwd(), 'uploads', 'gallery', `${uuid}${ext}`);
      if (await this.fileExists(testPath)) {
        const correctUrl = `/uploads/gallery/${uuid}${ext}`;
        // Update the database
        gallery.imageUrl = correctUrl;
        await this.galleryRepository.save(gallery);
        return correctUrl;
      }
    }
    
    return gallery.imageUrl;
  }
}
