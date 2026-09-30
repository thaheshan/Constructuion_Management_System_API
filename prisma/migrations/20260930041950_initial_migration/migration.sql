-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'PROJECT_MANAGER', 'SITE_SUPERVISOR', 'LABOUR_OFFICER', 'ACCOUNTANT', 'STORE_KEEPER', 'STAFF');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('TENDER', 'AWARDED', 'PLANNING', 'IN_PROGRESS', 'PUNCH_LIST', 'HANDOVER', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('CEMENT_CONCRETE', 'STEEL_REINFORCEMENT', 'BRICKS_MASONRY', 'TIMBER_ROOFING', 'ELECTRICAL', 'PLUMBING_SANITARY', 'FINISHING', 'HARDWARE', 'TOOLS_EQUIPMENT', 'FUEL_LUBRICANTS');

-- CreateEnum
CREATE TYPE "SkillTrade" AS ENUM ('MASON', 'CARPENTER', 'BAR_BENDER', 'ELECTRICIAN', 'PLUMBER', 'PAINTER', 'HELPER');

-- CreateEnum
CREATE TYPE "WorkerCategory" AS ENUM ('SKILLED', 'SEMI_SKILLED', 'UNSKILLED', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RECEIVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT NOT NULL,
    "nic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "refNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "siteAddress" TEXT NOT NULL,
    "contractValueLKR" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetCompletionDate" TIMESTAMP(3) NOT NULL,
    "stage" "ProjectStage" NOT NULL DEFAULT 'PLANNING',
    "pmId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_site_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weatherConditions" TEXT NOT NULL,
    "labourCount" INTEGER NOT NULL,
    "workCompleted" TEXT NOT NULL,
    "materialsUsed" TEXT NOT NULL,
    "issuesEncountered" TEXT,

    CONSTRAINT "daily_site_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_items" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockLevel" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "lastPurchasePriceLKR" DOUBLE PRECISION NOT NULL,
    "avgCostLKR" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalAmountLKR" DOUBLE PRECISION NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPriceLKR" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nic" TEXT NOT NULL,
    "category" "WorkerCategory" NOT NULL,
    "trade" "SkillTrade" NOT NULL,
    "dailyWageLKR" DOUBLE PRECISION NOT NULL,
    "epfNumber" TEXT,
    "bankAccountDetails" TEXT,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isSundayHoliday" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "basicSalaryLKR" DOUBLE PRECISION NOT NULL,
    "overtimeLKR" DOUBLE PRECISION NOT NULL,
    "allowancesLKR" DOUBLE PRECISION NOT NULL,
    "grossPayLKR" DOUBLE PRECISION NOT NULL,
    "epfEmployeeLKR" DOUBLE PRECISION NOT NULL,
    "epfEmployerLKR" DOUBLE PRECISION NOT NULL,
    "etfEmployerLKR" DOUBLE PRECISION NOT NULL,
    "payeTaxLKR" DOUBLE PRECISION NOT NULL,
    "advanceDeductionLKR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPayLKR" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_nic_key" ON "users"("nic");

-- CreateIndex
CREATE UNIQUE INDEX "projects_refNumber_key" ON "projects"("refNumber");

-- CreateIndex
CREATE UNIQUE INDEX "material_items_sku_key" ON "material_items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "workers_nic_key" ON "workers"("nic");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_pmId_fkey" FOREIGN KEY ("pmId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_site_logs" ADD CONSTRAINT "daily_site_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "material_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
