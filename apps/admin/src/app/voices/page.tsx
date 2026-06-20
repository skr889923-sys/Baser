'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Mic, PlayCircle, RefreshCw, Search, Square, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Building,
  NavigationPoint,
  Route,
  RouteStep,
  VoiceCharacter,
  VoiceRecording,
} from '@baser/types';

type PhrasePriority = 'critical' | 'standard' | 'optional';
type RecordingFilter = 'all' | 'missing' | 'recorded' | 'critical';

type PhraseItem = {
  key: string;
  title: string;
  text: string;
  source: string;
  priority: PhrasePriority;
};

type PhraseGroup = {
  id: string;
  title: string;
  description: string;
  items: PhraseItem[];
};

const CORE_GROUPS: PhraseGroup[] = [
  {
    id: 'onboarding',
    title: 'البدء واللغة',
    description: 'الترحيب، اختيار اللغة، والانتقال الأول للتطبيق.',
    items: [
      { key: 'onboarding.welcome', title: 'رسالة الترحيب الرئيسية', text: 'مرحبًا بك في تطبيق بصيره للملاحة الجامعية. اضغط في منتصف الشاشة لاختيار اللغة، أو اضغط أسفل الشاشة للبدء.', source: 'شاشة الترحيب', priority: 'critical' },
      { key: 'onboarding.language_ar_enabled', title: 'تفعيل العربية', text: 'تم تفعيل اللغة العربية', source: 'اختيار اللغة', priority: 'standard' },
      { key: 'onboarding.language_en_enabled', title: 'تفعيل الإنجليزية', text: 'English language activated', source: 'اختيار اللغة', priority: 'optional' },
      { key: 'onboarding.start_application', title: 'بدء الاستخدام', text: 'ابدأ الاستخدام', source: 'زر البدء', priority: 'standard' },
    ],
  },
  {
    id: 'permissions',
    title: 'الصلاحيات',
    description: 'شرح ونتائج صلاحيات الموقع والكاميرا.',
    items: [
      { key: 'permissions.intro', title: 'مقدمة الصلاحيات', text: 'شاشة الصلاحيات. التطبيق يتطلب صلاحية الموقع لتحديد مسارك، وصلاحية الكاميرا لمسح الرموز. اضغط على الأزرار لمنح الصلاحية ثم اضغط زر المتابعة.', source: 'شاشة الصلاحيات', priority: 'critical' },
      { key: 'permissions.location_granted', title: 'منح صلاحية الموقع', text: 'تم منح صلاحية الموقع بنجاح', source: 'صلاحية الموقع', priority: 'critical' },
      { key: 'permissions.location_denied', title: 'رفض صلاحية الموقع', text: 'تم رفض صلاحية الموقع', source: 'صلاحية الموقع', priority: 'critical' },
      { key: 'permissions.camera_granted', title: 'منح صلاحية الكاميرا', text: 'تم منح صلاحية الكاميرا بنجاح', source: 'صلاحية الكاميرا', priority: 'critical' },
      { key: 'permissions.camera_denied', title: 'رفض صلاحية الكاميرا', text: 'تم رفض صلاحية الكاميرا', source: 'صلاحية الكاميرا', priority: 'critical' },
      { key: 'permissions.continue', title: 'المتابعة للرئيسية', text: 'متابعة إلى القائمة الرئيسية', source: 'زر المتابعة', priority: 'standard' },
    ],
  },
  {
    id: 'home',
    title: 'القائمة الرئيسية',
    description: 'الرسائل التي يسمعها المستخدم عند فتح القائمة أو الانتقال بين الوظائف.',
    items: [
      { key: 'home.intro', title: 'تعريف القائمة الرئيسية', text: 'القائمة الرئيسية. الشاشة تحتوي على ستة أزرار كبيرة: اختر وجهتك، امسح الرمز، أين أنا، طوارئ، بلاغ عن عائق، والإعدادات.', source: 'الرئيسية', priority: 'critical' },
      { key: 'home.open_destination', title: 'فتح اختيار الوجهة', text: 'فتح اختيار الوجهة', source: 'الرئيسية', priority: 'standard' },
      { key: 'home.open_qr', title: 'فتح مسح الرمز', text: 'فتح مسح الرمز', source: 'الرئيسية', priority: 'standard' },
      { key: 'home.open_where_am_i', title: 'فتح أين أنا', text: 'فتح شاشة تحديد موقعك', source: 'الرئيسية', priority: 'standard' },
      { key: 'home.open_emergency', title: 'فتح الطوارئ', text: 'فتح شاشة الطوارئ', source: 'الرئيسية', priority: 'critical' },
      { key: 'home.open_report', title: 'فتح البلاغات', text: 'فتح إبلاغ عن عائق', source: 'الرئيسية', priority: 'standard' },
      { key: 'home.open_settings', title: 'فتح الإعدادات', text: 'فتح الإعدادات', source: 'الرئيسية', priority: 'standard' },
    ],
  },
  {
    id: 'destination',
    title: 'اختيار الوجهة وتفاصيل المسار',
    description: 'البحث، النتائج، ملخص الوجهة، وتفضيلات المسار.',
    items: [
      { key: 'destination.intro', title: 'مقدمة اختيار الوجهة', text: 'شاشة اختيار الوجهة. اكتب اسم وجهتك في مربع البحث، أو تصفح القوائم أدناه.', source: 'اختيار الوجهة', priority: 'critical' },
      { key: 'destination.results_found', title: 'عدد نتائج البحث', text: 'وجدنا عددًا من الوجهات المطابقة.', source: 'البحث', priority: 'standard' },
      { key: 'destination.no_results', title: 'لا توجد نتائج', text: 'لا توجد نتائج مطابقة لبحثك.', source: 'البحث', priority: 'standard' },
      { key: 'destination.need_start_point', title: 'نقطة بداية ناقصة', text: 'نحتاج نقطة بداية مختلفة عن الوجهة لحساب المسار.', source: 'تفاصيل الوجهة', priority: 'critical' },
      { key: 'destination.no_route', title: 'لا يوجد مسار', text: 'نعتذر، لم نجد مسارًا مسجلاً لهذه الوجهة حاليًا.', source: 'تفاصيل الوجهة', priority: 'critical' },
      { key: 'destination.summary_template', title: 'قالب ملخص الوجهة', text: 'تفاصيل الوجهة: اسم الوجهة. المسافة بالأمتار. الزمن المتوقع بالدقائق. اضغط أسفل الشاشة لبدء الرحلة.', source: 'تفاصيل الوجهة', priority: 'critical' },
      { key: 'destination.start_navigation', title: 'بدء الإرشاد', text: 'ابدأ الإرشاد الملاحي الصوتي الآن', source: 'تفاصيل الوجهة', priority: 'critical' },
      { key: 'destination.preference_accessible', title: 'تفضيل المسار الآمن', text: 'تم تفضيل المسار المهيأ والآمن', source: 'تفضيلات المسار', priority: 'standard' },
      { key: 'destination.preference_fastest', title: 'تفضيل أسرع مسار', text: 'تم تفضيل أسرع مسار', source: 'تفضيلات المسار', priority: 'standard' },
    ],
  },
  {
    id: 'qr',
    title: 'مسح QR والتموضع الداخلي',
    description: 'رسائل الكاميرا، نجاح أو فشل المسح، ونقطة البداية من الملصق.',
    items: [
      { key: 'qr.intro', title: 'مقدمة مسح QR', text: 'شاشة مسح الرموز. وجه الكاميرا نحو ملصق كيو أر الإرشادي، أو اضغط زر المحاكاة.', source: 'مسح QR', priority: 'critical' },
      { key: 'qr.camera_permission_required', title: 'صلاحية الكاميرا مطلوبة', text: 'صلاحية الكاميرا مطلوبة لعملية المسح', source: 'مسح QR', priority: 'critical' },
      { key: 'qr.unknown_code', title: 'رمز غير معروف', text: 'هذا الرمز غير معروف', source: 'مسح QR', priority: 'critical' },
      { key: 'qr.scan_error', title: 'خطأ في المسح', text: 'حدث خطأ أثناء المسح.', source: 'مسح QR', priority: 'critical' },
      { key: 'qr.success_template', title: 'نجاح التعرف على الموقع', text: 'تم التعرف على الموقع بنجاح. أنت الآن عند اسم النقطة. سيتم قراءة تعليمات النقطة.', source: 'نتيجة QR', priority: 'critical' },
      { key: 'qr.simulation_success_template', title: 'نجاح المحاكاة', text: 'تم مسح الرمز بنجاح. أنت الآن عند اسم النقطة. اختر أحد الخيارات المتاحة للمتابعة.', source: 'محاكاة QR', priority: 'standard' },
      { key: 'qr.ready_again', title: 'جاهز للمسح مجددًا', text: 'جاهز للمسح مجددًا.', source: 'إعادة المسح', priority: 'standard' },
      { key: 'qr.route_from_here', title: 'ابدأ من هذه النقطة', text: 'ابدأ توجيهًا ملاحيًا من هذه النقطة', source: 'نتيجة QR', priority: 'critical' },
      { key: 'qr.choose_destination', title: 'اختيار وجهة جديدة', text: 'اختر وجهة جديدة', source: 'نتيجة QR', priority: 'standard' },
    ],
  },
  {
    id: 'navigation',
    title: 'الإرشاد الملاحي النشط',
    description: 'بدء الرحلة، تكرار التوجيه، الانحراف، الطوابق، الوصول، والإلغاء.',
    items: [
      { key: 'navigation.start_template', title: 'بدء الرحلة', text: 'بدء التوجيه إلى اسم الوجهة. المسافة الإجمالية بالأمتار.', source: 'الملاحة', priority: 'critical' },
      { key: 'navigation.no_active_session', title: 'لا توجد رحلة نشطة', text: 'لا توجد رحلة نشطة حاليًا.', source: 'الملاحة', priority: 'standard' },
      { key: 'navigation.repeat_audio', title: 'إعادة المقطع الصوتي', text: 'أعد المقطع الصوتي', source: 'الملاحة', priority: 'standard' },
      { key: 'navigation.no_previous_instruction', title: 'لا توجد تعليمات سابقة', text: 'لا توجد تعليمات سابقة لتكرارها', source: 'الصوت', priority: 'standard' },
      { key: 'navigation.deviation_warning', title: 'تحذير الانحراف', text: 'تنبيه: يبدو أنك انحرفت عن المسار المحدد. يرجى التوقف قليلاً وسنعيد توجيهك.', source: 'الملاحة', priority: 'critical' },
      { key: 'navigation.arrival', title: 'الوصول للوجهة', text: 'لقد وصلت إلى وجهتك بأمان. شكرًا لاستخدامك تطبيق بصيره.', source: 'الملاحة', priority: 'critical' },
      { key: 'navigation.cancelled', title: 'إلغاء الرحلة', text: 'تم إلغاء الرحلة الملاحية', source: 'الملاحة', priority: 'critical' },
      { key: 'navigation.floor_confirmed', title: 'تأكيد الطابق الجديد', text: 'تم تأكيد وصولك للطابق الجديد. لنكمل المسار.', source: 'المصعد والسلالم', priority: 'critical' },
      { key: 'navigation.elevator_notice', title: 'تنبيه المصعد', text: 'انتبه، أبواب المصعد تفتح. يرجى ركوب المصعد، وعند خروجك في الطابق المطلوب اضغط على زر تأكيد الوصول في الشاشة.', source: 'المصعد', priority: 'critical' },
      { key: 'navigation.stairs_notice', title: 'تنبيه السلالم', text: 'يرجى الحذر أثناء استخدام السلالم. واضغط على زر تأكيد الوصول عند بلوغ الطابق الجديد.', source: 'السلالم', priority: 'critical' },
      { key: 'navigation.previous_step', title: 'الخطوة السابقة', text: 'الخطوة السابقة', source: 'الملاحة', priority: 'optional' },
      { key: 'navigation.next_step', title: 'الخطوة التالية', text: 'التالي', source: 'الملاحة', priority: 'optional' },
    ],
  },
  {
    id: 'where_am_i',
    title: 'أين أنا؟',
    description: 'تحديد أقرب نقطة، تكرار الموقع، والفشل في الوصول للموقع.',
    items: [
      { key: 'where.location_permission_required', title: 'الموقع مطلوب', text: 'عذرًا، نحتاج صلاحية الموقع لتحديد مكانك.', source: 'أين أنا', priority: 'critical' },
      { key: 'where.database_failed', title: 'تعذر الاتصال بالبيانات', text: 'تعذر الاتصال بقاعدة البيانات لتحديد الموقع.', source: 'أين أنا', priority: 'critical' },
      { key: 'where.gps_failed', title: 'تعذر GPS', text: 'تعذر جلب موقعك الحالي من نظام تحديد الموقع.', source: 'أين أنا', priority: 'critical' },
      { key: 'where.location_template', title: 'قالب الموقع الحالي', text: 'أنت الآن بالقرب من اسم النقطة. تفاصيل الموقع. على بعد عدد أمتار تقريبًا.', source: 'أين أنا', priority: 'critical' },
      { key: 'where.repeat_location', title: 'كرر الموقع', text: 'كرر الموقع: أنت عند اسم النقطة', source: 'أين أنا', priority: 'standard' },
      { key: 'where.plan_route_from_here', title: 'تخطيط مسار من هنا', text: 'خطط مسار من هنا', source: 'أين أنا', priority: 'standard' },
      { key: 'where.need_help', title: 'رابط الطوارئ السريع', text: 'تحتاج لمساعدة؟ اطلب الطوارئ', source: 'أين أنا', priority: 'critical' },
    ],
  },
  {
    id: 'emergency',
    title: 'الطوارئ SOS',
    description: 'طلب النجدة، تأكيد الإرسال، المنارة، والإلغاء.',
    items: [
      { key: 'emergency.intro', title: 'مقدمة الطوارئ', text: 'شاشة طوارئ الأمن الجامعي. هل تحتاج لمساعدة عاجلة؟ اضغط مرتين على الزر الأحمر في منتصف الشاشة لتأكيد إرسال موقعك ورسالتك.', source: 'الطوارئ', priority: 'critical' },
      { key: 'emergency.confirm_button', title: 'تأكيد طلب المساعدة', text: 'اضغط لتأكيد طلب المساعدة', source: 'الطوارئ', priority: 'critical' },
      { key: 'emergency.sent', title: 'تم إرسال البلاغ', text: 'تم إرسال بلاغ الطوارئ للأمن الجامعي. سيتم التواصل معك أو إرسال دورية فورًا. يرجى البقاء في مكانك.', source: 'الطوارئ', priority: 'critical' },
      { key: 'emergency.beacon_active', title: 'منارة الطوارئ نشطة', text: 'منارة الطوارئ نشطة.', source: 'منارة SOS', priority: 'critical' },
      { key: 'emergency.beacon_description', title: 'شرح المنارة', text: 'تم إرسال إحداثياتك بنجاح. سنقوم بإصدار اهتزازات متكررة لمساعدة المستجيبين على الوصول إليك.', source: 'منارة SOS', priority: 'critical' },
      { key: 'emergency.cancelled', title: 'إلغاء طلب الطوارئ', text: 'تم إلغاء طلب الطوارئ. الرجوع للرئيسية.', source: 'الطوارئ', priority: 'critical' },
      { key: 'emergency.stop_beacon', title: 'إيقاف المنارة', text: 'إيقاف المنارة وإلغاء الطلب', source: 'منارة SOS', priority: 'critical' },
    ],
  },
  {
    id: 'reports',
    title: 'بلاغات العوائق',
    description: 'تحديد نوع البلاغ، وصفه، وإرساله للإدارة.',
    items: [
      { key: 'report.intro', title: 'مقدمة البلاغ', text: 'شاشة الإبلاغ عن عائق. تصفح خيارات الإبلاغ الأربعة الكبيرة على الشاشة لتحديد نوع المشكلة، أو اكتب تفاصيل في حقل النص بالأسفل.', source: 'البلاغات', priority: 'standard' },
      { key: 'report.selected_template', title: 'تم اختيار نوع البلاغ', text: 'تم اختيار نوع البلاغ.', source: 'البلاغات', priority: 'standard' },
      { key: 'report.obstacle', title: 'عائق في الممر', text: 'عائق في الممر', source: 'نوع البلاغ', priority: 'standard' },
      { key: 'report.closed_door', title: 'باب مغلق', text: 'باب مغلق', source: 'نوع البلاغ', priority: 'standard' },
      { key: 'report.broken_elevator', title: 'مصعد معطل', text: 'مصعد معطل', source: 'نوع البلاغ', priority: 'critical' },
      { key: 'report.maintenance_work', title: 'أعمال صيانة', text: 'أعمال صيانة', source: 'نوع البلاغ', priority: 'standard' },
      { key: 'report.submit_success', title: 'نجاح إرسال البلاغ', text: 'تم إرسال بلاغك للأمان بنجاح. نشكرك على مساعدتنا في الحفاظ على سلامة الجميع.', source: 'البلاغات', priority: 'critical' },
      { key: 'report.default_description', title: 'بلاغ بدون تفاصيل', text: 'بلاغ مرسل من الجوال بدون تفاصيل إضافية', source: 'البلاغات', priority: 'optional' },
    ],
  },
  {
    id: 'settings',
    title: 'الإعدادات والتفضيلات',
    description: 'اللغة، التباين، اختبار الصوت والاهتزاز، وتفضيلات المسار.',
    items: [
      { key: 'settings.intro', title: 'مقدمة الإعدادات', text: 'شاشة الإعدادات. يمكنك تعديل خيارات اللغة والتباين وتفضيلات الملاحة، أو تفعيل اختبار الصوت والاهتزاز بالأسفل.', source: 'الإعدادات', priority: 'standard' },
      { key: 'settings.switched_ar', title: 'التحويل للعربية', text: 'تم تحويل التطبيق للغة العربية', source: 'الإعدادات', priority: 'standard' },
      { key: 'settings.switched_en', title: 'التحويل للإنجليزية', text: 'Application switched to English', source: 'الإعدادات', priority: 'optional' },
      { key: 'settings.high_contrast_enabled', title: 'تفعيل التباين', text: 'تم تفعيل وضع التباين العالي', source: 'الإعدادات', priority: 'standard' },
      { key: 'settings.high_contrast_disabled', title: 'تعطيل التباين', text: 'تم تعطيل وضع التباين العالي', source: 'الإعدادات', priority: 'standard' },
      { key: 'settings.test_success', title: 'نجاح اختبار الصوت والاهتزاز', text: 'تم اختبار الصوت ونظام الاهتزاز بنجاح، التطبيق جاهز للعمل.', source: 'الإعدادات', priority: 'standard' },
      { key: 'settings.route_accessible', title: 'تفضيل مهيأ وآمن', text: 'تم تفضيل المسار مهيأ وآمن', source: 'الإعدادات', priority: 'standard' },
      { key: 'settings.route_fastest', title: 'تفضيل الأسرع', text: 'تم تفضيل المسار الأسرع', source: 'الإعدادات', priority: 'standard' },
    ],
  },
  {
    id: 'system',
    title: 'النظام والصوت',
    description: 'حالات عامة يستعملها محرك الصوت في أكثر من شاشة.',
    items: [
      { key: 'system.voice_enabled', title: 'تفعيل الصوت', text: 'تم تفعيل الصوت', source: 'نظام الصوت', priority: 'standard' },
      { key: 'system.voice_muted', title: 'كتم الصوت', text: 'تم كتم الصوت', source: 'نظام الصوت', priority: 'standard' },
      { key: 'system.meters', title: 'وحدة متر', text: 'مترًا', source: 'وحدات القياس', priority: 'optional' },
      { key: 'system.minutes', title: 'وحدة دقيقة', text: 'دقيقة', source: 'وحدات القياس', priority: 'optional' },
      { key: 'system.near_prefix', title: 'مقدمة القرب من نقطة', text: 'أنت الآن بالقرب من', source: 'نظام الموقع', priority: 'standard' },
    ],
  },
];

