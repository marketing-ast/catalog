const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const photosRoot = path.join(projectRoot, "photoscat");
const outputPath = path.join(projectRoot, "catalog_generated.tsv");
const rootFolderId = "1H0NQcHaQ4qSQBkIaiMhtnRW5o-O7wr3E";

const rubrics = new Map([
    ["Бакалея", 11],
    ["Гастрономия", 12],
    ["Заморозка", 13],
    ["Кондитерские", 14],
    ["Молочные", 15],
    ["Напитки Без Алк", 16],
    ["Овощи и фрукты", 17],
    ["Снеки", 18],
    ["Хлобобулочные", 19],
    ["Чай и Кофе", 20],
]);

const typeAliases = new Map(Object.entries({
    "паста": "Паста",
    "крупа": "Крупа",
    "sauce": "Соус",
    "соус": "Соус",
    "агар": "Агар",
    "загуститель": "Загуститель",
    "зажарка": "Зажарка",
    "заправка": "Заправка",
    "лапша": "Лапша",
    "бедро": "Бедро",
    "бекон": "Бекон",
    "ветчина": "Ветчина",
    "колбаса": "Колбаса",
    "сыр": "Сыр",
    "вареники": "Вареники",
    "голубцы": "Голубцы",
    "горбуша": "Горбуша",
    "грибы": "Грибы",
    "грибочки": "Грибочки",
    "донат": "Донат",
    "медальоны": "Медальоны",
    "мини-филе": "Мини-филе",
    "мороженое": "Мороженое",
    "мороженное": "Мороженое",
    "мороежное": "Мороженое",
    "батончик": "Батончик",
    "драже": "Драже",
    "айран": "Айран",
    "биойогурт": "Биойогурт",
    "йогурт": "Йогурт",
    "вода": "Вода",
    "квас": "Квас",
    "напиток": "Напиток",
    "овощ": "Овощ",
    "фрукт": "Фрукт",
    "ягода": "Ягода",
    "кукурузные": "Кукурузные палочки",
    "морские": "Морские анчоусы",
    "сухарики": "Сухарики",
    "чипсы": "Чипсы",
    "батон": "Батон",
    "булка": "Булка",
    "хлеб": "Хлеб",
    "чай": "Чай",
    "кофе": "Кофе",
}));

const stopWords = new Set(
    "пак пакет п пп ф фп пл пласт бут бутылка б кор коробка т д ст стак лоток конт контейнер чашка ведро подложка в у вак с м ж гр i.m.l flow флоу молотый молтотый растворимый растворимом".split(" "),
);
const preservedWords = new Set(["3в1", "a'su", "m&m's"]);

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => resolve(data));
        }).on("error", reject);
    });
}

function decodeHtml(value) {
    return value
        .replaceAll("&quot;", "\"")
        .replaceAll("&#39;", "'")
        .replaceAll("&amp;", "&")
        .replaceAll("&nbsp;", " ")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">");
}

function parseEmbeddedFolder(html) {
    const files = [];
    const linkPattern = /href="https:\/\/drive\.google\.com\/(?:file\/d\/|drive\/folders\/)([^\/"?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    for (const match of html.matchAll(linkPattern)) {
        const title = decodeHtml(match[2].replace(/<[^>]+>/g, "").trim());
        if (title) files.push({ id: match[1], title });
    }
    return files;
}

