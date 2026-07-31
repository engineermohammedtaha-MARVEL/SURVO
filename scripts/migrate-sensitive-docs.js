// سكريبت تشغيل مرة واحدة: بينقل كل مستندات التوثيق الحساسة (بطاقة، سند ملكية،
// صورة رقم تسلسلي، بلاغات الشرطة) اللي اترفعت قبل ما نضيف الحماية، لمجلد منظم
// بالـ id بتاع صاحبها في Cloudinary، وبيحولها لنوع "authenticated" (محمي بتوقيع)
// بدل ما تفضل عامة زي ما كانت. آمن نعيد تشغيله أكتر من مرة (بيتخطى اللي اتنقل خلاص).
require('dotenv').config();
const prisma = require('../src/config/db');
const { parseCloudinaryUrl, makeAuthenticatedAndMove, renameAsset } = require('../src/utils/cloudinaryUpload');

async function migrateUrl(url, newPublicId) {
  if (!url) return null;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) {
    console.log('  ! skip (not a cloudinary url):', url);
    return null;
  }
  if (parsed.publicId === newPublicId && parsed.type === 'authenticated') {
    console.log('  = already migrated:', newPublicId);
    return null;
  }
  try {
    const moved = parsed.type === 'authenticated'
      ? await renameAsset(parsed, newPublicId)
      : await makeAuthenticatedAndMove(parsed, newPublicId);
    console.log('  -> moved to', moved.publicId, '(' + moved.type + ')');
    return moved.secureUrl;
  } catch (err) {
    console.log('  ! failed:', newPublicId, err.message);
    return null;
  }
}

const USER_DOC_FIELDS = ['nationalIdUrl', 'personalPhotoUrl', 'qualificationUrl', 'unionCardUrl', 'commercialRecordUrl'];

async function migrateUsers() {
  const users = await prisma.user.findMany({
    where: { OR: USER_DOC_FIELDS.map((f) => ({ [f]: { not: null } })) },
    select: { id: true, ...Object.fromEntries(USER_DOC_FIELDS.map((f) => [f, true])) },
  });
  console.log('Users with verification docs:', users.length);
  for (const user of users) {
    console.log('User', user.id);
    const updates = {};
    for (const field of USER_DOC_FIELDS) {
      if (!user[field]) continue;
      const newUrl = await migrateUrl(user[field], 'survo/users/' + user.id + '/registration/' + field);
      if (newUrl) updates[field] = newUrl;
    }
    if (Object.keys(updates).length) {
      await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }
}

async function migrateEquipment() {
  const items = await prisma.equipment.findMany({
    where: { OR: [{ ownershipDocUrl: { not: null } }, { serialNumberPhotoUrl: { not: null } }] },
    select: { id: true, ownerId: true, ownershipDocUrl: true, serialNumberPhotoUrl: true },
  });
  console.log('Equipment with sensitive docs:', items.length);
  for (const item of items) {
    console.log('Equipment', item.id);
    const updates = {};
    if (item.ownershipDocUrl) {
      const newUrl = await migrateUrl(item.ownershipDocUrl, 'survo/users/' + item.ownerId + '/equipment-doc/ownership-' + item.id);
      if (newUrl) updates.ownershipDocUrl = newUrl;
    }
    if (item.serialNumberPhotoUrl) {
      const newUrl = await migrateUrl(item.serialNumberPhotoUrl, 'survo/users/' + item.ownerId + '/equipment-doc/serial-' + item.id);
      if (newUrl) updates.serialNumberPhotoUrl = newUrl;
    }
    if (Object.keys(updates).length) {
      await prisma.equipment.update({ where: { id: item.id }, data: updates });
    }
  }
}

async function migrateDeviceReports() {
  const reports = await prisma.deviceReport.findMany({
    where: { OR: [{ policeReportUrl: { not: null } }, { ownershipDocUrl: { not: null } }] },
    select: { id: true, reporterId: true, policeReportUrl: true, ownershipDocUrl: true },
  });
  console.log('Device reports with evidence docs:', reports.length);
  for (const report of reports) {
    console.log('DeviceReport', report.id);
    const updates = {};
    if (report.policeReportUrl) {
      const newUrl = await migrateUrl(report.policeReportUrl, 'survo/users/' + report.reporterId + '/report-doc/police-' + report.id);
      if (newUrl) updates.policeReportUrl = newUrl;
    }
    if (report.ownershipDocUrl) {
      const newUrl = await migrateUrl(report.ownershipDocUrl, 'survo/users/' + report.reporterId + '/report-doc/ownership-' + report.id);
      if (newUrl) updates.ownershipDocUrl = newUrl;
    }
    if (Object.keys(updates).length) {
      await prisma.deviceReport.update({ where: { id: report.id }, data: updates });
    }
  }
}

async function main() {
  await migrateUsers();
  await migrateEquipment();
  await migrateDeviceReports();
  console.log('done');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
