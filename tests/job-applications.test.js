const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, prisma, createApprovedUser, cleanupUser } = require('./helpers');

const createdUserIds = [];

test('job applications: applying shows up under the applicant own "my applications" list', async () => {
  const poster = await createApprovedUser();
  const applicant = await createApprovedUser();
  createdUserIds.push(poster.id, applicant.id);

  const jobRes = await request(app)
    .post('/api/jobs')
    .set('Authorization', 'Bearer ' + poster.token)
    .send({ title: 'مهندس مساحة', jobType: 'engineer', workType: 'full', governorate: 'Cairo' });
  const jobId = jobRes.body.item.id;

  const emptyRes = await request(app)
    .get('/api/jobs/applications/mine')
    .set('Authorization', 'Bearer ' + applicant.token);
  assert.equal(emptyRes.body.items.length, 0);

  await request(app)
    .post('/api/jobs/' + jobId + '/contact')
    .set('Authorization', 'Bearer ' + applicant.token)
    .send({ message: 'مهتم بالوظيفة' });

  const afterRes = await request(app)
    .get('/api/jobs/applications/mine')
    .set('Authorization', 'Bearer ' + applicant.token);
  assert.equal(afterRes.body.items.length, 1);
  assert.equal(afterRes.body.items[0].job.id, jobId);
  assert.equal(afterRes.body.items[0].job.title, 'مهندس مساحة');
  assert.equal(afterRes.body.items[0].job.poster.id, poster.id);
  assert.equal(afterRes.body.items[0].message, 'مهتم بالوظيفة');

  // مطبّق التقديم لا يظهر في قائمة صاحب الوظيفة نفسه
  const posterOwnAppsRes = await request(app)
    .get('/api/jobs/applications/mine')
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(posterOwnAppsRes.body.items.length, 0);

  // لازم إشعار وصل لصاحب الوظيفة إن حد اتقدملها
  const posterNotifs = await prisma.notification.findMany({ where: { userId: poster.id, targetType: 'job-applicants', targetId: jobId } });
  assert.equal(posterNotifs.length, 1);
});

test('job postings: poster sees their own postings with applicant count, and can list applicants', async () => {
  const poster = await createApprovedUser();
  const applicant = await createApprovedUser();
  const stranger = await createApprovedUser();
  createdUserIds.push(poster.id, applicant.id, stranger.id);

  const jobRes = await request(app)
    .post('/api/jobs')
    .set('Authorization', 'Bearer ' + poster.token)
    .send({ title: 'مساح ميداني', jobType: 'surveyor', workType: 'daily', governorate: 'Giza' });
  const jobId = jobRes.body.item.id;

  const myPostingsBeforeRes = await request(app)
    .get('/api/jobs/mine')
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(myPostingsBeforeRes.body.items.length, 1);
  assert.equal(myPostingsBeforeRes.body.items[0].id, jobId);
  assert.equal(myPostingsBeforeRes.body.items[0].applicantsCount, 0);

  // مستخدم تاني ميقدرش يشوف وظايف حد غيره من غير endpoint التاني
  const applicantOwnPostingsRes = await request(app)
    .get('/api/jobs/mine')
    .set('Authorization', 'Bearer ' + applicant.token);
  assert.equal(applicantOwnPostingsRes.body.items.length, 0);

  await request(app)
    .post('/api/jobs/' + jobId + '/contact')
    .set('Authorization', 'Bearer ' + applicant.token)
    .send({ message: 'عندي خبرة 5 سنين' });

  const myPostingsAfterRes = await request(app)
    .get('/api/jobs/mine')
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(myPostingsAfterRes.body.items[0].applicantsCount, 1);

  // الغريب مش صاحب الوظيفة، ميقدرش يشوف قائمة المتقدمين
  const strangerApplicantsRes = await request(app)
    .get('/api/jobs/' + jobId + '/applicants')
    .set('Authorization', 'Bearer ' + stranger.token);
  assert.equal(strangerApplicantsRes.status, 403);

  const applicantsRes = await request(app)
    .get('/api/jobs/' + jobId + '/applicants')
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(applicantsRes.status, 200);
  assert.equal(applicantsRes.body.items.length, 1);
  assert.equal(applicantsRes.body.items[0].applicant.id, applicant.id);
  assert.equal(applicantsRes.body.items[0].message, 'عندي خبرة 5 سنين');
});

test('job posting type: defaults to hiring, offering type filters correctly across list/mine/applications', async () => {
  const poster = await createApprovedUser();
  const interested = await createApprovedUser();
  createdUserIds.push(poster.id, interested.id);

  const hiringRes = await request(app)
    .post('/api/jobs')
    .set('Authorization', 'Bearer ' + poster.token)
    .send({ title: 'Hiring Post Test', jobType: 'engineer', workType: 'full', governorate: 'Cairo' });
  assert.equal(hiringRes.body.item.postingType, 'hiring', 'postingType should default to hiring when omitted');

  const offeringRes = await request(app)
    .post('/api/jobs')
    .set('Authorization', 'Bearer ' + poster.token)
    .send({ title: 'Offering Post Test', jobType: 'surveyor', workType: 'daily', governorate: 'Cairo', postingType: 'offering' });
  assert.equal(offeringRes.body.item.postingType, 'offering');
  const offeringJobId = offeringRes.body.item.id;

  const listOfferingRes = await request(app).get('/api/jobs').query({ postingType: 'offering', governorate: 'Cairo' });
  assert.ok(listOfferingRes.body.items.some((i) => i.id === offeringJobId));
  assert.ok(!listOfferingRes.body.items.some((i) => i.id === hiringRes.body.item.id));

  const myOfferingsRes = await request(app)
    .get('/api/jobs/mine')
    .query({ postingType: 'offering' })
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(myOfferingsRes.body.items.length, 1);
  assert.equal(myOfferingsRes.body.items[0].id, offeringJobId);

  const myHiringsRes = await request(app)
    .get('/api/jobs/mine')
    .query({ postingType: 'hiring' })
    .set('Authorization', 'Bearer ' + poster.token);
  assert.equal(myHiringsRes.body.items.length, 1);
  assert.equal(myHiringsRes.body.items[0].id, hiringRes.body.item.id);

  await request(app)
    .post('/api/jobs/' + offeringJobId + '/contact')
    .set('Authorization', 'Bearer ' + interested.token)
    .send({ message: 'مهتم بالفريق' });

  const myOfferingAppsRes = await request(app)
    .get('/api/jobs/applications/mine')
    .query({ postingType: 'offering' })
    .set('Authorization', 'Bearer ' + interested.token);
  assert.equal(myOfferingAppsRes.body.items.length, 1);
  assert.equal(myOfferingAppsRes.body.items[0].job.id, offeringJobId);

  const myHiringAppsRes = await request(app)
    .get('/api/jobs/applications/mine')
    .query({ postingType: 'hiring' })
    .set('Authorization', 'Bearer ' + interested.token);
  assert.equal(myHiringAppsRes.body.items.length, 0, 'applying to an offering post should not show up under hiring-type applications');
});

after(async () => {
  for (const id of createdUserIds) {
    await prisma.jobApplication.deleteMany({ where: { applicantId: id } });
    await prisma.jobPosting.deleteMany({ where: { posterId: id } });
    await cleanupUser(id);
  }
  await prisma.$disconnect();
});
