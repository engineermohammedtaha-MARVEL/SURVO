require('dotenv').config();
require('express-async-errors');

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

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

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
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

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SURVO API شغال على http://localhost:${PORT}`);
});

module.exports = app;
