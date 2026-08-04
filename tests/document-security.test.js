const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, createAdminUser, uniqueSuffix, cleanupUser } = require('./helpers');

const createdUserIds = [];

test('registration documents are uploaded as authenticated and organized under the new user id', async () => {
  const suffix = uniqueSuffix();
  const phone = '01' + suffix.slice(0, 9).padEnd(9, '0');

  const docUploadRes = await request(app)
    .post('/api/uploads/registration')
    .field('purpose', 'doc')
    .attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), 'id.png');
  assert.equal(docUploadRes.status, 201);
  const uploadedUrl = docUploadRes.body.url;
  assert.match(uploadedUrl, /\/authenticated\//, 'registration doc must upload as authenticated delivery type');

  const registerRes = await request(app).post('/api/auth/register').send({
    fullName: 'Doc Security Test',
    phone,
    password: 'Test1234',
    accountType: 'engineer',
    nationalIdUrl: uploadedUrl,
  });
  assert.equal(registerRes.status, 201);
  const userId = registerRes.body.user.id;
  createdUserIds.push(userId);

  const stored = await prisma.user.findUnique({ where: { id: userId }, select: { nationalIdUrl: true } });
  assert.match(stored.nationalIdUrl, new RegExp('survo/users/' + userId + '/registration/nationalIdUrl'), 'doc should be moved into the new user-scoped folder');
  assert.match(stored.nationalIdUrl, /\/authenticated\//, 'doc must stay authenticated after the move');
});

test('admin signed-url endpoint requires admin auth and signs authenticated docs', async () => {
  const owner = await createApprovedUser();
  const admin = await createAdminUser();
  createdUserIds.push(owner.id, admin.id);

  const docUploadRes = await request(app)
    .post('/api/uploads')
    .set('Authorization', 'Bearer ' + owner.token)
    .field('purpose', 'equipment-doc')
    .attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), 'doc.png');
  const rawUrl = docUploadRes.body.url;
  assert.match(rawUrl, /\/authenticated\//);
  assert.match(rawUrl, new RegExp('survo/users/' + owner.id + '/equipment-doc'));

  const noAuthRes = await request(app).get('/api/admin/signed-url?url=' + encodeURIComponent(rawUrl));
  assert.equal(noAuthRes.status, 401);

  const nonAdminRes = await request(app).get('/api/admin/signed-url?url=' + encodeURIComponent(rawUrl)).set('Authorization', 'Bearer ' + owner.token);
  assert.equal(nonAdminRes.status, 403);

  const signedRes = await request(app).get('/api/admin/signed-url?url=' + encodeURIComponent(rawUrl)).set('Authorization', 'Bearer ' + admin.token);
  assert.equal(signedRes.status, 200);
  assert.notEqual(signedRes.body.url, rawUrl, 'signed url must differ from the stored reference url (fresh signature)');
});

test('support ticket attachments upload as authenticated and admin can view via signed url', async () => {
  const owner = await createApprovedUser();
  const admin = await createAdminUser();
  createdUserIds.push(owner.id, admin.id);

  const uploadRes = await request(app)
    .post('/api/uploads')
    .set('Authorization', 'Bearer ' + owner.token)
    .field('purpose', 'support')
    .attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), 'ticket.png');
  const attachmentUrl = uploadRes.body.url;
  assert.match(attachmentUrl, /\/authenticated\//, 'support ticket attachment must upload as authenticated');

  await request(app)
    .post('/api/support/tickets')
    .set('Authorization', 'Bearer ' + owner.token)
    .send({ type: 'مشكلة تقنية في التطبيق', details: 'test ticket', attachmentUrl });

  const signedRes = await request(app)
    .get('/api/admin/signed-url?url=' + encodeURIComponent(attachmentUrl))
    .set('Authorization', 'Bearer ' + admin.token);
  assert.equal(signedRes.status, 200);
  assert.notEqual(signedRes.body.url, attachmentUrl);
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
