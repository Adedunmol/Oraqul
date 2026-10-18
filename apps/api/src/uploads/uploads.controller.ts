import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadResult } from '@oraqul/schema';
import { SessionGuard } from '../auth/session.guard.js';
import { extractAttachmentText } from './extract.js';

// The two fields of multer's file this route reads.
interface UploadedBytes {
  originalname: string;
  buffer: Buffer;
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Turns a PDF or Word file into text for a message. Nothing is stored: the file is read and dropped. */
@Controller('uploads')
@UseGuards(SessionGuard)
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async read(@UploadedFile() file: UploadedBytes | undefined): Promise<UploadResult> {
    if (!file) throw new BadRequestException('Attach a file.');
    // Browsers send the name as latin1 in multipart headers; decode it back to UTF-8.
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200);
    return { name, text: await extractAttachmentText(name, file.buffer) };
  }
}
