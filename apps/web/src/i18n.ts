import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const STORAGE_KEY = "foodapp.lang";

const getInitialLang = (): "fa" | "en" => {
  const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (saved === "fa" || saved === "en") return saved;
  return "fa";
};

const resources = {
  en: {
    translation: {
      appTitle: "Food Events MVP",
      nav: {
        public: "Public",
        admin: "Admin"
      },
      language: {
        english: "English",
        farsi: "فارسی"
      },
      health: {
        label: "Backend health"
      },
      admin: {
        title: "Admin Dashboard",
        description: "Manage users, payors, menu items, and pricing.",
        loading: "Loading...",
        forbidden: "You do not have access.",
        logout: "Logout",
        nav: {
          users: "Users",
          templates: "Templates",
          events: "Events",
          participants: "Participants",
          categories: "Categories"
        },
        login: {
          title: "Admin Login",
          email: "Mobile phone",
          password: "Password",
          submit: "Login",
          submitting: "Logging in..."
        },
        users: {
          title: "Users",
          loading: "Loading users...",
          email: "Mobile phone",
          name: "Name",
          role: "Role",
          createdAt: "Created",
          createTitle: "Create User",
          password: "Password",
          create: "Create",
          creating: "Creating...",
          forbidden: "Only admins can create users.",
          walletTopupTitle: "Wallet top-up",
          walletTopupUser: "User",
          walletTopupAmount: "Amount (IRR)",
          walletTopupSubmit: "Top up",
          walletTopupSubmitting: "Topping up..."
        },
        templates: {
          title: "Event Templates",
          loading: "Loading templates...",
          name: "Name",
          defaultLocation: "Default location",
          create: "Create",
          manageRoster: "Default roster",
          detail: {
            title: "Template default roster",
            loading: "Loading...",
            guests: "Default guests",
            addGuest: "Add guest",
            remove: "Remove",
            participants: "Default participants",
            participant: "Participant",
            managingUser: "Managing user (can manage/choose)",
            defaultAttendance: "Default attendance",
            addParticipant: "Add participant"
          }
        },
        events: {
          title: "Events",
          loading: "Loading events...",
          template: "Template",
          name: "Name",
          location: "Location",
          host: "Host",
          startsDate: "Start date (Jalali)",
          startsTime: "Start time",
          cutoffDate: "Cutoff date (Jalali)",
          cutoffTime: "Cutoff time",
          state: "State",
          create: "Create",
          detail: {
            title: "Event",
            loading: "Loading event...",
            notFound: "Event not found",
            starts: "Starts",
            cutoff: "Cutoff",
            state: "State",
            changeState: "Change state",
            applyState: "Apply",
            stateDraft: "Draft",
            stateOpen: "Open",
            stateLocked: "Locked",
            stateCompleted: "Completed",
            invalidSchedule: "Invalid schedule: cutoff is after starts.",
            guests: "Guests",
            addGuest: "Add guest",
            remove: "Remove",
            menus: "Menus",
            menuNamePlaceholder: "Menu name",
            createMenu: "Create menu",
            manageItems: "Manage items",
            eventParticipants: "Event participants",
            participant: "Participant",
            managingUser: "Managing user (can manage/choose)",
            addParticipant: "Add participant",
            attendance: "Attendance",
            payorOverride: "Payor override (who pays)",
            clearOverride: "Clear override",
            manageSelections: "Manage selections",
            openEvent: "Open event",
            lockEvent: "Lock event",
            completeEvent: "Complete event",
            chargesPreview: "Charges preview",
            finalizedCharges: "Finalized charges",
            noCharges: "No charges",
            payor: "Payor",
            amount: "Amount",
            finalizedAt: "Finalized at"
          }
        },
        selections: {
          title: "Selections",
          loading: "Loading selections...",
          menuItem: "Menu item",
          quantity: "Quantity",
          allocateTo: "Allocate to participants",
          create: "Create selection",
          listTitle: "Existing selections",
          allocations: "Allocations",
          remove: "Remove"
        },
        participants: {
          title: "Participants",
          loading: "Loading participants...",
          owner: "Owner (account)",
          name: "Name",
          defaultPayor: "Default payor (who pays)",
          create: "Create"
        },
        menu: {
          title: "Menu items",
          loading: "Loading...",
          itemName: "Item name",
          priceIrr: "Price (IRR)",
          category: "Category",
          create: "Create"
        },
        categories: {
          title: "Menu item categories",
          loading: "Loading categories...",
          code: "Code",
          nameEn: "Name (EN)",
          nameFa: "Name (FA)",
          sortOrder: "Sort order",
          create: "Create"
        }
      },
      public: {
        title: "Public Pages",
        description: "Choose food items for events.",
        loading: "Loading...",
        login: {
          title: "Login",
          email: "Mobile phone",
          password: "Password",
          submit: "Login",
          submitting: "Logging in..."
        },
        events: {
          title: "My events",
          loading: "Loading events...",
          go: "Go to events",
          name: "Event",
          starts: "Starts",
          state: "State"
        },
        event: {
          loading: "Loading event...",
          notFound: "Event not found",
          back: "Back",
          starts: "Starts",
          cutoff: "Cutoff",
          state: "State",
          notOpen: "This event is not open for selections yet.",
          cutoffPassed: "The cutoff has passed. Selections are locked.",
          myParticipants: "My participants",
          attending: "Attending",
          tentative: "Tentative",
          declined: "Declined",
          noParticipants: "No participants",
          edit: "Edit",
          save: "Save",
          cancel: "Cancel",
          editQuantity: "Edit quantity",
          editAllocations: "Edit allocations",
          unmanagedAllocations: "Allocations you no longer manage (will be removed if you save)",
          createSelection: "Create selection",
          menuItem: "Menu item",
          quantity: "Quantity",
          allocateTo: "Allocate to",
          create: "Create",
          mySelections: "My selections",
          allocations: "Allocations",
          remove: "Remove",
          noSelections: "No selections yet"
        },
        payor: {
          title: "Payor",
          go: "Payor / Wallet",
          loading: "Loading...",
          backToEvents: "Back to events",
          walletTitle: "Wallet",
          balance: "Balance (IRR)",
          chargesTitle: "My charges",
          noCharges: "No charges",
          event: "Event",
          amount: "Amount (IRR)",
          eventState: "Event state",
          finalizedAt: "Finalized at",
          payment: "Payment",
          createPaymentLink: "Create payment link",
          linkOpen: "Link open",
          openLink: "Open link",
          copyLink: "Copy link",
          copied: "Copied",
          copyFailed: "Copy failed",
          payWithWallet: "Pay with wallet",
          voidLink: "Void link",
          transactionsTitle: "Wallet transactions",
          noTransactions: "No transactions",
          txType: "Type",
          txAmount: "Amount (IRR)",
          txEvent: "Event",
          txCreatedAt: "Created at"
        },
        pay: {
          title: "Payment",
          home: "Home",
          loading: "Loading...",
          notFound: "Payment link not found",
          event: "Event",
          amount: "Amount (IRR)",
          status: "Status",
          loginToPay: "Login to pay",
          payWithWallet: "Pay with wallet",
          voidLink: "Void link",
          goToPayor: "Go to payor page",
          statusPaid: "This link has been paid.",
          statusVoid: "This link has been voided."
        }
      }
    }
  },
  fa: {
    translation: {
      appTitle: "سامانه رویداد غذایی",
      nav: {
        public: "عمومی",
        admin: "ادمین"
      },
      language: {
        english: "English",
        farsi: "فارسی"
      },
      health: {
        label: "وضعیت سرور"
      },
      admin: {
        title: "داشبورد ادمین",
        description: "مدیریت کاربران، پرداخت‌کننده‌ها، آیتم‌های غذا و قیمت‌ها.",
        loading: "در حال بارگذاری...",
        forbidden: "شما دسترسی ندارید.",
        logout: "خروج",
        nav: {
          users: "کاربران",
          templates: "قالب‌ها",
          events: "رویدادها",
          participants: "شرکت‌کننده‌ها",
          categories: "دسته‌بندی‌ها"
        },
        login: {
          title: "ورود ادمین",
          email: "موبایل",
          password: "رمز عبور",
          submit: "ورود",
          submitting: "در حال ورود..."
        },
        users: {
          title: "کاربران",
          loading: "در حال بارگذاری کاربران...",
          email: "موبایل",
          name: "نام",
          role: "نقش",
          createdAt: "تاریخ ایجاد",
          createTitle: "ایجاد کاربر",
          password: "رمز عبور",
          create: "ایجاد",
          creating: "در حال ایجاد...",
          forbidden: "فقط ادمین می‌تواند کاربر ایجاد کند.",
          walletTopupTitle: "شارژ کیف پول",
          walletTopupUser: "کاربر",
          walletTopupAmount: "مبلغ (ریال)",
          walletTopupSubmit: "شارژ",
          walletTopupSubmitting: "در حال شارژ..."
        },
        templates: {
          title: "قالب‌های رویداد",
          loading: "در حال بارگذاری قالب‌ها...",
          name: "نام",
          defaultLocation: "مکان پیش‌فرض",
          create: "ایجاد",
          manageRoster: "لیست پیش‌فرض",
          detail: {
            title: "لیست پیش‌فرض قالب",
            loading: "در حال بارگذاری...",
            guests: "مهمان‌های پیش‌فرض",
            addGuest: "افزودن مهمان",
            remove: "حذف",
            participants: "شرکت‌کننده‌های پیش‌فرض",
            participant: "شرکت‌کننده",
            managingUser: "کاربر مدیریت‌کننده (انتخاب‌کننده)",
            defaultAttendance: "حضور پیش‌فرض",
            addParticipant: "افزودن شرکت‌کننده"
          }
        },
        events: {
          title: "رویدادها",
          loading: "در حال بارگذاری رویدادها...",
          template: "قالب",
          name: "نام",
          location: "مکان",
          host: "میزبان",
          startsDate: "تاریخ شروع (جلالی)",
          startsTime: "ساعت شروع",
          cutoffDate: "تاریخ پایان انتخاب (جلالی)",
          cutoffTime: "ساعت پایان انتخاب",
          state: "وضعیت",
          create: "ایجاد",
          detail: {
            title: "رویداد",
            loading: "در حال بارگذاری رویداد...",
            notFound: "رویداد پیدا نشد",
            starts: "شروع",
            cutoff: "پایان انتخاب",
            state: "وضعیت",
            changeState: "تغییر وضعیت",
            applyState: "اعمال",
            stateDraft: "پیش‌نویس",
            stateOpen: "باز",
            stateLocked: "قفل",
            stateCompleted: "تکمیل",
            invalidSchedule: "زمان‌بندی نامعتبر: پایان انتخاب بعد از شروع است.",
            guests: "مهمان‌ها",
            addGuest: "افزودن مهمان",
            remove: "حذف",
            menus: "منوها",
            menuNamePlaceholder: "نام منو",
            createMenu: "ایجاد منو",
            manageItems: "مدیریت آیتم‌ها",
            eventParticipants: "شرکت‌کننده‌های رویداد",
            participant: "شرکت‌کننده",
            managingUser: "کاربر مدیریت‌کننده (انتخاب‌کننده)",
            addParticipant: "افزودن شرکت‌کننده",
            attendance: "حضور",
            payorOverride: "پرداخت‌کننده جایگزین (پرداخت)",
            clearOverride: "حذف جایگزین",
            manageSelections: "مدیریت انتخاب‌ها",
            openEvent: "باز کردن رویداد",
            lockEvent: "قفل کردن رویداد",
            completeEvent: "تکمیل رویداد",
            chargesPreview: "پیش‌نمایش هزینه‌ها",
            finalizedCharges: "هزینه‌های نهایی",
            noCharges: "بدون هزینه",
            payor: "پرداخت‌کننده",
            amount: "مبلغ",
            finalizedAt: "زمان نهایی‌سازی"
          }
        },
        selections: {
          title: "انتخاب‌ها",
          loading: "در حال بارگذاری انتخاب‌ها...",
          menuItem: "آیتم منو",
          quantity: "تعداد",
          allocateTo: "تقسیم بین شرکت‌کننده‌ها",
          create: "ایجاد انتخاب",
          listTitle: "انتخاب‌های ثبت‌شده",
          allocations: "تقسیم",
          remove: "حذف"
        },
        participants: {
          title: "شرکت‌کننده‌ها",
          loading: "در حال بارگذاری شرکت‌کننده‌ها...",
          owner: "مالک (حساب کاربری)",
          name: "نام",
          defaultPayor: "پرداخت‌کننده پیش‌فرض (پرداخت)",
          create: "ایجاد"
        },
        menu: {
          title: "آیتم‌های منو",
          loading: "در حال بارگذاری...",
          itemName: "نام آیتم",
          priceIrr: "قیمت (ریال)",
          category: "دسته‌بندی",
          create: "ایجاد"
        },
        categories: {
          title: "دسته‌بندی آیتم‌های منو",
          loading: "در حال بارگذاری دسته‌بندی‌ها...",
          code: "کد",
          nameEn: "نام (انگلیسی)",
          nameFa: "نام (فارسی)",
          sortOrder: "ترتیب",
          create: "ایجاد"
        }
      },
      public: {
        title: "صفحات عمومی",
        description: "انتخاب آیتم‌های غذایی برای رویدادها.",
        loading: "در حال بارگذاری...",
        login: {
          title: "ورود",
          email: "موبایل",
          password: "رمز عبور",
          submit: "ورود",
          submitting: "در حال ورود..."
        },
        events: {
          title: "رویدادهای من",
          loading: "در حال بارگذاری رویدادها...",
          go: "رفتن به رویدادها",
          name: "رویداد",
          starts: "شروع",
          state: "وضعیت"
        },
        event: {
          loading: "در حال بارگذاری رویداد...",
          notFound: "رویداد پیدا نشد",
          back: "بازگشت",
          starts: "شروع",
          cutoff: "پایان انتخاب",
          state: "وضعیت",
          notOpen: "این رویداد هنوز برای انتخاب باز نشده است.",
          cutoffPassed: "زمان پایان انتخاب گذشته است و انتخاب‌ها قفل شده‌اند.",
          myParticipants: "شرکت‌کننده‌های من",
          attending: "حاضر",
          tentative: "نامشخص",
          declined: "غایب",
          noParticipants: "بدون شرکت‌کننده",
          edit: "ویرایش",
          save: "ذخیره",
          cancel: "لغو",
          editQuantity: "ویرایش تعداد",
          editAllocations: "ویرایش تقسیم",
          unmanagedAllocations: "تقسیم‌هایی که دیگر مدیریت نمی‌کنید (در صورت ذخیره حذف می‌شوند)",
          createSelection: "ایجاد انتخاب",
          menuItem: "آیتم منو",
          quantity: "تعداد",
          allocateTo: "تقسیم بین",
          create: "ایجاد",
          mySelections: "انتخاب‌های من",
          allocations: "تقسیم",
          remove: "حذف",
          noSelections: "هنوز انتخابی ثبت نشده"
        },
        payor: {
          title: "پرداخت کننده",
          go: "کیف پول / پرداخت",
          loading: "در حال بارگذاری...",
          backToEvents: "بازگشت به رویدادها",
          walletTitle: "کیف پول",
          balance: "موجودی (ریال)",
          chargesTitle: "هزینه های من",
          noCharges: "بدون هزینه",
          event: "رویداد",
          amount: "مبلغ (ریال)",
          eventState: "وضعیت رویداد",
          finalizedAt: "زمان نهایی سازی",
          payment: "پرداخت",
          createPaymentLink: "ایجاد لینک پرداخت",
          linkOpen: "لینک فعال",
          openLink: "باز کردن لینک",
          voidLink: "باطل کردن لینک",
          copyLink: "کپی لینک",
          copied: "کپی شد",
          copyFailed: "کپی انجام نشد",
          payWithWallet: "پرداخت از کیف پول",
          transactionsTitle: "تراکنش های کیف پول",
          noTransactions: "بدون تراکنش",
          txType: "نوع",
          txAmount: "مبلغ (ریال)",
          txEvent: "رویداد",
          txCreatedAt: "زمان"
        },
        pay: {
          title: "پرداخت",
          home: "خانه",
          loading: "در حال بارگذاری...",
          notFound: "لینک پرداخت پیدا نشد",
          event: "رویداد",
          amount: "مبلغ (ریال)",
          status: "وضعیت",
          loginToPay: "برای پرداخت وارد شوید",
          payWithWallet: "پرداخت از کیف پول",
          voidLink: "باطل کردن لینک",
          goToPayor: "رفتن به صفحه پرداخت‌کننده",
          statusPaid: "این لینک پرداخت شده است.",
          statusVoid: "این لینک باطل شده است."
        }
      }
    }
  }
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLang(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
