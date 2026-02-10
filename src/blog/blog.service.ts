// src/blog/blog.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan, LessThan, Between } from 'typeorm';
import { BlogPost, Comment } from './blog.entity';
import { User } from '../users/users.entity';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FilterBlogDto } from './dto/filter-blog.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost)
    private blogRepository: Repository<BlogPost>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
  ) {}

async create(createBlogDto: CreateBlogDto, author: User): Promise<BlogPost> {
  const blogPost = this.blogRepository.create({
    ...createBlogDto,
    author,
    authorId: author.id,
    publishedAt: createBlogDto.isPublished ? new Date() : new Date(),  // Always set a date
  });

  return await this.blogRepository.save(blogPost);
}

  // In src/blog/blog.service.ts, update the findAll method:
async findAll(filterDto: FilterBlogDto): Promise<{ data: BlogPost[]; total: number; page: number; limit: number }> {
  const { page = 1, limit = 10, category, search, published = true } = filterDto;
  const skip = (page - 1) * limit;

  const query = this.blogRepository.createQueryBuilder('blog')
    .leftJoinAndSelect('blog.author', 'author')
    .select([
      'blog', 
      'author.id', 
      'author.fullName', // CHANGE FROM author.name TO author.fullName
      'author.email', 
      'author.role'
    ]);

  if (published) {
    query.andWhere('blog.isPublished = :published', { published: true });
  }

  if (category) {
    query.andWhere('blog.category = :category', { category });
  }

  if (search) {
    query.andWhere('(blog.title LIKE :search OR blog.content LIKE :search OR blog.excerpt LIKE :search)', {
      search: `%${search}%`,
    });
  }

  query.orderBy('blog.publishedAt', 'DESC');

  const [data, total] = await query
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

  async findOne(id: string): Promise<BlogPost> {
  const blogPost = await this.blogRepository.findOne({
    where: { id },
    relations: ['author'],
  });

  if (!blogPost) {
    throw new NotFoundException('Blog post not found');
  }

  // Increment views
  blogPost.views += 1;
  await this.blogRepository.save(blogPost);

  return blogPost;
}
  async update(id: string, updateBlogDto: UpdateBlogDto, user: User): Promise<BlogPost> {
    const blogPost = await this.findOne(id);

    // Check if user is author or admin
    if (blogPost.authorId !== user.id && user.role !== 'admin') {
      throw new BadRequestException('You can only edit your own posts');
    }

    Object.assign(blogPost, updateBlogDto);
    
    // Update publishedAt if publishing for the first time
    if (updateBlogDto.isPublished === true && !blogPost.publishedAt) {
      blogPost.publishedAt = new Date();
    }

    return await this.blogRepository.save(blogPost);
  }

  async remove(id: string, user: User): Promise<void> {
    const blogPost = await this.findOne(id);

    // Check if user is author or admin
    if (blogPost.authorId !== user.id && user.role !== 'admin') {
      throw new BadRequestException('You can only delete your own posts');
    }

    // Delete comments first
    await this.commentRepository.delete({ postId: id });
    
    await this.blogRepository.remove(blogPost);
  }

  async getStats(): Promise<{ total: number; published: number; draft: number; totalViews: number }> {
    const total = await this.blogRepository.count();
    const published = await this.blogRepository.count({ where: { isPublished: true } });
    const draft = await this.blogRepository.count({ where: { isPublished: false } });
    
    const totalViews = await this.blogRepository
      .createQueryBuilder('blog')
      .select('SUM(blog.views)', 'sum')
      .getRawOne();

    return {
      total,
      published,
      draft,
      totalViews: parseInt(totalViews.sum) || 0,
    };
  }

  async getCategoriesStats(): Promise<{ category: string; count: number }[]> {
    const result = await this.blogRepository
      .createQueryBuilder('blog')
      .select('blog.category', 'category')
      .addSelect('COUNT(blog.id)', 'count')
      .where('blog.isPublished = :published', { published: true })
      .groupBy('blog.category')
      .getRawMany();

    return result.map(item => ({
      category: item.category,
      count: parseInt(item.count),
    }));
  }

  async incrementLikes(id: string): Promise<BlogPost> {
    const blogPost = await this.findOne(id);
    blogPost.likes += 1;
    return await this.blogRepository.save(blogPost);
  }

  // Comment Methods
  async createComment(postId: string, createCommentDto: CreateCommentDto, user: User): Promise<Comment> {
    const post = await this.findOne(postId);
    
    const comment = this.commentRepository.create({
      ...createCommentDto,
      post,
      user,
      userId: user.id,
    });

    // If this is a reply, validate parent comment
    if (createCommentDto.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: createCommentDto.parentId, postId },
      });
      
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
      
      comment.parent = parent;
    }

    // Increment post comment count
    post.commentsCount += 1;
    await this.blogRepository.save(post);

    return await this.commentRepository.save(comment);
  }

  async getComments(postId: string): Promise<Comment[]> {
    return await this.commentRepository.find({
      where: { postId, parentId: null },
      relations: ['user', 'replies', 'replies.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async likeComment(commentId: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    comment.likes += 1;
    return await this.commentRepository.save(comment);
  }

  async deleteComment(commentId: string, user: User): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['post'],
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user is comment author or admin
    if (comment.userId !== user.id && user.role !== 'admin') {
      throw new BadRequestException('You can only delete your own comments');
    }

    // Decrement post comment count
    const post = comment.post;
    post.commentsCount -= 1;
    await this.blogRepository.save(post);

    await this.commentRepository.remove(comment);
  }
}