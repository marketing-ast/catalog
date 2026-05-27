const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function loadAppContext() {
    const appPath = path.join(__dirname, "..", "app.js");
    const appSource = fs.readFileSync(appPath, "utf8").replace(/\ninit\(\);\s*$/, "\n");
    const element = {
        addEventListener() {},
        classList: { contains() { return false; }, toggle() {} },
        dataset: {},
        hidden: false,
        innerHTML: "",
        textContent: "",
    };
    const context = {
        console,
        document: {
            hidden: false,
            querySelector() { return element; },
            querySelectorAll() { return []; },
        },
        localStorage: {
            getItem() { return null; },
            setItem() {},
            removeItem() {},
        },
        setInterval() {},
        setTimeout() {},
        fetch() {},
    };
    vm.createContext(context);
    vm.runInContext(appSource, context);
    return context;
}

test("builds a Google Drive thumbnail URL from a file id", () => {
    const context = loadAppContext();

    assert.equal(
        context.getProductImageUrl("1AKuCuLUPhsVcbzotN0howX7A6H-iG1GJ"),
        "https://drive.google.com/thumbnail?id=1AKuCuLUPhsVcbzotN0howX7A6H-iG1GJ&sz=w480",
    );
});

test("renders product image instead of emoji when image is present", () => {
    const context = loadAppContext();
    const html = context.renderProductCard({
        id: 200001,
        name: "Кофе - Fresco Arabica Doppio 100гр",
        unit: "шт",
        category: "Чай и Кофе",
        availability: "in stock",
        price: 3821,
        sale: false,
        emoji: "🟢",
        image: "1AKuCuLUPhsVcbzotN0howX7A6H-iG1GJ",
    });

    assert.match(html, /class="product-image"/);
    assert.match(html, /class="product-image-button"/);
    assert.match(html, /width="480"/);
    assert.match(html, /height="480"/);
    assert.match(html, /thumbnail\?id=1AKuCuLUPhsVcbzotN0howX7A6H-iG1GJ&amp;sz=w480/);
    assert.match(html, /thumbnail\?id=1AKuCuLUPhsVcbzotN0howX7A6H-iG1GJ&amp;sz=w1200/);
    assert.doesNotMatch(html, /product-emoji" aria-hidden="true">🟢/);
});
