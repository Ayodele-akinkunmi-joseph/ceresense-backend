import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gallery } from './gallery.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GalleryFixService {
  constructor(
    @InjectRepository(Gallery)
    private galleryRepository: Repository<Gallery>,
  ) {}

  async fixImageExtensions(): Promise<{
    fixed: number;
    notFound: number;
    total: number;
    details: Array<{ id: string; oldUrl: string; newUrl: string; status: string }>;
  }> {
    console.log('🔍 Starting image extension fix...');
    
    // Get all gallery items
    const items = await this.galleryRepository.find();
    console.log(`📸 Found ${items.length} images to check`);
    
    let fixed = 0;
    let notFound = 0;
    const details = [];

    for (const item of items) {
      // Extract the UUID from the current path
      const currentPath = item.imageUrl;
      const uuid = currentPath.split('/').pop(); // Gets dd23f84217b330dcb6d900179bc48e8f
      
      // Check if it already has an extension
      if (uuid && uuid.includes('.')) {
        console.log(`⏭️ Skipping ${uuid} - already has extension`);
        details.push({
          id: item.id,
          oldUrl: item.imageUrl,
          newUrl: item.imageUrl,
          status: 'skipped - already has extension'
        });
        continue;
      }
      
      // Common image extensions to check
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      let found = false;
      
      for (const ext of extensions) {
        // Construct full path with extension
        const fileName = `${uuid}${ext}`;
        
        // Try multiple possible upload directories
        const possiblePaths = [
          path.join(process.cwd(), 'uploads', 'gallery', fileName),
          path.join(__dirname, '../../uploads/gallery', fileName),
          path.join('/app/uploads/gallery', fileName), // For Docker/Render
        ];
        
        for (const fullPath of possiblePaths) {
          if (fs.existsSync(fullPath)) {
            // Update database with correct path
            const correctUrl = `/uploads/gallery/${fileName}`;
            item.imageUrl = correctUrl;
            await this.galleryRepository.save(item);
            
            console.log(`✅ Fixed: ${uuid} → ${fileName}`);
            fixed++;
            found = true;
            
            details.push({
              id: item.id,
              oldUrl: currentPath,
              newUrl: correctUrl,
              status: 'fixed'
            });
            break;
          }
        }
        
        if (found) break;
      }
      
      if (!found) {
        console.log(`❌ Not found: ${uuid} (no image file with common extensions)`);
        notFound++;
        details.push({
          id: item.id,
          oldUrl: currentPath,
          newUrl: '',
          status: 'not found'
        });
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
}
