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
  const stats: { category: GalleryCategory; count: number }[] = []; // Add type annotation

  for (const category of categories) {
    const count = await this.galleryRepository.count({ where: { category } });
    stats.push({ category, count });
  }

  return stats;
}
}