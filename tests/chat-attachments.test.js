const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser } = require('./helpers');

const createdUserIds = [];

test('chat attachments upload as authenticated and are only signable by conversation participants', async () => {
  const userA = await createApprovedUser();
  const userB = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(userA.id, userB.id, stranger.id);

  const uploadRes = await request(app)
    .post('/api/uploads')
    .set('Authorization', 'Bearer ' + userA.token)
    .field('purpose', 'chat')
    .attach('file', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'), 'photo.png');
  assert.equal(uploadRes.status, 201);
  const attachmentUrl = uploadRes.body.url;
  assert.match(attachmentUrl, /\/authenticated\//, 'chat attachment must upload as authenticated');
  assert.match(attachmentUrl, new RegExp('survo/users/' + userA.id + '/chat'));

  const convRes = await request(app)
    .post('/api/chat/conversations')
    .set('Authorization', 'Bearer ' + userA.token)
    .send({ userId: userB.id });
  const conversationId = convRes.body.conversation.id;

  const msgRes = await request(app)
    .post('/api/chat/conversations/' + conversationId + '/messages')
    .set('Authorization', 'Bearer ' + userA.token)
    .send({ attachmentUrl });
  assert.equal(msgRes.status, 201);
  assert.equal(msgRes.body.message.attachmentUrl, attachmentUrl);
  assert.equal(msgRes.body.message.body, '', 'attachment-only message should allow empty body');
  const messageId = msgRes.body.message.id;

  const strangerSignRes = await request(app)
    .get('/api/chat/attachments/signed-url?messageId=' + messageId)
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerSignRes.status, 403);

  const recipientSignRes = await request(app)
    .get('/api/chat/attachments/signed-url?messageId=' + messageId)
    .set('Authorization', 'Bearer ' + userB.token);
  assert.equal(recipientSignRes.status, 200);
  assert.notEqual(recipientSignRes.body.url, attachmentUrl, 'should return a freshly-signed url, not the stored reference');

  const senderSignRes = await request(app)
    .get('/api/chat/attachments/signed-url?messageId=' + messageId)
    .set('Authorization', 'Bearer ' + userA.token);
  assert.equal(senderSignRes.status, 200);
});

after(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
