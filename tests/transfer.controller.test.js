const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../db");
const { transfer } = require("../controllers/transfer.controller");

test("Отклоняет строковый toAccountId до получения соединения", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            fromAccountId: 42,
            toAccountId: "42",
            amount: "125.50",
        },
        user: {
            userId: 7,
        },
    };

    const res = {
        statusCode: 200,
        body: undefined,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(body) {
            this.body = body;
            return this;
        },
    };

    await transfer(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error: "fromAccountId and toAccountId must be positive integers",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Отклоняет одинаковые toAccountId и fromAccountId до получения соединения", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            fromAccountId: 42,
            toAccountId: 42,
            amount: "125.50",
        },
        user: {
            userId: 7,
        },
    };

    const res = {
        statusCode: 200,
        body: undefined,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(body) {
            this.body = body;
            return this;
        },
    };

    await transfer(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error: "Source and destination accounts must be different",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Отклоняет amount: true до получения соединения", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            fromAccountId: 42,
            toAccountId: 43,
            amount: true,
        },
        user: {
            userId: 7,
        },
    };

    const res = {
        statusCode: 200,
        body: undefined,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(body) {
            this.body = body;
            return this;
        },
    };

    await transfer(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error: "Amount must be a positive decimal string with at most two decimal places and must not exceed 9999999999.99",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});