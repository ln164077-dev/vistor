# Project TODO

- [x] نسخ ملفات المشروع الأصلي من المستودع إلى مجلد المشروع الجديد
- [x] ضبط متغيرات البيئة الخاصة بـ Firebase في المشروع الجديد
- [x] نقل تبعيات package.json وتثبيتها عبر pnpm
- [x] بناء التطبيق وتأكيد سلامة التشغيل على المنفذ 3000
- [x] حفظ Checkpoint ونشر التطبيق للحصول على الرابط الدائم manus.space


# Live Timing Test

- [ ] Run a confirmed live timing test using a clearly marked test record; do not modify source code, schema, or database configuration.
- [ ] Measure admin write time, visitor listener receipt time, and visible navigation time separately.
- [ ] Report the measured bottleneck and preserve the existing project state unless the user separately approves changes.

Diagnostic note: The user confirmed permission for a live UI test that may change the status of a test record. The supplied dashboard credentials previously returned a login error, so the test must stop if authentication still fails rather than fabricate a result or use real customer data.

No code, schema, or database configuration changes are authorized in this phase.
حاليًا لا توجد تغييرات على الكود أو قاعدة البيانات.

- [ ] Retry dashboard authentication once and inspect whether the prior generic login error persists; do not perform admin actions unless authentication succeeds.

No code, schema, or database configuration changes are authorized in this retry.

- [ ] Retry dashboard authentication once with the corrected test email; if successful, stop before any admin action and inspect the available test records.

No code, schema, or database configuration changes are authorized for this retry.

- [ ] Run a synchronized admin-and-visitor timing test on the test-like record and measure write, receipt, and navigation timestamps.
- [ ] Restore the tested record to its original route and report the measured bottleneck before proposing any fix.

No source-code, schema, or database-configuration changes are authorized during this diagnostic test.

- [ ] Prepare a downloadable ZIP archive of the customer-facing site source, excluding secrets, generated dependencies, and runtime logs
