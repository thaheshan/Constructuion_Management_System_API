import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  // Support both unprefixed (/roles, /users/me/role) and prefixed (/api/v1/roles) endpoints
  app.use((req: any, _res: any, next: () => void) => {
    if (req.url === '/roles' || req.url.startsWith('/roles?')) {
      req.url = '/api/v1' + req.url;
    } else if (req.url === '/users/me/role' || req.url.startsWith('/users/me/role?')) {
      req.url = '/api/v1' + req.url;
    }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Restrict CORS to configured frontend origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 Construction Management System API listening at http://localhost:${port}/api/v1`);
}
bootstrap();
