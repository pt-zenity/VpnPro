import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Node.js compatible password hashing (same algorithm as crypto.ts)
async function hashPassword(password: string): Promise<string> {
  const salt = process.env.PASSWORD_SALT || 'default_salt';
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return hash;
}

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
