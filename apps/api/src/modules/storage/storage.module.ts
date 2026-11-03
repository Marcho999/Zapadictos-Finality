import { Global, Logger, Module } from '@nestjs/common';
import { loadEnv } from '../../config/env.js';
import { CloudinaryImageStorage, ImageStorage, LocalImageStorage } from './image-storage.js';
import { UploadsController } from './uploads.controller.js';

@Global()
@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: ImageStorage,
      useFactory: () => {
        if (loadEnv().CLOUDINARY_URL) return new CloudinaryImageStorage();
        new Logger('Storage').warn('Sin CLOUDINARY_URL: las imágenes se guardan en disco (solo para desarrollo)');
        return new LocalImageStorage();
      },
    },
  ],
  exports: [ImageStorage],
})
export class StorageModule {}
