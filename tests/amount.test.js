const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidAmount } = require("../validation/amount");

test("Принимает положительную сумму с двумя знаками после точки", () => {
    const result = isValidAmount("125.50");

    assert.equal(result, true);
});

test("Отклоняет логическое значение true", () => {
    const result = isValidAmount(true);

    assert.equal(result, false);
});

test("Отклоняет сумму выше допустимого предела", () => {
    const result = isValidAmount("10000000000");

    assert.equal(result, false);
});

test("Отклоняет нулевую сумму", () => {
    const result = isValidAmount("0");

    assert.equal(result, false);
});

test("Принимает минимально допустимую сумму", () => {
    const result = isValidAmount("0.01");

    assert.equal(result, true);
});

test("Принимает максимально допустимую сумму", () => {
    const result = isValidAmount("9999999999.99");

    assert.equal(result, true);
});

test("Отклоняет сумму с более чем двумя знаками после точки", () => {
    const result = isValidAmount("0.001");

    assert.equal(result, false);
});

test("Отклоняет неправильный формат", () => {
    const result = isValidAmount("hello");

    assert.equal(result, false);
});

test("Отклоняет число вместо строки", () => {
    const result = isValidAmount(125.50);

    assert.equal(result, false);
});