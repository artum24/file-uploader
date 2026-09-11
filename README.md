# File Uploader

Приватне файлове сховище (family Dropbox): Next.js + Auth.js (Google login) +
приватний AWS S3, доступ лише для дозволених email-акаунтів.

## Можливості

- Вхід лише через Google, лише для email з whitelist (`ALLOWED_EMAILS`) —
  перевіряється на сервері, а не тільки в інтерфейсі.
- Особистий простір (`users/<ваш-slug>/...`) і спільний (`shared/...`).
- Папки з навігацією: створення папок, breadcrumbs, upload напряму у
  поточну папку.
- Upload напряму в S3 через короткоживучий presigned URL (файл не проходить
  через сервер додатку).
- Список файлів і папок у вигляді таблиці (Назва / Розмір / Дата / Дії) з
  іконками за типом файлу та сортуванням по кожній колонці (клік на
  заголовок, за замовчуванням — за датою, нові зверху).
- Preview прямо в застосунку (клік по рядку або кнопка 👁️): зображення,
  PDF, відео, аудіо — відтворюються інлайн; `.txt`/`.csv` показуються
  текстом; інші типи — повідомлення "непідтримувано" з кнопкою Download.
- Download (форсоване скачування, коректно навіть з кириличними іменами).
- Delete файлу і рекурсивне видалення папки (разом з усім вмістом), обидва
  з підтвердженням у модальному вікні (без нативних `confirm`/`prompt`).
- Обмеження на upload: максимум 200 MB, дозволені лише певні типи файлів
  (документи, зображення, відео/аудіо, архіви) — перевіряється і на
  клієнті (миттєвий фідбек), і на сервері.

## Запуск локально

1. Встановити залежності (native-модулі Next.js платформозалежні, тому
   `npm install` треба виконати саме тут, на macOS, а не десь ще):

   ```bash
   npm install
   ```

2. Скопіювати `.env.example` у `.env.local` і заповнити значення (детальніше
   нижче):

   ```bash
   cp .env.example .env.local
   ```

