// سكريبت تشغيل مرة واحدة بس: بيعمل حساب أدمن حقيقي (isAdmin: true) يقدر يدخل على
// admin.html بتسجيل دخول عادي (رقم موبايل/إيميل + باسورد) بدل مفتاح سري مشترك
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../src/config/db');

const ADMIN_PHONE = '01000000001';
const ADMIN_EMAIL = 'admin@survo.app';

async function main() {
  const existing = await prisma.user.findUnique({ where: { phone: ADMIN_PHONE } });
  if (existing) {
    if (!existing.isAdmin) {
      await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true, accountStatus: 'approved' } });
      console.log('الحساب كان موجود، وتم تفعيل صلاحيات الأدمن عليه:', existing.id);
    } else {
      console.log('حساب الأدمن موجود بالفعل:', existing.id);
    }
    return;
  }

  const randomPassword = crypto.randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const user = await prisma.user.create({
    data: {
      fullName: 'أدمن SURVO',
      phone: ADMIN_PHONE,
      email: ADMIN_EMAIL,
      passwordHash,
      accountType: 'office',
      accountStatus: 'approved',
      verification: 'verified',
      isAdmin: true,
    },
  });

  console.log('تم إنشاء حساب الأدمن:', user.id);
  console.log('رقم الموبايل:', ADMIN_PHONE);
  console.log('الإيميل:', ADMIN_EMAIL);
  console.log('الباسورد (اتكتب مرة واحدة بس هنا، احفظه في مكان آمن):', randomPassword);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
