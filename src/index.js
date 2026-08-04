require('dotenv').config();
require('express-async-errors');

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const ApiError = require('./utils/apiError');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const requestsRoutes = require('./routes/requests.routes');
const jobsRoutes = require('./routes/jobs.routes');
const chatRoutes = require('./routes/chat.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const supportRoutes = require('./routes/support.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const adminRoutes = require('./routes/admin.routes');
const deviceReportsRoutes = require('./routes/deviceReports.routes');
const savedSearchesRoutes = require('./routes/savedSearches.routes');

const app = express();

// Railway (وأي منصة استضافة) بتحط السيرفر وراء reverse proxy واحد،
// فلازم نصدّق على أول proxy بس عشان express-rate-limit يعرف الـ IP الحقيقي صح
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// مسموح بس لفرونت إند SURVO الرسمي (الويب + تطبيق الأندرويد بتاع Capacitor).
// طلبات من غير Origin header (زي curl أو health checks) بتتسمح دايمًا لأنها مش متصفح.
const ALLOWED_ORIGINS = [
  'https://engineermohammedtaha-marvel.github.io',
  'https://localhost', // Capacitor Android WebView (androidScheme الافتراضي)
  'http://localhost',
  'null', // فتح index.html مباشرة كملف محلي (file://) بيبعت Origin: null حرفيًا
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new ApiError(403, 'الموقع ده مش مسموح له يتواصل مع السيرفر'));
  },
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// حماية بسيطة من الطلبات الكتير (خصوصًا على auth)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/device-reports', deviceReportsRoutes);
app.use('/api/saved-searches', savedSearchesRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SURVO API شغال على http://localhost:${PORT}`);
  });
}

module.exports = app;
