<div dir="rtl">

# تستر VPN ویندسکرایب

**[English / انگلیسی](README.md)**

ابزار خودکار برای تست تمام ترکیب‌های **لوکیشن × پروتکل:پورت** روی VPN ویندسکرایب. این ابزار گزارش می‌دهد کدام ترکیب‌ها کار می‌کنند و اطلاعاتی از جمله تاخیر (latency) و زمان اتصال را ارائه می‌دهد. مناسب برای پیدا کردن سریع‌ترین و پایدارترین تنظیمات VPN برای شبکه شما.

قابل استفاده روی **macOS** و **Windows**.

## شروع سریع (حالت آسان)

نمی‌خواهید با دستورات خط فرمان سر و کار داشته باشید؟ کافیست از اسکریپت‌های اجرا استفاده کنید — همه چیز را بررسی می‌کنند و با یک منوی ساده راهنمایی‌تان می‌کنند.

### مک / لینوکس

<div dir="ltr">

```bash
git clone https://github.com/KianooshSoleimani/windscribe-vpn-tester.git
cd windscribe-vpn-tester
./run.sh
```

</div>

### ویندوز

<div dir="ltr">

```powershell
git clone https://github.com/KianooshSoleimani/windscribe-vpn-tester.git
cd windscribe-vpn-tester
run.bat
```

</div>

اسکریپت این کارها را انجام می‌دهد:
1. بررسی نصب بودن Node.js (و نسخه صحیح آن)
2. بررسی نصب و اجرا بودن ویندسکرایب
3. نصب خودکار وابستگی‌ها (dependencies)
4. نمایش یک منوی ساده برای انتخاب نوع تست

## نحوه کار

اسکریپت روی تمام لوکیشن‌های سرور ویندسکرایب و ترکیب‌های پروتکل/پورت حلقه می‌زند، از طریق `windscribe-cli` متصل می‌شود، اتصال را بررسی می‌کند، تاخیر را اندازه‌گیری می‌کند و نتایج را در فایل‌های JSON و CSV ذخیره می‌کند.

## پیش‌نیازها

### هر دو پلتفرم

