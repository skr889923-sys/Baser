# مواصفات الواجهات البرمجية والخدمات | API_SPEC

يوضح هذا المستند تفاصيل الخدمات البرمجية (TypeScript Services) المدمجة في تطبيق الجوال والواجهات البرمجية المستخدمة للربط بقاعدة بيانات Supabase.

---

## ١. خدمات تطبيق الجوال (Mobile Services)

### 1. `NavigationService`
الخدمة الملاحية المسؤولة عن حساب أفضل المسارات الجغرافية والمطابقة وتحديد الانحرافات.
- **`getDistance(lat1, lon1, lat2, lon2): number`**
  - لحساب المسافة الجغرافية المستقيمة بالأمتار بين نقطتين بالاعتماد على صيغة هافرساين (Haversine Formula).
- **`getNearestPoint(latitude, longitude): Promise<NavigationPoint>`**
  - للبحث في قاعدة البيانات وإرجاع أقرب عقدة ملاحية معروفة لموقع الـ GPS الحالي للطالب.
- **`getRoutesToDestination(startPointId, destinationPointId): Promise<Route[]>`**
  - للبحث عن المسارات المسجلة التي تربط نقطة البداية (مثل البوابة أو ملصق QR الممسوح) بوجهة المستخدم المحددة.
- **`selectBestRoute(routes, preference): Route`**
  - تصفية المسارات واختيار الأنسب بناءً على خيار المستخدم (تجنب الدرج للكرسي المتحرك، تفضيل الممرات التكتيلية للكفيف).
- **`speakStep(step, isAr): Promise<void>`**
  - نطق الإرشاد الحالي للخطوة النشطة صوتيًا.
- **`triggerHaptic(step): Promise<void>`**
  - تشغيل نمط الاهتزاز المطابق لاتجاه الحركة للخطوة الحالية.
- **`announceDeviation(isAr): Promise<void>`**
  - التنبيه الصوتي والاهتزازي الفوري عند استشعار ابتعاد المستخدم عن مسار الرحلة المخطط له.
- **`announceArrival(isAr): Promise<void>`**
  - تشغيل نغمة الاهتزاز والترحيب الصوتي عند إكمال الخطوة الأخيرة والوصول للموقع الهدف.

### 2. `VoiceService`
محرك التوجيه الصوتي والتحويل من النص إلى كلام (TTS).
- **`speak(text, forceLanguage?): Promise<void>`**
  - نطق الجمل الإرشادية مع دعم الإيقاف التلقائي للمقاطع الصوتية السابقة لتفادي التداخل الصوتي.
- **`stop(): Promise<void>`**
  - إيقاف نطق المقطع الصوتي الحالي فورًا.
- **`repeatLastInstruction(): void`**
  - إعادة نطق التوجيه الصوتي الأخير عند ضغط الطالب على الشاشة.
- **`setSpeechRate(rate): void`**
  - ضبط سرعة النطق والحديث لتسهيل الفهم (تتراوح بين 0.5 بطيء جدًا و 2.0 سريع).
- **`setVoiceLanguage(lang): void`**
  - تحويل لغة التوجيه بين العربية والإنجليزية.

### 3. `HapticsService`
محرك الاهتزازات الحسية واللمسية (Haptic Engine).
- **`trigger(pattern): Promise<void>`**
  - إرسال نمط الاهتزاز المتوافق مع الإجراء الحالي (`continue`, `turn_left`, `turn_right`, `warning`, `arrived`, `emergency`).
- **`setVibrationEnabled(enabled): void`**
  - تفعيل أو كتم اهتزازات الجوال الملاحية.

---

## ٢. عمليات قاعدة بيانات Supabase (Supabase Queries & Mutations)

### 1. استرجاع البيانات (Read Operations)
- **`getBuildings(): Promise<Building[]>`**
  - جلب قائمة الكليات والمباني لتحديث قائمة البحث والتصنيفات.
- **`getNavigationPoints(buildingId?): Promise<NavigationPoint[]>`**
  - جلب العقد الملاحية التابعة لمبنى محدد أو جلب كافة النقاط للملاحة الخارجية.
- **`getRoutes(): Promise<Route[]>`**
  - استرجاع مسارات الحرم الجامعي المخططة.
- **`getRouteSteps(routeId): Promise<RouteStep[]>`**
  - استرجاع الخطوات التفصيلية المرتبة والمقترنة بالمسار المحدد لبدء الرحلة الملاحية.

### 2. العمليات التفاعلية (Mutations)
- **`submitReport(report): Promise<Report>`**
  - إرسال بلاغ ميداني جديد عن عائق في ممر الحركة (يخزن في جدول `reports`).
- **`submitEmergency(emergency): Promise<EmergencyRequest>`**
  - تفعيل إشارة الاستغاثة الحية وإرسال الإحداثيات الجغرافية وغرفة الأمن (تخزن في `emergency_requests`).
- **`logQRScan(pointId, userId?): Promise<void>`**
  - تسجيل حركة مرور أو تموضع المستخدم عند ملصق QR لرفع عداد المسح وتحديث إحصائيات لوحة التحكم.
