import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { deliveries, inquiries, notices, paymentHistory, settings, students } from "../../db/schema.js";

type Course = { id: string; name: string; fee: number | null };
type Department = { id: string; name: string; description: string; courses: Course[] };
type Settings = {
  title: string; intro: string; aboutText: string; adminTitle: string; registrationIntro: string;
  primary: string; primaryDark: string; accent: string; background: string; textColor: string; gradientAngle: number;
  hiddenSections: string[]; departments: Department[];
  adminEmail: string; secretaryEmail: string; smsSender: string; whatsappSender: string; whatsappTemplateId: number | null;
};

const SECTIONS = ["about", "why", "inquiries", "contact"];
const course = (id: string, name: string, fee: number | null = null): Course => ({ id, name, fee });
const DEFAULTS: Settings = {
  title: "معهد جسور اليمن للتدريب والتأهيل",
  intro: "نبني لك جسوراً نحو المستقبل من خلال دورات احترافية في الحاسوب والإنجليزية والجرافيكس والأمن السيبراني والبرمجة",
  aboutText: "جاء اسم «جسور اليمن» من إيماننا العميق بأن العلم هو الجسر الذي يربط أحلام الشباب اليمني بمستقبلهم المشرق، ويربط المواهب بسوق العمل، ويربط اليمن بأحدث ما وصلت إليه التكنولوجيا العالمية. نحن لسنا مجرد معهد تدريب، بل جسور متينة يعبر عليها كل متدرب من حاضره إلى مستقبله.",
  adminTitle: "إدارة المعهد",
  registrationIntro: "املأ النموذج للتسجيل حضورياً أو أونلاين",
  primary: "#6d28d9", primaryDark: "#4c1d95", accent: "#f5a623", background: "#faf8ff", textColor: "#1f2937", gradientAngle: 135,
  hiddenSections: [],
  departments: [
    { id: "computer", name: "قسم الحاسوب", description: "مسارات تدريبية متدرجة من الأساسيات حتى الدبلومات المتخصصة.", courses: [course("computer-basics", "أساسيات الحاسوب"), course("computer-diploma", "دبلوم حاسوب"), course("secretary-diploma", "دبلوم سكرتارية تنفيذية وإدارة مكاتب")] },
    { id: "english", name: "قسم اللغة الإنجليزية", description: "مناهج إنجليزية حديثة بثلاثة مستويات متدرجة حتى إتقان اللغة.", courses: [course("english-beginner", "مستوى مبتدئ"), course("english-intermediate", "مستوى متوسط"), course("english-advanced", "مستوى متقدم")] },
    { id: "tutoring", name: "قسم التقوية المنهجية", description: "تقوية في جميع المواد الدراسية لجميع المراحل الدراسية مع متابعة فردية.", courses: [course("tutoring", "تقوية منهجية")] },
    { id: "graphics", name: "قسم الجرافيكس", description: "دورات احترافية في التصوير وبرامج أدوبي، كل برنامج دورة مستقلة.", courses: [course("photography", "دورة التصوير الفوتوغرافي"), course("photoshop", "دورة فوتوشوب Photoshop"), course("illustrator", "دورة اليستريتور Illustrator"), course("indesign", "دورة إن ديزاين InDesign"), course("premiere", "دورة بريمير Premiere Pro"), course("after-effects", "دورة أفتر إيفكت After Effects")] },
    { id: "security", name: "الأمن السيبراني والحماية", description: "أساسيات الأمن السيبراني والحماية من الاختراق وأمن الإنترنت ومبادئ الذكاء الاصطناعي.", courses: [course("cyber-security", "الأمن السيبراني والحماية")] },
    { id: "programming", name: "دورات البرمجة حسب الطلب", description: "تطوير مواقع، تطبيقات، بايثون، وغيرها حسب طلب المتدرب.", courses: [course("programming", "دورة برمجة حسب الطلب")] },
  ],
  adminEmail: "", secretaryEmail: "", smsSender: "JusoorYemen", whatsappSender: "", whatsappTemplateId: null,
};

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const str = (v: unknown, max: number, field: string, required = true) => {
  const s = typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v).trim();
  if (required && !s) throw new HttpError(400, `الحقل ${field} مطلوب.`);
  if (s.length > max) throw new HttpError(400, `الحقل ${field} أطول من المسموح.`);
  return s;
};
const money = (v: unknown, field: string, nullable: boolean) => {
  if (v === "" || v === null || v === undefined) {
    if (nullable) return null;
    throw new HttpError(400, `الحقل ${field} مطلوب.`);
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100_000_000) throw new HttpError(400, `قيمة ${field} غير صحيحة.`);
  return n;
};
const email = (v: unknown) => {
  const s = str(v, 320, "البريد").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new HttpError(400, "البريد الإلكتروني غير صحيح.");
  return s;
};
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[\da-f]{6}$/i.test(v) ? v : fallback);

