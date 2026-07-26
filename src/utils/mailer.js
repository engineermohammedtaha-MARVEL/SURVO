const { Resend } = require('resend');

let resend = null;

function getResend() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) return null;
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function sendResetPasswordEmail(toEmail, resetUrl) {
  const r = getResend();
  if (!r) {
    console.warn('RESEND_API_KEY مش مظبوط — الإيميل مش هيتبعت. الرابط:', resetUrl);
    return;
  }

  await r.emails.send({
    from: process.env.RESEND_FROM || 'SURVO <onboarding@resend.dev>',
    to: toEmail,
    subject: 'إعادة تعيين كلمة المرور — SURVO',
    html: `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width:480px; margin:0 auto;">
        <h2 style="color:#1e2a4a;">إعادة تعيين كلمة المرور</h2>
        <p>وصلنا طلب لإعادة تعيين كلمة المرور بتاعة حسابك في SURVO.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block; background:#1e2a4a; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
            إعادة تعيين كلمة المرور
          </a>
        </p>
        <p style="color:#888; font-size:12px;">الرابط ده هيشتغل لمدة ساعة واحدة بس. لو ما طلبتش ده، تجاهل الإيميل ده.</p>
      </div>
    `,
  });
}

module.exports = { sendResetPasswordEmail };
