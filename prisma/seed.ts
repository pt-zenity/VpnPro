import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/panel/src/lib/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Check if admin exists
  const existingAdmin = await prisma.admin.findFirst({
    where: { email: 'admin@example.com' },
  });

  if (existingAdmin) {
    console.log('Admin already exists:', existingAdmin.email);
    return;
  }

  // Create admin
  const admin = await prisma.admin.create({
    data: {
      email: 'admin@example.com',
      passwordHash: await hashPassword('admin123'),
      role: 'SUPERADMIN',
    },
  });

  console.log('Created admin:', admin.email);
  console.log('Password: admin123');
  console.log('IMPORTANT: Change password after first login!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
