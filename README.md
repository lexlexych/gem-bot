# VelvetDistrict (Next.js)

Шаблон карточки товара для встраивания в Gemini canvas через `<iframe>`.

## Запуск

```sh
npm install
npm run dev
```

Откройте http://localhost:3000

## Query params (Gemini)

Короткое и длинное описание можно подставить через URL:

```
http://localhost:3000/?short=Куртка&long=Тёплая+зимняя+куртка
```

- `short` → значение поля «Короткое описание»
- `long` → значение `<textarea>` «Длинное описание»

Цена и фото добавляются вручную пользователем.

## Деплой

```sh
npx vercel
```

## Headers (`next.config.mjs`)

Все политики ослаблены для embed:

- `Content-Security-Policy: frame-ancestors *` — разрешён embed с любого origin
- `Access-Control-Allow-Origin: *` — открытый CORS
- `Permissions-Policy: clipboard-read=*, clipboard-write=*` — clipboard API в iframe
- `X-Frame-Options` — не выставляется (Next.js по умолчанию не добавляет)

## Build

```sh
npm run build
npm run start
```
