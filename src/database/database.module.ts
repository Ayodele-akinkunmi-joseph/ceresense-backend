import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/users.entity';
import { Gallery } from '../gallery/gallery.entity';
import { BlogPost, Comment } from '../blog/blog.entity'; // ADD THIS IMPORT

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined in environment variables');
        }

        // Parse the URL to extract components
        const url = new URL(databaseUrl);
        
        return {
          type: 'postgres',
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          username: url.username,
          password: url.password,
          database: url.pathname.substring(1), // Remove leading slash
          entities: [User, Gallery, BlogPost, Comment], // ADD BlogPost and Comment here
          synchronize: process.env.NODE_ENV !== 'production',
          ssl: {
            rejectUnauthorized: false,
          },
          extra: {
            ssl: {
              rejectUnauthorized: false,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}