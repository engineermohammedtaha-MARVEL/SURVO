require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const deqa = await prisma.user.upsert({
    where: { phone: '201001234567' },
    update: {},
    create: {
      fullName: 'مكتب الدقة للمساحة',
      phone: '201001234567',
      email: 'deqa@example.com',
      passwordHash,
      accountType: 'office',
      bio: 'مكتب متخصص في تأجير وبيع أجهزة المساحة منذ 2015',
      specialties: ['مساحة طرق', 'مساحة تنفيذية'],
      governorate: 'القاهرة',
      verification: 'verified',
      rating: 4.8,
      ratingCount: 34,
    },
  });

  const osama = await prisma.user.upsert({
    where: { phone: '201055512345' },
    update: {},
    create: {
      fullName: 'مهندس أسامة كمال',
      phone: '201055512345',
      email: 'osama@example.com',
      passwordHash,
      accountType: 'engineer',
      bio: 'مهندس مساحة بخبرة 10 سنين في مشاريع الطرق والبنية التحتية',
      specialties: ['توتال ستاشن', 'GPS'],
      governorate: 'القاهرة',
      verification: 'verified',
      rating: 4.6,
      ratingCount: 21,
    },
  });

  const equipment = await prisma.equipment.create({
    data: {
      ownerId: deqa.id,
      title: 'توتال ستاشن Leica TS16',
      category: 'totalstation',
      listingType: 'rent',
      description: 'دقة عالية، حالة ممتازة، شامل الحقيبة والملحقات',
      pricePerDay: 450,
      governorate: 'القاهرة',
      images: [],
    },
  });

  await prisma.jobPosting.create({
    data: {
      posterId: deqa.id,
      title: 'مطلوب فريق توتال ستاشن لمشروع طرق',
      jobType: 'totalstation',
      workType: 'daily',
      governorate: 'القاهرة',
      description: 'مطلوب فريق متكامل لمدة 3 أيام في مشروع طريق دائري',
      salary: '600 ج / يوم',
    },
  });

  await prisma.rentalRequest.create({
    data: {
      requesterId: osama.id,
      category: 'gps',
      type: 'rent',
      details: 'محتاج GPS دقة عالية لمشروع مساحي',
      governorate: 'الجيزة',
      budget: '350 ج / يوم',
    },
  });

  console.log('تم إدخال البيانات التجريبية بنجاح ✓');
  console.log({ deqaId: deqa.id, osamaId: osama.id, equipmentId: equipment.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