const priorityLabel: Record<PhrasePriority, string> = {
  critical: 'أساسي',
  standard: 'مهم',
  optional: 'اختياري',
};

export default function VoicesPage() {
  const [characters, setCharacters] = useState<VoiceCharacter[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState('onboarding');
  const [recordingFilter, setRecordingFilter] = useState<RecordingFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [newCharName, setNewCharName] = useState('');
  const [newCharGender, setNewCharGender] = useState<VoiceCharacter['gender']>('female');

  const [isRecording, setIsRecording] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async () => {
    setLoading(true);

    const [
      { data: chars },
      { data: bldgs },
      { data: pts },
      { data: rts },
      { data: routeSteps },
    ] = await Promise.all([
      supabase.from('voice_characters').select('*').order('created_at', { ascending: true }),
      supabase.from('buildings').select('*').order('name_ar', { ascending: true }),
      supabase.from('navigation_points').select('*').order('name_ar', { ascending: true }),
      supabase.from('routes').select('*').order('name_ar', { ascending: true }),
      supabase.from('route_steps').select('*').order('step_order', { ascending: true }),
    ]);

    const loadedCharacters = (chars || []) as VoiceCharacter[];
    setCharacters(loadedCharacters);
    setBuildings((bldgs || []) as Building[]);
    setPoints((pts || []) as NavigationPoint[]);
    setRoutes((rts || []) as Route[]);
    setSteps((routeSteps || []) as RouteStep[]);

    if (loadedCharacters.length > 0 && !activeCharId) {
      setActiveCharId(loadedCharacters[0].id);
    }

    setLoading(false);
  };

  const fetchRecordings = async (charId: string) => {
    const { data } = await supabase.from('voice_recordings').select('*').eq('character_id', charId);
    setRecordings((data || []) as VoiceRecording[]);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeCharId) {
      fetchRecordings(activeCharId);
    } else {
      setRecordings([]);
    }
  }, [activeCharId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const dynamicGroups = useMemo<PhraseGroup[]>(() => {
    const routeById = Object.fromEntries(routes.map(route => [route.id, route]));

    return [
      {
        id: 'buildings',
        title: 'المباني والمرافق',
        description: 'أسماء المباني ووصفها الصوتي كما تظهر للمستخدم.',
        items: buildings.flatMap(building => [
          {
            key: `building.${building.id}.name`,
            title: `اسم المبنى: ${building.name_ar}`,
            text: building.name_ar,
            source: 'المباني',
            priority: 'standard' as const,
          },
          {
            key: `building.${building.id}.description`,
            title: `وصف المبنى: ${building.name_ar}`,
            text: building.description_ar || building.name_ar,
            source: 'المباني',
            priority: 'optional' as const,
          },
        ]),
      },
      {
        id: 'points',
        title: 'النقاط الملاحية',
        description: 'أسماء النقاط، وصفها، والتعليمات التي تقرأ عند الوقوف عندها أو مسح QR.',
        items: points.flatMap(point => [
          {
            key: `point.${point.id}.name`,
            title: `اسم النقطة: ${point.name_ar}`,
            text: point.name_ar,
            source: 'النقاط',
            priority: 'critical' as const,
          },
          {
            key: `point.${point.id}.description`,
            title: `وصف النقطة: ${point.name_ar}`,
            text: point.description_ar || point.name_ar,
            source: 'النقاط',
            priority: 'standard' as const,
          },
          {
            key: `point.${point.id}.instruction`,
            title: `تعليمات النقطة: ${point.name_ar}`,
            text: point.audio_instruction_ar || point.description_ar || point.name_ar,
            source: 'النقاط',
            priority: 'critical' as const,
          },
        ]),
      },
      {
        id: 'routes_dynamic',
        title: 'المسارات المحفوظة',
        description: 'أسماء المسارات وملخصات الرحلات المسجلة من لوحة التحكم.',
        items: routes.flatMap(route => [
          {
            key: `route.${route.id}.name`,
            title: `اسم المسار: ${route.name_ar}`,
            text: route.name_ar,
            source: 'المسارات',
            priority: 'standard' as const,
          },
          {
            key: `route.${route.id}.summary`,
            title: `ملخص المسار: ${route.name_ar}`,
            text: `تم اختيار مسار: ${route.name_ar}. المسافة الكلية ${route.distance_meters} مترًا. الزمن المتوقع للوصول ${route.estimated_minutes} دقيقة.`,
            source: 'المسارات',
            priority: 'standard' as const,
          },
        ]),
      },
      {
        id: 'route_steps',
        title: 'خطوات المسارات',
        description: 'كل تعليمات الحركة خطوة بخطوة، وهي أهم تسجيلات الملاحة الفعلية.',
        items: steps.map(step => {
          const route = routeById[step.route_id];
          return {
            key: `route_step.${step.id}.instruction`,
            title: `خطوة ${step.step_order}${route ? ` - ${route.name_ar}` : ''}`,
            text: step.instruction_ar,
            source: 'خطوات المسار',
            priority: 'critical' as const,
          };
        }),
      },
    ];
  }, [buildings, points, routes, steps]);

  const groups = useMemo(() => [...CORE_GROUPS, ...dynamicGroups], [dynamicGroups]);
  const allItems = useMemo(() => groups.flatMap(group => group.items), [groups]);
  const recordingsByKey = useMemo(() => Object.fromEntries(recordings.map(recording => [recording.phrase_key, recording])), [recordings]);

  const totalCount = allItems.length;
  const recordedCount = allItems.filter(item => recordingsByKey[item.key]).length;
  const criticalCount = allItems.filter(item => item.priority === 'critical').length;
  const missingCriticalCount = allItems.filter(item => item.priority === 'critical' && !recordingsByKey[item.key]).length;
  const completionPercent = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  const visibleGroups = groups
    .map(group => {
      const filteredItems = group.items.filter(item => {
        const hasRecording = Boolean(recordingsByKey[item.key]);
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearch ||
          item.title.toLowerCase().includes(normalizedSearch) ||
          item.text.toLowerCase().includes(normalizedSearch) ||
          item.source.toLowerCase().includes(normalizedSearch);

        const matchesFilter =
          recordingFilter === 'all' ||
          (recordingFilter === 'missing' && !hasRecording) ||
          (recordingFilter === 'recorded' && hasRecording) ||
          (recordingFilter === 'critical' && item.priority === 'critical' && !hasRecording);

        return matchesSearch && matchesFilter;
      });

      return { ...group, items: filteredItems };
    })
    .filter(group => group.id === activeGroupId && group.items.length > 0);

  const activeGroup = groups.find(group => group.id === activeGroupId) || groups[0];

  const handleAddCharacter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCharName.trim()) return;

    const { data, error } = await supabase.from('voice_characters').insert([{
      name: newCharName.trim(),
      gender: newCharGender,
    }]).select();

    if (error) {
      console.error(error);
      alert('تعذر إنشاء الشخصية الصوتية.');
      return;
    }

    if (data?.[0]) {
      const createdCharacter = data[0] as VoiceCharacter;
      setCharacters([...characters, createdCharacter]);
      setActiveCharId(createdCharacter.id);
      setNewCharName('');
    }
  };

  const startRecording = async (phraseKey: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadRecording(phraseKey, audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(phraseKey);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('تعذر الوصول للمايكروفون. يرجى التأكد من إعطاء الصلاحيات للمتصفح.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const uploadRecording = async (phraseKey: string, audioBlob: Blob) => {
    if (!activeCharId) return;

    const safeKey = phraseKey.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${activeCharId}/${safeKey}-${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from('voiceovers')
      .upload(fileName, audioBlob, { contentType: 'audio/webm' });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      alert('حدث خطأ أثناء رفع التسجيل.');
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('voiceovers').getPublicUrl(fileName);
    const audioUrl = publicUrlData.publicUrl;

    const { error: dbError } = await supabase.from('voice_recordings').upsert({
      character_id: activeCharId,
      phrase_key: phraseKey,
      audio_url: audioUrl,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'character_id,phrase_key',
    });

    if (dbError) {
      console.error('Recording DB Error:', dbError);
      alert('تم رفع الملف، لكن تعذر حفظ رابط التسجيل في قاعدة البيانات.');
      return;
    }

    await fetchRecordings(activeCharId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPhraseItem = (item: PhraseItem) => {
    const recording = recordingsByKey[item.key];
    const isThisRecording = isRecording === item.key;

    return (
      <div key={item.key} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:border-sky-200 transition-colors">
        <div className="flex flex-col xl:flex-row xl:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="font-bold text-slate-900">{item.title}</h4>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                item.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-100' :
                item.priority === 'standard' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                {priorityLabel[item.priority]}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500">
                {item.source}
              </span>
              {recording ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  مسجل
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  ناقص
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 leading-7 bg-slate-50 border border-slate-100 rounded-lg p-3">
              {item.text}
            </p>
            <p className="text-[11px] text-slate-400 mt-2 font-mono text-left" dir="ltr">{item.key}</p>
          </div>

          <div className="w-full xl:w-72 flex flex-col gap-3 shrink-0">
            {recording && !isThisRecording && (
              <audio src={recording.audio_url} controls className="w-full h-9" />
            )}

            {isThisRecording ? (
              <button
                onClick={stopRecording}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 animate-pulse"
              >
                <Square className="w-4 h-4" />
                إيقاف التسجيل ({formatTime(recordingTime)})
              </button>
            ) : (
              <button
                onClick={() => startRecording(item.key)}
                disabled={!activeCharId || !!isRecording}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all ${
                  isRecording || !activeCharId
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : recording
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                {recording ? <RefreshCw className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {recording ? 'إعادة تسجيل' : 'تسجيل'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">إدارة التعليق الصوتي</h1>
          <p className="text-slate-500 mt-2">كتالوج شامل لتسجيل الصوت البشري لكل رسائل التطبيق، مع أسماء المباني والنقاط والمسارات وخطوات الملاحة.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث القائمة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 block mb-2">إجمالي العبارات</span>
          <strong className="text-3xl text-slate-900">{totalCount}</strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 block mb-2">المسجل</span>
          <strong className="text-3xl text-emerald-700">{recordedCount}</strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 block mb-2">النواقص الأساسية</span>
          <strong className="text-3xl text-red-700">{missingCriticalCount}</strong>
          <span className="text-xs text-slate-400 mr-2">من {criticalCount}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 block mb-2">اكتمال الشخصية الحالية</span>
          <div className="flex items-center gap-3">
            <strong className="text-3xl text-sky-700">{completionPercent}%</strong>
            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-sky-600" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-lg text-slate-800 mb-4">الشخصيات الصوتية</h3>
            <div className="space-y-2 mb-6">
              {characters.map(character => (
                <button
                  key={character.id}
                  onClick={() => setActiveCharId(character.id)}
                  className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all ${
                    activeCharId === character.id
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="block">{character.name}</span>
                  <span className="text-xs text-slate-400 font-semibold">{character.gender === 'female' ? 'صوت أنثى' : 'صوت ذكر'}</span>
                </button>
              ))}
              {characters.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">لا توجد شخصيات. أضف شخصية للبدء.</p>
              )}
            </div>

            <form onSubmit={handleAddCharacter} className="pt-6 border-t border-slate-100 space-y-3">
              <h4 className="text-sm font-bold text-slate-700">إضافة شخصية جديدة</h4>
              <input
                type="text"
                placeholder="مثال: صوت سارة"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                value={newCharName}
                onChange={event => setNewCharName(event.target.value)}
                required
              />
              <select
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                value={newCharGender}
                onChange={event => setNewCharGender(event.target.value as VoiceCharacter['gender'])}
              >
                <option value="female">صوت أنثى</option>
                <option value="male">صوت ذكر</option>
              </select>
              <button type="submit" className="w-full bg-sky-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-sky-700 flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                إضافة
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-3">الأقسام</h3>
            <div className="space-y-1">
              {groups.map(group => {
                const groupRecorded = group.items.filter(item => recordingsByKey[item.key]).length;
                return (
                  <button
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className={`w-full text-right px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      activeGroupId === group.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block">{group.title}</span>
                    <span className={`text-[11px] ${activeGroupId === group.id ? 'text-slate-300' : 'text-slate-400'}`}>
                      {groupRecorded} / {group.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3 space-y-5">
          {!activeCharId ? (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 border-dashed p-12 text-center">
              <Mic className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-lg font-bold text-slate-700 mt-4">اختر أو أضف شخصية صوتية للبدء بالتسجيل</h3>
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeGroup?.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{activeGroup?.description}</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-3.5 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="ابحث في عنوان العبارة أو النص أو المصدر..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'all', label: 'الكل' },
                      { key: 'missing', label: 'الناقص' },
                      { key: 'recorded', label: 'المسجل' },
                      { key: 'critical', label: 'أساسي ناقص' },
                    ].map(filter => (
                      <button
                        key={filter.key}
                        onClick={() => setRecordingFilter(filter.key as RecordingFilter)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold ${
                          recordingFilter === filter.key ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {visibleGroups.length > 0 ? (
                visibleGroups.map(group => (
                  <div key={group.id} className="space-y-3">
                    {group.items.map(renderPhraseItem)}
                  </div>
                ))
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                  لا توجد عبارات تطابق البحث أو التصفية الحالية.
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
