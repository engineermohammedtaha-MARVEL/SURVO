// سكريبت تشغيل مرة واحدة بس: بيعمل حساب "الدعم الفني" الثابت اللي الأدمن بيبعت منه رسايل للمستخدمين
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../src/config/db');

const SUPPORT_PHONE = '00000000000';

async function main() {
  const existing = await prisma.user.findUnique({ where: { phone: SUPPORT_PHONE } });
  if (existing) {
    console.log('حساب الدعم الفني موجود بالفعل:', existing.id);
    return;
  }

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const user = await prisma.user.create({
    data: {
      fullName: 'الدعم الفني - SURVO',
      phone: SUPPORT_PHONE,
      passwordHash,
      accountType: 'office',
      accountStatus: 'approved',
      verification: 'verified',
    },
  });

  console.log('تم إنشاء حساب الدعم الفني:', user.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
