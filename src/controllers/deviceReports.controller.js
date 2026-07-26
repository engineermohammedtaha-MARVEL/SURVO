const prisma = require('../config/db');
const ApiError = require('../utils/apiError');

const STATUSES = ['stolen', 'lost'];

async function create(req, res) {
  const { category, brand, serialNumber, status, details, contactPhone, policeReportUrl, ownershipDocUrl } = req.body;

  if (!category || !serialNumber || !status) {
    throw new ApiError(400, 'نوع الجهاز والرقم التسلسلي وحالة البلاغ مطلوبين');
  }
  if (!STATUSES.includes(status)) {
    throw new ApiError(400, 'حالة البلاغ غير صحيحة');
  }

  const report = await prisma.deviceReport.create({
    data: {
      reporterId: req.user.id,
      category,
      brand: brand || undefined,
      serialNumber: serialNumber.trim(),
      status,
      details: details || undefined,
      contactPhone: contactPhone || undefined,
      policeReportUrl: policeReportUrl || undefined,
      ownershipDocUrl: ownershipDocUrl || undefined,
    },
  });

  res.status(201).json({ success: true, report });
}

async function myReports(req, res) {
  const reports = await prisma.deviceReport.findMany({
    where: { reporterId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, reports });
}

async function lookup(req, res) {
  const { serialNumber } = req.query;
  if (!serialNumber || !serialNumber.trim()) {
    throw new ApiError(400, 'اكتب الرقم التسلسلي');
  }

  const report = await prisma.deviceReport.findFirst({
    where: { serialNumber: serialNumber.trim(), moderationStatus: 'approved' },
    orderBy: { createdAt: 'desc' },
  });

  if (!report) {
    return res.json({ success: true, clean: true });
  }

  res.json({
    success: true,
    clean: false,
    status: report.status,
    category: report.category,
    brand: report.brand,
    reportedAt: report.createdAt,
  });
}

module.exports = { create, myReports, lookup, STATUSES };
