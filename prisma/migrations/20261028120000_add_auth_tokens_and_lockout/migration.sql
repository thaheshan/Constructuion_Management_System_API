-- Safeguard: Check for duplicate phone numbers before adding unique constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT "phone", COUNT(*)
        FROM "users"
        GROUP BY "phone"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot apply unique index: duplicate phone numbers found in users table';
    END IF;
END $$;

-- AlterTable (Auth Lockout & Login Attempts)
ALTER TABLE "users" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- CreateIndex (Unique Phone)
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateTable (Refresh Tokens for Session Rotation)
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
