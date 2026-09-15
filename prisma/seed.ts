import { PrismaClient, Role, ProjectStage, MaterialCategory, SkillTrade, WorkerCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Sri Lanka Construction Management System Database...');

  const passwordHash = await bcrypt.hash('OwnerPassword123!', 10);

  // Seed Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@construction.lk' },
    update: {},
    create: {
      email: 'owner@construction.lk',
      passwordHash,
      fullName: 'Sunil Perera',
      role: Role.OWNER,
      phone: '+94771234567',
      nic: '197512345678',
    },
  });

  // Seed PM
  const pm = await prisma.user.upsert({
    where: { email: 'pm@construction.lk' },
    update: {},
    create: {
      email: 'pm@construction.lk',
      passwordHash,
      fullName: 'Kamal Silva',
      role: Role.PROJECT_MANAGER,
      phone: '+94772345678',
      nic: '198223456789',
    },
  });

  // Seed Site Supervisor
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@construction.lk' },
    update: {},
    create: {
      email: 'supervisor@construction.lk',
      passwordHash,
      fullName: 'Nimal Fernando',
      role: Role.SITE_SUPERVISOR,
      phone: '+94773456789',
      nic: '199034567890',
    },
  });

  // Seed Project
  await prisma.project.upsert({
    where: { refNumber: 'CMS-PRJ-2026-001' },
    update: {},
    create: {
      name: 'Galle Highway Extension',
      refNumber: 'CMS-PRJ-2026-001',
      clientName: 'Road Development Authority Sri Lanka',
      siteAddress: 'Galle Highway Sector 4, Galle',
      contractValueLKR: 120000000,
      startDate: new Date('2026-01-15'),
      targetCompletionDate: new Date('2026-12-30'),
      stage: ProjectStage.IN_PROGRESS,
      pmId: pm.id,
      supervisorId: supervisor.id,
    },
  });

  // Seed Material
  await prisma.materialItem.upsert({
    where: { sku: 'MAT-CEM-OPC-50KG' },
    update: {},
    create: {
      sku: 'MAT-CEM-OPC-50KG',
      name: 'Tokyo Super OPC Cement Bag 50kg',
      category: MaterialCategory.CEMENT_CONCRETE,
      unitOfMeasure: 'bags',
      currentStock: 450,
      minStockLevel: 100,
      lastPurchasePriceLKR: 2350,
      avgCostLKR: 2300,
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
