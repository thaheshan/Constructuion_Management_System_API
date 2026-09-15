import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: '*' });

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 Construction Management System API listening at http://localhost:${port}/api/v1`);
}
bootstrap();
