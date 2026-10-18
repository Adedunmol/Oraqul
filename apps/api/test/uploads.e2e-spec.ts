import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Document, Packer, Paragraph } from 'docx';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { SessionGuard } from '../src/auth/session.guard.js';
import { UploadsController } from '../src/uploads/uploads.controller.js';

describe('uploads (e2e, session stubbed)', () => {
  let app: INestApplication<App>;
  let signedIn = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [UploadsController] })
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: () => {
          if (!signedIn) throw new UnauthorizedException();
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a Word file with its name and text', async () => {
    const bytes = await Packer.toBuffer(
      new Document({ sections: [{ children: [new Paragraph('Salt Road, Accra')] }] }),
    );
    const res = await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', bytes, 'Salt Road brief.docx')
      .expect(201);
    expect(res.body).toEqual({ name: 'Salt Road brief.docx', text: 'Salt Road, Accra' });
  });

  it('refuses an unsupported file with a plain reason', async () => {
    const res = await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', Buffer.from('x'), 'deck.pptx')
      .expect(400);
    expect(res.body.message).toBe('Only PDF and Word (.docx) files can be read.');
  });

  it('refuses a request with no file', async () => {
    await request(app.getHttpServer()).post('/uploads').expect(400);
  });

  it('needs a session', async () => {
    signedIn = false;
    await request(app.getHttpServer()).post('/uploads').expect(401);
    signedIn = true;
  });
});
