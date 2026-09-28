# إصلاح صلاحيات محرر الخرائط

رسالة `new row violates row-level security policy for table "navigation_points"` تعني أن عملية الإضافة وصلت إلى قاعدة البيانات، لكن سياسة الصلاحيات لم تسمح بها.

## الأسباب المعاد إنتاجها محليًا

- ملف `supabase/reset_and_init.sql` القديم ينشئ سياسات كتابة إلى `anon` فقط؛ المستخدم الذي يسجّل الدخول يصبح `authenticated`، فتُرفض إضافته حتى لو كان إداريًا.
- ترحيل الإنشاء الأساسي يستعلم عن `profiles` داخل سياسة قراءة الجدول نفسه؛ ينتج عنه `infinite recursion detected in policy for relation "profiles"` عند فحص دور المحرر.
- الحساب بلا ملف في `profiles` أو بدور غير إداري لا يملك صلاحية تحرير الخرائط، ويجب أن يبقى ممنوعًا.

## التطبيق على قاعدة البيانات المستضافة

1. افتح مشروع Supabase المطابق لقيمة `NEXT_PUBLIC_SUPABASE_URL` في بيئة النشر. المشروع المضبوط محليًا هو `hpwcfgfebgvqkyerdzrh`؛ تحقّق من مطابقته لبيئة المستخدم.
2. راجع السياسات الحالية باستعلام القراءة التالي من SQL Editor:

```sql
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'navigation_points', 'routes', 'route_steps')
order by tablename, policyname;
```

3. نفّذ محتوى `supabase/migrations/20260928090000_map_editor_permissions.sql` كاملًا بصفة مالك قاعدة البيانات. لا تشغّل ملف reset؛ فهو يحذف الجداول. الترحيل الجديد لا يحذف بيانات، ويصلح مسارَي التهيئة القديمين، ويمكن إعادة تطبيقه.
4. افحص حساب المستخدم المقصود، باستبدال البريد في الاستعلام التالي ببريده الحقيقي:

```sql
select u.id, u.email, p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('editor@example.com');
```

الدور المسموح لتحرير الخرائط هو أحد `super_admin` أو `university_admin` أو `building_manager`. لا يعيّن الترحيل أدوارًا لأي مستخدم تلقائيًا؛ إذا كان الملف مفقودًا أو الدور غير مناسب، يراجع مالك المشروع الحساب ويعيّن الدور المقصود عبر إدارة موثوقة. تحديث معلومات التواصل يظل متاحًا لصاحب الملف، لكن تغيير هويته أو دوره من المتصفح ممنوع.

5. سجّل الدخول بحساب المحرر، واحفظ نقطة ثم مسارًا للتأكد من عمل صلاحيات النقاط والمسارات وخطواتها. لا يكفي نشر كود الواجهة؛ يجب تطبيق SQL على قاعدة البيانات.

السياسات الجديدة تمنع كتابة الزائر على جداول محرر الخرائط وتحافظ على سياسات قراءة بيانات الملاحة العامة. وتزيل قراءة ملفات المستخدمين العامة وسياسات إنشائها/حذفها للزائر، لأنها تسمح بتزوير دور إداري. لا تعالج هذه الهجرة جميع سياسات الوضع التجريبي لبقية جداول المشروع.

## اختبار مستقل عن الإنتاج

```sh
python3 scripts/test-map-permissions.py
# قبل الإصلاح: يعيد رسالة RLS نفسها عند إدراج نقطة بحساب إداري مسجّل.
python3 scripts/test-map-permissions.py --migration supabase/migrations/20260928090000_map_editor_permissions.sql
python3 scripts/test-map-permissions.py --baseline init --migration supabase/migrations/20260928090000_map_editor_permissions.sql
```

الاختبار ينشئ PostgreSQL مؤقتًا بلا اتصال شبكي، ويشغّل ملفات الإعداد الفعلية. يتحقق من الأدوار الإدارية الثلاثة، وحفظ النقاط والمسار وخطوته، وإعادة تطبيق الترحيل، ومنع الطالب والحساب بلا ملف والزائر من إضافة نقطة، ومنع ترقية الحساب لنفسه. لا يقرأ مفاتيح المشروع ولا يكتب إلى الإنتاج.

مرجع آلية الأدوار والسياسات: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## خطأ عمود direction عند حفظ مسار

بعض قواعد البيانات القديمة تفتقد `route_steps.direction` و`warning_level`، وتقبل قيم اهتزاز مختلفة عن التطبيق. بعد ترحيل الصلاحيات أعلاه، طبّق `supabase/migrations/20260928100000_route_step_schema_and_atomic_save.sql` قبل نشر الواجهة الجديدة. يضيف الترحيل الحقلين ويحدّث القيم المقبولة ويطلب إعادة تحميل مخطط PostgREST.

الترحيل يحافظ على التسجيلات الصوتية وقيم الاهتزاز القديمة، ويترك الاتجاه والتحذير غير المعروفين فارغين لمراجعة المحرر. لا يستنتج تعليمات ملاحة لخطوات تاريخية، ولا يحذف المسارات الناقصة الناتجة عن محاولات حفظ سابقة. يمنع تطبيق الملاحة بدء مسار بخطوات ذات اتجاه أو اهتزاز أو تحذير غير مدعوم.

تحفظ الواجهة المسار وخطوته الأولى عبر `create_route_with_first_step` في عملية واحدة؛ إذا فشلت الخطوة يُلغى إدراج المسار أيضًا. تعمل الدالة بصلاحيات المتصل وسياسات RLS نفسها.

```sh
python3 scripts/test-map-permissions.py --legacy-route-steps --migration supabase/migrations/20260928090000_map_editor_permissions.sql --route-migration supabase/migrations/20260928100000_route_step_schema_and_atomic_save.sql
python3 scripts/test-map-permissions.py --baseline init --migration supabase/migrations/20260928090000_map_editor_permissions.sql --route-migration supabase/migrations/20260928100000_route_step_schema_and_atomic_save.sql
```

يتحقق الاختبار من حفظ مسار كامل، والتراجع عن المسار عند فشل خطوته، ورفض البيانات الناقصة والحسابات غير المخولة، والحفاظ على البيانات القديمة عند إعادة تطبيق الترحيل.
