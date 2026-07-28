const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, uniqueSuffix } = require('./helpers');

const createdUserIds = [];

test('register rejects missing required fields', async () => {
  const res = await request(app).post('/api/auth/register').send({ phone: '0100000000' });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('register succeeds and account starts pending approval', async () => {
  const suffix = uniqueSuffix();
  const res = await request(app).post('/api/auth/register').send({
    fullName: 'Pending Test User',
    phone: '01' + suffix.slice(0, 9).padEnd(9, '1'),
    email: 'pending.' + suffix + '@example.com',
    password: 'Test1234',
    accountType: 'engineer',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.pendingApproval, true);
  assert.equal(res.body.user.accountStatus, 'pending');
  createdUserIds.push(res.body.user.id);
});

test('login rejects wrong password', async () => {
  const user = await createApprovedUser();
  createdUserIds.push(user.id);

  const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: 'WrongPassword1' });
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('login is case-insensitive on email but password stays case-sensitive', async () => {
  const suffix = uniqueSuffix();
  const email = 'CaseTest.' + suffix + '@Example.com';
  const user = await createApprovedUser({ email });
  createdUserIds.push(user.id);

  const lowerCaseRes = await request(app).post('/api/auth/login').send({ phone: email.toLowerCase(), password: 'Test1234' });
  assert.equal(lowerCaseRes.status, 200);
  assert.equal(lowerCaseRes.body.success, true);

  const wrongCasePasswordRes = await request(app).post('/api/auth/login').send({ phone: email.toLowerCase(), password: 'TEST1234' });
  assert.equal(wrongCasePasswordRes.status, 401);
  assert.equal(wrongCasePasswordRes.body.success, false);
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.user.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});