- **Node.js نسخه ۱۸ به بالا** — [دانلود](https://nodejs.org/)
- **اپلیکیشن دسکتاپ ویندسکرایب** — [دانلود](https://windscribe.com/download)
  - باید **نصب**، **در حال اجرا** و **لاگین شده** باشد

### مک (macOS)

۱. ویندسکرایب را از [سایت رسمی](https://windscribe.com/download) یا از طریق Homebrew نصب کنید:

<div dir="ltr">

```bash
brew install --cask windscribe
```

</div>

۲. مطمئن شوید `windscribe-cli` در دسترس است:

<div dir="ltr">

```bash
windscribe-cli status
```

</div>

اگر دستور پیدا نشد، CLI داخل اپلیکیشن قرار دارد. باید آن را به PATH اضافه کنید:

<div dir="ltr">

```bash
export PATH="/Applications/Windscribe.app/Contents/Helpers:$PATH"
```

</div>

یا یک symlink بسازید:

<div dir="ltr">

```bash
sudo ln -s /Applications/Windscribe.app/Contents/Helpers/windscribe-cli /usr/local/bin/windscribe-cli
```

</div>

### ویندوز (Windows)

۱. ویندسکرایب را از [سایت رسمی](https://windscribe.com/download) نصب کنید.

۲. نصب‌کننده `windscribe-cli.exe` را به سیستم اضافه می‌کند. بررسی کنید که کار می‌کند:

<div dir="ltr">

```powershell
windscribe-cli.exe status
```

</div>

اگر دستور پیدا نشد، مسیر نصب ویندسکرایب را به PATH اضافه کنید. مسیر پیش‌فرض:

<div dir="ltr">

```
C:\Program Files\Windscribe\
```

</div>

برای اضافه کردن موقت به PATH در PowerShell:

<div dir="ltr">

```powershell
$env:PATH += ";C:\Program Files\Windscribe"
```

</div>

یا به صورت دائمی از مسیر **Settings > System > About > Advanced system settings > Environment Variables** اضافه کنید.

## نصب

<div dir="ltr">

```bash
git clone https://github.com/KianooshSoleimani/windscribe-vpn-tester.git
cd windscribe-vpn-tester
npm install
```

</div>

این دستور تنها وابستگی پروژه یعنی [`p-limit`](https://www.npmjs.com/package/p-limit) (محدودکننده همزمانی) را نصب می‌کند.

## استفاده

<div dir="ltr">

```bash
node windscribe-tester.mjs [options]
```

</div>

### گزینه‌ها

| پرچم | توضیح | پیش‌فرض |
|------|-------|---------|
| `--protocols <list>` | پروتکل‌ها جدا شده با کاما | همه |
| `--ports <list>` | پورت‌ها جدا شده با کاما | همه |
| `--continents <list>` | قاره‌ها جدا شده با کاما | همه |
| `-h, --help` | نمایش راهنما | — |

### پروتکل‌های موجود

| پروتکل | پورت‌ها |
|---------|---------|
| `wireguard` | 443, 80, 53, 123, 1194, 65142 |
| `udp` | 443, 80, 53, 123, 1194, 54783 |
| `tcp` | 443, 587, 21, 22, 80, 123, 3306, 8080, 54783, 1194 |
| `wstunnel` | 443 |
| `stealth` | 443, 587, 21, 22, 80, 123, 3306, 8080, 54783, 8443 |
| `ikev2` | 500 |

### قاره‌های موجود

`asia` (آسیا)، `europe` (اروپا)، `north america` (آمریکای شمالی)، `south america` (آمریکای جنوبی)، `oceania` (اقیانوسیه)، `africa` (آفریقا)، `antarctica` (قطب جنوب)

## مثال‌ها

<div dir="ltr">

```bash
# اجرای تمام تست‌ها (بدون فیلتر)
node windscribe-tester.mjs

# فقط WireGuard، پورت ۸۰، لوکیشن‌های آسیا
node windscribe-tester.mjs --protocols wireguard --ports 80 --continents asia

# WireGuard روی پورت‌های ۸۰ و ۴۴۳
node windscribe-tester.mjs --protocols wireguard --ports 80,443

# چند پروتکل، یک پورت
node windscribe-tester.mjs --protocols wireguard,udp --ports 80

# همه پروتکل‌ها، فقط اروپا
node windscribe-tester.mjs --continents europe

# قاره‌هایی با فاصله در نام
node windscribe-tester.mjs --continents "north america,south america"

# پروتکل Stealth، آسیا و اروپا
node windscribe-tester.mjs --protocols stealth --continents asia,europe

# فقط IKEv2 (فقط پورت ۵۰۰)
node windscribe-tester.mjs --protocols ikev2

# همه پروتکل‌ها روی پورت‌های ۴۴۳ و ۸۰
node windscribe-tester.mjs --ports 443,80
```

</div>

## خروجی

نتایج به صورت خودکار در فایل‌های زیر ذخیره می‌شوند:

- **`results.json`** — نتایج کامل با تمام فیلدها
- **`results.csv`** — فرمت جدولی برای اسپردشیت‌ها

فایل‌ها هر ۱۰ تست و همچنین در پایان ذخیره می‌شوند. اگر با `Ctrl+C` متوقف کنید، نتایج جزئی قبل از خروج ذخیره می‌شوند.

### فیلدهای خروجی

| فیلد | توضیح |
|------|-------|
| `timestamp` | زمان تست (ISO 8601) |
| `location` | نام لوکیشن سرور ویندسکرایب |
| `country_code` | کد دو حرفی کشور |
| `continent` | قاره سرور |
| `protocol` | پروتکل استفاده شده |
| `port` | شماره پورت |
| `premium_only` | آیا لوکیشن فقط برای اکانت پولی است |
| `success` | آیا اتصال موفق بود |
| `public_ip` | آدرس IP عمومی هنگام اتصال |
| `latency_ms` | تاخیر پینگ به 1.1.1.1 (میلی‌ثانیه) |
| `connect_time_ms` | زمان برقراری اتصال (میلی‌ثانیه) |
| `error_message` | توضیح خطا در صورت عدم موفقیت |

### خلاصه ترمینال

پس از اتمام تمام تست‌ها، یک خلاصه نمایش داده می‌شود شامل:

- تعداد کل / موفق / ناموفق تست‌ها
- درصد موفقیت
- سریع‌ترین ترکیب پروتکل:پورت
- سریع‌ترین لوکیشن
- میانگین تاخیر بر اساس پروتکل:پورت
- ۵ لوکیشن سریع‌تر

## به‌روزرسانی لوکیشن‌ها

فایل `windscribe-locations.json` شامل لیست سرورها است. برای به‌روزرسانی با آخرین لوکیشن‌های ویندسکرایب، محتوای فایل را با داده‌های جدید از API ویندسکرایب یا خروجی اپلیکیشن جایگزین کنید.

## نکات

- اسکریپت به صورت ترتیبی متصل و قطع می‌شود (یک تانل در هر لحظه) زیرا `windscribe-cli` فقط یک اتصال فعال را پشتیبانی می‌کند.
- هر تست ۳۰ ثانیه زمان اتصال دارد.
- مطمئن شوید هیچ VPN دیگری قبل از اجرای اسکریپت فعال نباشد.
- اکانت‌های رایگان ویندسکرایب فقط می‌توانند به لوکیشن‌های غیر پولی متصل شوند. لوکیشن‌های پولی بدون اشتراک فعال با خطا مواجه می‌شوند.

## لایسنس

این پروژه تحت لایسنس MIT منتشر شده است — برای جزئیات فایل [LICENSE](LICENSE) را ببینید.

</div>
