
# SURVO Backend API

Backend لتطبيق SURVO (سوق أجهزة المساحة) — Node.js + Express + Prisma + PostgreSQL.

## المتطلبات
- Node.js 18+
- PostgreSQL (محلي أو سحابي زي Railway/Render/Supabase)

## التشغيل محليًا

```bash
# 1) تثبيت المكتبات
npm install

# 2) اعمل نسخة من ملف البيئة واملأ بياناتك
cp .env.example .env
# عدّل DATABASE_URL و JWT_SECRET في .env

# 3) اعمل الجداول في قاعدة البيانات
npm run prisma:migrate

# 4) (اختياري) ادخل بيانات تجريبية
npm run seed

# 5) شغّل السيرفر في وضع التطوير
npm run dev
```

السيرفر هيشتغل على `http://localhost:4000` (أو الـ PORT اللي حددته في `.env`).
تقدر تتأكد إنه شغال عن طريق: `GET /health`

## هيكل المشروع

```
src/
  config/db.js          اتصال Prisma بقاعدة البيانات
  middleware/auth.js     التحقق من JWT
  middleware/errorHandler.js  معالجة الأخطاء الموحدة
  controllers/           منطق كل موديول
  routes/                تعريف الـ endpoints
  utils/                 JWT helpers, ApiError
  index.js               نقطة تشغيل السيرفر
prisma/
  schema.prisma           تعريف الجداول
  seed.js                 بيانات تجريبية
```

## أهم الـ Endpoints

### Auth
| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/api/auth/register` | تسجيل حساب جديد (فيه accountType) |
| POST | `/api/auth/login` | تسجيل الدخول |
| GET | `/api/auth/me` | بيانات المستخدم الحالي (يحتاج Token) |

### Users
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/users/:id` | بروفايل عام لمستخدم |
| PATCH | `/api/users/me` | تعديل البيانات (بما فيها نبذة عنك) |
| POST | `/api/users/me/specialties` | إضافة تخصص |
| POST | `/api/users/me/verification` | طلب توثيق الحساب |

### Equipment (الأجهزة)
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/equipment` | قائمة الأجهزة (فلترة بـ category, governorate, q) |
| GET | `/api/equipment/mine` | أجهزتي |
| GET | `/api/equipment/:id` | تفاصيل جهاز |
| POST | `/api/equipment` | إضافة إعلان جهاز |
| PATCH | `/api/equipment/:id` | تعديل إعلان |
| DELETE | `/api/equipment/:id` | حذف إعلان |

### Requests (طلبات الإيجار/الشراء)
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/requests` | كل الطلبات المفتوحة (تظهر بالصفحة الرئيسية) |
| GET | `/api/requests/mine` | طلباتي |
| POST | `/api/requests` | نشر طلب (تاريخ البداية لازم يكون من نفس يوم النشر أو بعده) |
| PATCH | `/api/requests/:id/status` | تحديث حالة الطلب |

### Jobs (الوظائف)
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/jobs` | قائمة الوظائف (فلترة بـ jobType, workType, governorate) |
| GET | `/api/jobs/:id` | تفاصيل وظيفة |
| POST | `/api/jobs` | نشر وظيفة |
| POST | `/api/jobs/:id/contact` | تسجيل تواصل + إرجاع بيانات صاحب الإعلان (للمراسلة/الاتصال) |

### Chat
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/chat/conversations` | محادثاتي |
| POST | `/api/chat/conversations` | بدء/فتح محادثة مع مستخدم |
| GET | `/api/chat/conversations/:id/messages` | رسائل المحادثة |
| POST | `/api/chat/conversations/:id/messages` | إرسال رسالة |

### Reviews
| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/reviews/user/:userId` | تقييمات مستخدم |
| POST | `/api/reviews` | إضافة تقييم |

### Support
| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/api/support/tickets` | إرسال شكوى/طلب دعم |
| GET | `/api/support/tickets` | تذاكري |
| GET | `/api/support/notifications` | إشعاراتي |
| PATCH | `/api/support/notifications/:id/read` | تحديد إشعار كمقروء |

## المصادقة (Auth)
بعد تسجيل الدخول أو إنشاء الحساب هتاخد `token`، ابعته في كل طلب محمي كـ:
```
Authorization: Bearer <token>
```

## الخطوات الجاية المقترحة
1. رفع الصور: إضافة تكامل مع S3 أو Cloudinary بدل روابط images كنصوص فقط.
2. Real-time chat: تحويل chat من REST لـ Socket.io عشان الرسائل تظهر فورًا.
3. الدفع/الضمان (Escrow): بناء موديول دفع منفصل يتكامل مع بوابة دفع محلية (Paymob/Fawry).
4. نشر السيرفر: Railway أو Render (يدعموا PostgreSQL جاهز + نشر مباشر من Git).
5. ربط الفرونت اند الحالي (index.html) بالـ API دي بدل البيانات الوهمية.

## النشر (Deployment) — نظرة سريعة
### Railway
1. اعمل مشروع جديد واربطه بالـ repo.
2. ضيف PostgreSQL plugin (هيدّيك DATABASE_URL تلقائي).
3. حط باقي متغيرات البيئة (JWT_SECRET...).
4. أمر البناء: `npm install && npx prisma migrate deploy`
5. أمر التشغيل: `npm start`
