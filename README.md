# A-Store

A-Store - пример статического каталога супермаркета. Сайт берет товары и цены из опубликованной Google Таблицы, показывает весовые и штучные товары, собирает корзину и отправляет готовый текст заказа в WhatsApp.

## Что внутри

- `index.html` - разметка каталога, корзины и нижней навигации.
- `style.css` - новый дизайн A-Store в апельсиновой палитре.
- `app.js` - загрузка CSV из Google Sheets, парсинг товаров, корзина, кеш и WhatsApp.
- `.github/workflows/pages.yml` - деплой статического сайта на GitHub Pages.
- `DEPLOY.md` - правила обновления и деплоя.

Папка `old/` нужна только как временный источник старой логики и исключена из Git через `.gitignore`.

## Таблица товаров

Сайт читает опубликованный CSV:

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vT2mxltvHlBrpAfIHJ5g9XEfRxmQckITPgY_muXeiL-pQtdSC5g0tWUkHo0iMB_FVRGz8ntdJ8rbm_E/pub?output=csv
```

Ожидаемые колонки:

```text
id,name,unit,category,availability,price,sale,emoji
```

Правила:

- `unit`: `кг` для весовых товаров, `шт` для штучных.
- Весовые товары добавляются шагом `0.1 кг`.
- Штучные товары добавляются шагом `1 шт`.
- `availability`: `in stock` показывает товар, `out of stock` скрывает.
- `sale`: `yes` включает бейдж акции, `no` выключает.
- `emoji`: необязательная иконка товара.

## WhatsApp

Кнопка WhatsApp формирует сообщение с началом:

```text
Заказ на сайте A-Store.
```

Номер задается в `app.js` в константе `WHATSAPP_PHONE`.
