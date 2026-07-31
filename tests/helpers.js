const request = require('supertest');
const app = require('../src/index');
const prisma = require('../src/config/db');

function uniqueSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// بيسجل مستخدم اختباري جديد ويوافق عليه مباشرة في الداتابيز (بديل لموافقة الأدمن اليدوية)
// عشان الاختبارات متتعطلش في حالة "pending"، ويرجع التوكين جاهز للاستخدام
async function createApprovedUser(overrides = {}) {
  const suffix = uniqueSuffix();
  const payload = Object.assign(
    {
      fullName: 'Test User ' + suffix,
      phone: '01' + suffix.slice(0, 9).padEnd(9, '0'),
      email: 'test.' + suffix + '@example.com',
      password: 'Test1234',
      accountType: 'engineer',
      governorate: 'Cairo',
    },
    overrides
  );

  const registerRes = await request(app).post('/api/auth/register').send(payload);
  if (!registerRes.body.success) {
    throw new Error('فشل تسجيل مستخدم اختباري: ' + registerRes.body.message);
  }
  const userId = registerRes.body.user.id;

  await prisma.user.update({ where: { id: userId }, data: { accountStatus: 'approved' } });

  const loginRes = await request(app).post('/api/auth/login').send({ phone: payload.phone, password: payload.password });
  if (!loginRes.body.success) {
    throw new Error('فشل تسجيل دخول مستخدم اختباري بعد الموافقة: ' + loginRes.body.message);
  }

  return { id: userId, token: loginRes.body.token, phone: payload.phone, email: payload.email };
}

// بيعمل حساب أدمن اختباري (isAdmin: true) ويرجع توكن جاهز يُستخدم كـ Bearer
// في أي طلب لمسارات /api/admin بدل الاعتماد على مفتاح سري قديم
async function createAdminUser() {
  const owner = await createApprovedUser();
  await prisma.user.update({ where: { id: owner.id }, data: { isAdmin: true } });
  const loginRes = await request(app).post('/api/auth/login').send({ phone: owner.phone, password: 'Test1234' });
  return { id: owner.id, token: loginRes.body.token, phone: owner.phone, email: owner.email };
}

// بيمسح كل أثر مستخدم اختباري (طلبات، أجهزة، إشعارات) والحساب نفسه
async function cleanupUser(userId) {
  if (!userId) return;
  await prisma.rentalRequest.deleteMany({ where: { requesterId: userId } });
  await prisma.equipment.deleteMany({ where: { ownerId: userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

module.exports = { request, app, prisma, createApprovedUser, createAdminUser, cleanupUser, uniqueSuffix };
