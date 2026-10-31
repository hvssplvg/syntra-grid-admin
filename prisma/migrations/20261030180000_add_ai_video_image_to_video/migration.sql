-- CreateEnum
CREATE TYPE "AiVideoGenerationMethod" AS ENUM ('TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO');

-- AlterTable
ALTER TABLE "AiVideoJob" ADD COLUMN     "generationMethod" "AiVideoGenerationMethod" NOT NULL DEFAULT 'TEXT_TO_VIDEO',
ADD COLUMN     "sourceImageAssetId" TEXT;