function hashText(value) {
    let hash = 2166136261;
    for (const char of value) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function randomizePrice(price, key) {
    const hash = hashText(key);
    const delta = 10 + (hash % 91);
    let next = price + ((hash & 1) ? delta : -delta);
    if (next < 50) next = price + delta;
    if (next % 10 === 0 || next % 10 === 5) next += 3;
    return next;
}

function capitalizeWord(word) {
    const lower = word.toLocaleLowerCase("ru-RU");
    if (preservedWords.has(lower)) return word;
    if (/^[a-z0-9&'.-]+$/i.test(word)) {
        return lower
            .split(/([-'.])/)
            .map((part) => (/^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
            .join("");
    }
    return lower.replace(/^./u, (char) => char.toLocaleUpperCase("ru-RU"));
}

function normalizeMeasure(value) {
    return value
        .replace(/(\d+(?:[,.]\d+)?)\s*(гр|г)\.?/i, (_, amount) => `${amount.replace(",", ".")}гр`)
        .replace(/(\d+(?:[,.]\d+)?)\s*мл\.?/i, (_, amount) => `${amount.replace(",", ".")}мл`)
        .replace(/(\d+(?:[,.]\d+)?)\s*л\.?/i, (_, amount) => `${amount.replace(",", ".")}л`)
        .replace(/(\d+)\s*шт\.?/i, (_, amount) => `${amount}шт`)
        .replace(/(\d+)\s*пак\.?/i, (_, amount) => `${amount}пак`);
}

function extractMeasure(value) {
    const matches = [...value.matchAll(/(?<![\p{L}\p{N}])\d+(?:[,.]\d+)?\s*(?:гр|г|мл|л|шт|пак)\.?(?![\p{L}\p{N}])/giu)]
        .map((match) => normalizeMeasure(match[0]));
    return matches.at(-1) || "";
}

function findType(tokens) {
    for (const token of tokens) {
        const key = token.toLocaleLowerCase("ru-RU").replace(/[.,]/g, "");
        if (typeAliases.has(key)) return typeAliases.get(key);
    }
    return capitalizeWord(tokens[0] || "Товар");
}

function cleanProductName(fileName) {
    const stem = fileName.replace(/\.[^.]+$/, "");
    const priceMatch = stem.match(/-\s*(\d+)\s*тг\s*$/iu);
    const rawPrice = priceMatch ? Number(priceMatch[1]) : 0;
    let base = stem
        .replace(/-\s*\d+\s*тг\s*$/iu, "")
        .replace(/C(?=ЫР)/g, "С")
        .replace(/([A-Z])([А-ЯЁ])/g, "$1 $2")
        .replace(/([а-яё])([A-Z])/g, "$1 $2")
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const unit = /(?:^|\s)(вес|кг)(?:\s|$)/iu.test(base) ? "кг" : "шт";
    const measure = extractMeasure(base);
    base = base.replace(/(?<![\p{L}\p{N}])(?:вес|кг|шт)(?![\p{L}\p{N}])/giu, " ");
    const tokens = base
        .split(/\s+/)
        .map((token) => token.replace(/[()]/g, "").replace(/[.,]+$/g, ""))
        .filter(Boolean);
    const type = findType(tokens);
    const typeStart = type.toLocaleLowerCase("ru-RU").split(" ")[0];
    const seen = new Set();
    const rest = tokens
        .filter((token) => {
            const key = token.toLocaleLowerCase("ru-RU").replace(/[.,]/g, "");
            if (["вес", "кг", "шт"].includes(key)) return false;
            if (typeAliases.get(key)?.toLocaleLowerCase("ru-RU").startsWith(typeStart)) return false;
            if (stopWords.has(key)) return false;
            if (/^\d+(?:[,.]\d+)?(?:гр|г|мл|л|шт|пак)?$/iu.test(key)) return false;
            if (/^\d+%$/.test(key)) return false;
            return true;
        })
        .map(capitalizeWord)
        .filter((word) => {
            const key = word.toLocaleLowerCase("ru-RU");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 5);

    const title = `${type} - ${rest.join(" ")}${measure ? ` ${measure}` : ""}`
        .replace(/\s+/g, " ")
        .trim();
    return { title, rawPrice, unit };
}

function cleanCell(value) {
    return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

async function buildImageMap(categories) {
    const rootHtml = await fetchText(`https://drive.google.com/embeddedfolderview?id=${rootFolderId}#list`);
    const driveFolders = new Map(parseEmbeddedFolder(rootHtml).map((item) => [item.title, item.id]));
    const imageByKey = new Map();

    for (const category of categories) {
        const folderId = driveFolders.get(category);
        if (!folderId) throw new Error(`Drive folder is missing for category: ${category}`);
        const html = await fetchText(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`);
        for (const item of parseEmbeddedFolder(html)) {
            imageByKey.set(`${category}/${item.title}`, item.id);
        }
    }

    return imageByKey;
}

async function main() {
    const categories = fs.readdirSync(photosRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    const imageByKey = await buildImageMap(categories);
    const rows = [["id", "name", "unit", "category", "availability", "price", "sale", "emoji", "image"]];

    for (const category of categories) {
        const rubric = rubrics.get(category);
        if (!rubric) throw new Error(`Rubric is missing for category: ${category}`);
        const files = fs.readdirSync(path.join(photosRoot, category), { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b, "ru"));

        files.forEach((fileName, index) => {
            const parsed = cleanProductName(fileName);
            const key = `${category}/${fileName}`;
            const imageId = imageByKey.get(key);
            if (!imageId) throw new Error(`Drive image is missing for: ${key}`);
            rows.push([
                String(rubric * 10000 + index + 1).padStart(6, "0"),
                parsed.title,
                parsed.unit,
                category,
                "in stock",
                randomizePrice(parsed.rawPrice, key),
                "no",
                "🟢",
                imageId,
            ]);
        });
    }

    fs.writeFileSync(outputPath, rows.map((row) => row.map(cleanCell).join("\t")).join("\n"), "utf8");
    console.log(`Generated ${rows.length - 1} products at ${outputPath}`);
    console.log(rows.slice(0, 12).map((row) => row.join(" | ")).join("\n"));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