// ---------- settings ----------
async function loadSettings(): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return { ...DEFAULTS, ...((row?.data as Partial<Settings>) ?? {}) };
}
async function saveSettings(data: Settings) {
  await db.insert(settings).values({ id: 1, data }).onConflictDoUpdate({ target: settings.id, set: { data, updatedAt: new Date() } });
}
const allCourses = (s: Settings) => s.departments.flatMap((d) => d.courses);
const publicConfig = (s: Settings) => {
  const { adminEmail, secretaryEmail, smsSender, whatsappSender, whatsappTemplateId, ...rest } = s;
  return rest;
};

// ---------- students ----------
type StudentRow = typeof students.$inferSelect;
const statusOf = (s: { fee: number | null; paid: number }) =>
  s.fee === null ? "بانتظار تحديد الرسوم" : s.paid >= s.fee ? "مسدد الفاتورة" : s.paid > 0 ? "مسدد جزئياً" : "في انتظار التسديد";
const view = (s: StudentRow) => ({
  id: s.id, name: s.name, phone: s.phone, studyType: s.studyType, courseId: s.courseId, course: s.courseName,
  fee: s.fee, paid: s.paid, remaining: s.fee === null ? null : Math.max(s.fee - s.paid, 0), status: statusOf(s),
  notes: s.notes, repeating: s.repeating, result: s.result, version: s.version, createdAt: s.createdAt,
});
const fmt = (n: number | null) => (n === null ? "لم تحدد بعد" : n.toLocaleString("ar-YE") + " ر.ي");
const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const newStudentId = () => `JY-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
const newInquiryId = () => "Q-" + randomBytes(4).toString("hex").toUpperCase();

async function getStudent(id: string) {
  const [s] = await db.select().from(students).where(eq(students.id, id));
  if (!s) throw new HttpError(404, "لم يتم العثور على الطالب.");
  return s;
}

// ---------- staff auth ----------
type Staff = { email: string; role: "admin" | "secretary" };
function readCookie(req: Request, name: string) {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(req.headers.get("cookie") ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}
async function requireStaff(req: Request, adminOnly = false): Promise<Staff> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : readCookie(req, "nf_jwt");
  if (!token) throw new HttpError(401, "انتهت الجلسة. سجّل الدخول مجدداً.");
  const origin = new URL(req.url).origin;
  const r = await fetch(`${origin}/.netlify/identity/user`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!r?.ok) throw new HttpError(401, "انتهت الجلسة. سجّل الدخول مجدداً.");
  const user = (await r.json()) as { email?: string; confirmed_at?: string };
  const userEmail = (user.email ?? "").toLowerCase();
  if (!userEmail || !user.confirmed_at) throw new HttpError(403, "يجب تأكيد البريد قبل الدخول.");
  let s = await loadSettings();
  if (!s.adminEmail) {
    // First confirmed account to sign in becomes the director; the director then sets the secretary's email.
    s = { ...s, adminEmail: userEmail };
    await saveSettings(s);
  }
  const role = userEmail === s.adminEmail.toLowerCase() ? "admin" : s.secretaryEmail && userEmail === s.secretaryEmail.toLowerCase() ? "secretary" : null;
  if (!role) throw new HttpError(403, "هذا الحساب غير معتمد لدخول الإدارة.");
  if (adminOnly && role !== "admin") throw new HttpError(403, "هذه العملية متاحة للمدير فقط.");
  return { email: userEmail, role };
}

// ---------- messaging (Brevo, optional) ----------
const brevoReady = (s: Settings) => ({
  sms: Boolean(process.env.BREVO_API_KEY && s.smsSender),
  whatsapp: Boolean(process.env.BREVO_API_KEY && s.whatsappSender && s.whatsappTemplateId),
});
async function sendVia(channel: "sms" | "whatsapp", s: Settings, student: StudentRow, body: string) {
  const ready = brevoReady(s);
  if (!ready[channel]) return channel === "sms" ? "لم يُرسل: خدمة SMS غير مهيأة بعد." : "لم يُرسل: واتساب الآلي غير مهيأ بعد.";
  const headers = { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", accept: "application/json" };
  const recipient = "967" + student.phone;
  const r = channel === "sms"
    ? await fetch("https://api.brevo.com/v3/transactionalSMS/sms", { method: "POST", headers, body: JSON.stringify({ sender: s.smsSender, recipient, content: body, type: "transactional" }) })
    : await fetch("https://api.brevo.com/v3/whatsapp/sendMessage", { method: "POST", headers, body: JSON.stringify({ senderNumber: s.whatsappSender.replace(/\D/g, ""), contactNumbers: [recipient], templateId: s.whatsappTemplateId, params: { name: student.name, message: body, student_id: student.id } }) });
  return r.ok ? "تم قبول الطلب لدى المزوّد." : `رفض المزوّد الطلب (${r.status}).`;
}

// ---------- router ----------
async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 200_000) throw new HttpError(413, "البيانات كبيرة جداً.");
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, "بيانات غير صالحة."); }
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const path = parts.join("/");
  const m = req.method;

  // ----- public -----
  if (path === "config" && m === "GET") return json(publicConfig(await loadSettings()));

  if (path === "register" && m === "POST") {
    const b = await body(req);
    if (b.website) throw new HttpError(400, "تعذّر إتمام التسجيل.");
    const name = str(b.name, 200, "الاسم");
    const phone = str(b.phone, 20, "رقم الهاتف").replace(/\D/g, "").replace(/^967/, "");
    if (!/^\d{9}$/.test(phone)) throw new HttpError(400, "رقم الهاتف يجب أن يكون 9 أرقام.");
    const studyType = str(b.studyType, 20, "نوع الدراسة");
    if (!["حضوري", "أونلاين"].includes(studyType)) throw new HttpError(400, "نوع الدراسة غير صحيح.");
    const s = await loadSettings();
    const c = allCourses(s).find((x) => x.id === b.courseId);
    if (!c) throw new HttpError(400, "اختر تخصصاً متاحاً.");
    const [row] = await db.insert(students).values({
      id: newStudentId(), name, phone, studyType, courseId: c.id, courseName: c.name, fee: c.fee, paid: 0,
      notes: str(b.notes, 3000, "الملاحظات", false), repeating: Boolean(b.repeating),
    }).returning();
    await db.insert(notices).values({ studentId: row.id, body: "تم استلام طلب تسجيلك في " + c.name + ". رقم الطالب: " + row.id });
    return json({ name: row.name, id: row.id, status: statusOf(row), fee: row.fee }, 201);
  }

  if (path === "lookup" && m === "POST") {
    const b = await body(req);
    const key = normalize(str(b.key, 200, "الاسم أو رقم الطالب"));
    const courseId = typeof b.courseId === "string" && b.courseId ? b.courseId : null;
    let rows: StudentRow[];
    if (/^jy-/i.test(key)) rows = await db.select().from(students).where(sql`lower(${students.id}) = ${key}`);
    else {
      if (key.split(" ").length < 3) throw new HttpError(400, "اكتب الاسم الثلاثي على الأقل أو رقم الطالب.");
      rows = await db.select().from(students).where(sql`lower(regexp_replace(${students.name}, '\\s+', ' ', 'g')) like ${key.replace(/[%_\\]/g, "\\$&") + "%"}`).limit(10);
    }
    if (courseId) rows = rows.filter((r) => r.courseId === courseId);
    const out = await Promise.all(rows.map(async (r) => {
      const n = await db.select({ body: notices.body, createdAt: notices.createdAt }).from(notices).where(eq(notices.studentId, r.id)).orderBy(desc(notices.createdAt)).limit(30);
      const v = view(r);
      return { id: v.id, name: v.name, course: v.course, status: v.status, fee: v.fee, paid: v.paid, remaining: v.remaining, result: v.result, notices: n };
    }));
    return json(out);
  }

  if (path === "result-request" && m === "POST") {
    const b = await body(req);
    const s = await getStudent(str(b.studentId, 40, "رقم الطالب"));
    if (s.result) return json({ message: "النتيجة متاحة بالفعل. حدّث الصفحة لعرضها." });
    const [open] = await db.select().from(inquiries).where(and(eq(inquiries.studentId, s.id), eq(inquiries.kind, "result"), isNull(inquiries.reply)));
    if (open) return json({ message: "طلبك قيد المراجعة لدى الإدارة." });
    await db.insert(inquiries).values({ id: newInquiryId(), kind: "result", name: s.name, body: `طلب نتيجة ${s.courseName} — ${s.id}`, studentId: s.id });
    return json({ message: "تم إرسال طلب النتيجة إلى الإدارة. يصلك إشعار عند نشرها." });
  }

  if (path === "inquiries" && m === "POST") {
    const b = await body(req);
    const [row] = await db.insert(inquiries).values({ id: newInquiryId(), kind: "inquiry", name: str(b.name, 200, "الاسم"), body: str(b.body, 2000, "الاستفسار") }).returning();
    return json({ id: row.id, message: "تم إرسال استفسارك إلى الإدارة." }, 201);
  }

  if (path === "inquiry-status" && m === "POST") {
    const b = await body(req);
    const [row] = await db.select().from(inquiries).where(eq(inquiries.id, str(b.id, 40, "رمز المتابعة").toUpperCase()));
    if (!row) throw new HttpError(404, "رمز المتابعة غير صحيح.");
    return json({ name: row.name, body: row.body, reply: row.reply });
  }

  // ----- staff -----
  if (parts[0] !== "staff") throw new HttpError(404, "المسار غير موجود.");
  const sub = parts.slice(1);
  const subPath = sub.join("/");

  if (subPath === "me" && m === "GET") return json(await requireStaff(req));

  if (subPath === "students" && m === "GET") {
    await requireStaff(req);
    return json((await db.select().from(students).orderBy(desc(students.createdAt))).map(view));
  }

  if (sub[0] === "students" && sub[1] && sub[2] === "history" && m === "GET") {
    await requireStaff(req);
    const rows = await db.select().from(paymentHistory).where(eq(paymentHistory.studentId, sub[1])).orderBy(desc(paymentHistory.createdAt));
    return json(rows);
  }

  if (sub[0] === "students" && sub[1] && sub[2] === "payment" && m === "PATCH") {
    const staff = await requireStaff(req);
    const b = await body(req);
    const s = await getStudent(sub[1]);
    if (Number(b.version) !== s.version) throw new HttpError(409, "عُدّل ملف الطالب من جهاز آخر. حدّث القائمة ثم أعد المحاولة.");
    const fee = money(b.fee, "الرسوم", true);
    const paid = money(b.paid, "المسدد", false)!;
    if (fee !== null && paid > fee) throw new HttpError(400, "المبلغ المسدد أكبر من إجمالي الرسوم.");
    const note = str(b.note, 1000, "الملاحظة");
    const [updated] = await db.update(students).set({ fee, paid, version: s.version + 1 }).where(and(eq(students.id, s.id), eq(students.version, s.version))).returning();
    if (!updated) throw new HttpError(409, "عُدّل ملف الطالب من جهاز آخر. حدّث القائمة ثم أعد المحاولة.");
    await db.insert(paymentHistory).values({ studentId: s.id, note, oldFee: s.fee, fee, oldPaid: s.paid, paid, staffEmail: staff.email });
    await db.insert(notices).values({ studentId: s.id, body: `تحديث الرسوم: الإجمالي ${fmt(fee)}، المسدد ${fmt(paid)}. ${note}` });
    return json(view(updated));
  }

  if (sub[0] === "students" && sub[1] && sub[2] === "result" && m === "PATCH") {
    await requireStaff(req, true);
    const b = await body(req);
    const s = await getStudent(sub[1]);
    const result = str(b.result, 3000, "النتيجة");
    await db.update(students).set({ result, version: s.version + 1 }).where(eq(students.id, s.id));
    await db.insert(notices).values({ studentId: s.id, body: "تم نشر نتيجتك. اختر «نتائج الدراسة» في الاستعلام لعرضها." });
    await db.update(inquiries).set({ reply: "تم نشر النتيجة. اعرضها من صفحة الاستعلام والنتائج.", repliedAt: new Date() }).where(and(eq(inquiries.studentId, s.id), eq(inquiries.kind, "result"), isNull(inquiries.reply)));
    return json({ ok: true });
  }

  if (subPath === "inquiries" && m === "GET") {
    await requireStaff(req, true);
    return json(await db.select().from(inquiries).orderBy(desc(inquiries.createdAt)).limit(300));
  }

  if (sub[0] === "inquiries" && sub[1] && m === "PATCH") {
    await requireStaff(req, true);
    const b = await body(req);
    const [row] = await db.update(inquiries).set({ reply: str(b.reply, 3000, "الرد"), repliedAt: new Date() }).where(eq(inquiries.id, sub[1])).returning();
    if (!row) throw new HttpError(404, "الاستفسار غير موجود.");
    return json({ ok: true });
  }

  if (subPath === "messages" && m === "POST") {
    await requireStaff(req, true);
    const b = await body(req);
    const text = str(b.body, 2000, "نص الرسالة");
    const ids = b.studentId ? [(await getStudent(String(b.studentId))).id] : (await db.select({ id: students.id }).from(students)).map((r) => r.id);
    if (ids.length) await db.insert(notices).values(ids.map((studentId) => ({ studentId, body: text })));
    return json({ count: ids.length });
  }

  if (subPath === "message-status" && m === "GET") {
    await requireStaff(req, true);
    return json(brevoReady(await loadSettings()));
  }

  if (subPath === "deliveries" && m === "GET") {
    await requireStaff(req, true);
    return json(await db.select().from(deliveries).orderBy(desc(deliveries.createdAt)).limit(100));
  }

  if (subPath === "automatic-message" && m === "POST") {
    await requireStaff(req, true);
    const b = await body(req);
    const student = await getStudent(str(b.studentId, 40, "الطالب"));
    const text = str(b.body, 2000, "نص الرسالة");
    const requestId = str(b.requestId, 100, "رقم الطلب");
    const channels: ("sms" | "whatsapp")[] = b.channel === "both" ? ["sms", "whatsapp"] : b.channel === "whatsapp" ? ["whatsapp"] : ["sms"];
    const s = await loadSettings();
    const results = [];
    for (const channel of channels) {
      const [claimed] = await db.insert(deliveries).values({ requestId, channel, studentId: student.id, body: text }).onConflictDoNothing().returning();
      if (!claimed) { results.push({ channel, detail: "أُرسل هذا الطلب سابقاً، لم يُكرر الإرسال." }); continue; }
      const detail = await sendVia(channel, s, student, text).catch(() => "تعذّر الاتصال بالمزوّد.");
      await db.update(deliveries).set({ detail }).where(eq(deliveries.id, claimed.id));
      results.push({ channel, detail });
    }
    await db.insert(notices).values({ studentId: student.id, body: text });
    return json({ results, message: "أُضيفت الرسالة أيضاً إلى إشعارات الطالب في الموقع." });
  }

  if (subPath === "settings" && m === "GET") {
    await requireStaff(req, true);
    return json(await loadSettings());
  }

  if (subPath === "settings" && m === "PUT") {
    await requireStaff(req, true);
    const b = await body(req);
    const cur = await loadSettings();
    const deps = Array.isArray(b.departments) ? b.departments : [];
    const departments: Department[] = deps.slice(0, 50).map((d: any) => ({
      id: typeof d?.id === "string" && d.id ? d.id.slice(0, 100) : randomUUID(),
      name: str(d?.name, 200, "اسم القسم"),
      description: str(d?.description, 2000, "وصف القسم", false),
      courses: (Array.isArray(d?.courses) ? d.courses : []).slice(0, 100).map((c: any) => ({
        id: typeof c?.id === "string" && c.id ? c.id.slice(0, 100) : randomUUID(),
        name: str(c?.name, 200, "اسم الدورة"),
        fee: money(c?.fee, "رسوم الدورة", true),
      })),
    }));
    const tpl = b.whatsappTemplateId === "" || b.whatsappTemplateId === null || b.whatsappTemplateId === undefined ? null : Number(b.whatsappTemplateId);
    const next: Settings = {
      ...cur,
      title: str(b.title, 1200, "العنوان"), intro: str(b.intro, 1200, "النص التعريفي"), aboutText: str(b.aboutText, 6000, "النبذة"),
      adminTitle: str(b.adminTitle, 1200, "عنوان الإدارة"), registrationIntro: str(b.registrationIntro, 1200, "إرشادات التسجيل"),
      primary: hex(b.primary, cur.primary), primaryDark: hex(b.primaryDark, cur.primaryDark), accent: hex(b.accent, cur.accent),
      background: hex(b.background, cur.background), textColor: hex(b.textColor, cur.textColor),
      gradientAngle: Math.min(360, Math.max(0, Number(b.gradientAngle) || 0)),
      hiddenSections: (Array.isArray(b.hiddenSections) ? b.hiddenSections : []).filter((x: unknown) => SECTIONS.includes(x as string)) as string[],
      departments,
      adminEmail: email(b.adminEmail), secretaryEmail: email(b.secretaryEmail),
      smsSender: str(b.smsSender, 15, "مرسل SMS"), whatsappSender: str(b.whatsappSender, 16, "رقم واتساب", false),
      whatsappTemplateId: tpl !== null && Number.isInteger(tpl) && tpl > 0 ? tpl : null,
    };
    await saveSettings(next);
    return json({ ok: true });
  }

  if (subPath === "export" && m === "GET") {
    await requireStaff(req, true);
    const rows = (await db.select().from(students).orderBy(desc(students.createdAt))).map(view);
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["رقم الطالب", "الاسم", "الهاتف", "نوع الدراسة", "التخصص", "إعادة دراسة", "الرسوم", "المسدد", "المتبقي", "الحالة", "النتيجة", "ملاحظات", "تاريخ التسجيل"];
    const lines = rows.map((s) => [s.id, s.name, s.phone, s.studyType, s.course, s.repeating ? "نعم" : "لا", s.fee ?? "", s.paid, s.remaining ?? "", s.status, s.result ?? "", s.notes, new Date(s.createdAt).toISOString()].map(cell).join(","));
    return new Response("﻿" + [header.map(cell).join(","), ...lines].join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="students.csv"', "Cache-Control": "no-store" },
    });
  }

  throw new HttpError(404, "المسار غير موجود.");
}

export default {
  async fetch(req: Request) {
    try {
      return await route(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "حدث خطأ في الخادم. حاول مجدداً." }, 500);
    }
  },
};
