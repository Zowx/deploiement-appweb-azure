import pkg from "@prisma/client";
const { PrismaClient } = pkg;

type PrismaClientType = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function gracefulShutdown() {
  await prisma.$disconnect();
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export default prisma;