3. Отримати Google OAuth credentials:

   - [Google Cloud Console](https://console.cloud.google.com/) → створити
     проєкт (або обрати існуючий).
   - APIs & Services → OAuth consent screen → налаштувати (External, додати
     себе й дружину як test users, якщо застосунок не проходитиме
     верифікацію Google).
   - APIs & Services → Credentials → Create Credentials → OAuth client ID →
     тип **Web application**.
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Скопіювати Client ID / Client Secret у `AUTH_GOOGLE_ID` /
     `AUTH_GOOGLE_SECRET`.

4. Згенерувати `AUTH_SECRET`:

   ```bash
   openssl rand -base64 32
   ```

5. Вписати у `ALLOWED_EMAILS` через кому email-адреси, яким дозволено вхід
   (наприклад, свою і дружини) — саме ці акаунти потім треба буде додати як
   test users на кроці 3, поки застосунок не пройшов верифікацію Google.

6. Створити приватний S3 bucket (AWS Console → S3 → Create bucket):

   - Ім'я — глобально унікальне, тільки малі латинські літери/цифри/дефіси.
   - Block all public access — залишити увімкненим (за замовчуванням).
   - Default encryption — увімкнути (SSE-S3 достатньо для старту).
   - Регіон — будь-який зручний (наприклад `eu-north-1`, Стокгольм — ближче
     до України), вписати у `AWS_REGION`.

7. Налаштувати CORS на бакеті (Permissions tab → Cross-origin resource
   sharing → Edit), інакше браузер не зможе завантажувати файли напряму:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedOrigins": ["http://localhost:3000"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

   Коли зʼявиться реальний домен для продакшену — додати його в
   `AllowedOrigins` (масив, можна кілька значень).

8. Створити IAM-користувача з мінімальними правами лише на цей bucket. IAM →
   Users → Create user → Add permissions → Create inline policy → JSON
   (замінити `YOUR-BUCKET-NAME` на реальну назву):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```

   Зверніть увагу: перший блок — ARN самого bucket (без `/*`), для
   `ListBucket`; другий — ARN з `/*`, для операцій над обʼєктами. Це
   найчастіша причина `403 AccessDenied`, якщо переплутати.

   Потім Security credentials → Create access key → скопіювати Access
   Key ID / Secret Access Key у `.env.local`. **Не** використовувати root
   AWS credentials.

9. Запустити dev-сервер:

   ```bash
   npm run dev
   ```

   Відкрити [http://localhost:3000](http://localhost:3000) — має
   редіректнути на `/login`.

## Структура проєкту

```text
src/
  app/
    login/page.tsx                    — сторінка логіну (кнопка Google)
    dashboard/page.tsx                 — захищена сторінка зі списком файлів
    api/
      auth/[...nextauth]/route.ts      — Auth.js route handler
      files/
        upload-url/route.ts            — presigned PUT URL
        list/route.ts                  — список файлів і папок у поточному
                                          шляху (ListObjectsV2 + Delimiter)
        download-url/route.ts          — presigned GET URL (inline/attachment)
        delete/route.ts                — видалення одного файлу
        delete-folder/route.ts         — рекурсивне видалення папки і
                                          всього її вмісту
        create-folder/route.ts         — створення "папки" (zero-byte marker)
    layout.tsx, page.tsx, globals.css
  components/
    UploadButton.tsx                   — файл-пікер → presigned PUT
    ScopeSection.tsx                   — секція "Мої файли"/"Спільні файли":
                                          таблиця, сортування, breadcrumbs,
                                          створення папок, дії над рядками
    ConfirmDialog.tsx                  — модалка підтвердження (delete)
    PreviewModal.tsx                   — інлайн-перегляд файлу в модалці
  auth.ts                              — Auth.js: Google provider + whitelist
  middleware.ts                        — захист /dashboard/*
  lib/
    access.ts                         — схема S3-ключів, sanitize + перевірка
                                          доступу до ключа/шляху
    s3.ts                              — S3-клієнт, presigned URL-и,
                                          createFolder/deleteFolder
    upload-limits.ts                   — ліміт розміру + дозволені розширення
```

## Безпека (зроблено / пам'ятати надалі)

- `.env*` файли в `.gitignore` — реальні секрети ніколи не комітяться.
- AWS credentials використовуються лише на сервері (`src/lib/s3.ts` не
  імпортується з клієнтських компонентів).
- Whitelist перевіряється на бекенді (`signIn` callback), а не лише в UI.
- Кожен API-роут для файлів і папок (`upload-url`, `list`, `download-url`,
  `delete`, `delete-folder`, `create-folder`) окремо перевіряє сесію і
  належність ключа/шляху до `users/<ви>/` або `shared/` — не можна
  отримати доступ до чужого особистого файлу чи папки навіть знаючи її
  назву.
- Всі шляхи й імена (файлів, папок) проходять через `sanitizeName`/
  `sanitizePath` (`src/lib/access.ts`) — захист від path traversal (`..`,
  керуючі символи тощо).
- Bucket має бути приватним (Block Public Access + encryption) — це
  налаштування самого AWS, Next.js-код цього не гарантує.

## Відомі застереження

- `npm audit` показує кілька high-severity CVE для гілки Next.js 14.x
  (переважно DoS / cache-poisoning сценарії в App Router/Server
  Components) — для приватного застосунку на 2 користувачі ризик низький,
  але варто періодично оновлювати залежності (`npm outdated`, `npm audit`).
- Ліміт розміру (200 MB, `src/lib/upload-limits.ts`) перевіряється на
  клієнті й на сервері за заявленим розміром файлу — це не жорстка гарантія
  на боці S3 (presigned PUT, на відміну від presigned POST з
  `content-length-range`, не блокує сам S3 від прийому більшого файлу).
  Для типового домашнього використання цього достатньо.
- Видалення папки видаляє все безповоротно і одразу (немає "кошика"/
  recycle bin) — модалка підтвердження це чітко попереджає.
- Якщо після оновлення коду браузер показує застарілу поведінку/помилку —
  спершу перезапустити `npm run dev` (Ctrl+C → знову) і зробити hard
  refresh (Cmd+Shift+R), а вже потім шукати баг у коді.
