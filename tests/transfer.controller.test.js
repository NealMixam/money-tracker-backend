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

test("Отклоняет перевод между разными валютами", async (t) => {
    const queries = [];
    let released = false;

    const accounts = [
        { id: 42, user_id: 7, currency: "RUB" },
        { id: 43, user_id: 7, currency: "USD" },
    ];

    const client = {
        async query(sql, params) {
            queries.push(sql);

            if (sql === "BEGIN" || sql === "ROLLBACK") {
                return {};
            }

            if (sql.startsWith("SELECT id, user_id, currency FROM accounts")) {
                const account = accounts.find((item) => item.id === params[0]);

                return {
                    rowCount: account ? 1 : 0,
                    rows: account ? [account] : [],
                };
            }

            throw new Error(`Unexpected SQL: ${sql}`);
        },

        release() {
            released = true;
        },
    };

    const req = {
        body: {
            fromAccountId: 42,
            toAccountId: 43,
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

    t.mock.method(pool, "connect", async () => client);

    await transfer(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
        error: "Accounts must have the same currency",
    });

    assert.ok(queries.includes("ROLLBACK"));
    assert.ok(!queries.includes("COMMIT"));
    assert.ok(!queries.some((sql) => sql.startsWith("INSERT")));
    assert.equal(released, true);
})

test("Выполняет перевод между счетами одной валюты", async (t) => {
    const queries = [];
    let released = false;

    const accounts = [
        { id: 42, user_id: 7, currency: "RUB" },
        { id: 43, user_id: 7, currency: "RUB" },
    ];

    const client = {
        async query(sql, params) {
            queries.push(sql);

            if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
                return {};
            }

            if (sql.startsWith("SELECT id, user_id, currency FROM accounts")) {
                const account = accounts.find((item) => item.id === params[0]);

                return {
                    rowCount: account ? 1 : 0,
                    rows: account ? [account] : [],
                };
            }

            if (sql.startsWith("SELECT COALESCE")) {
                return { rows: [{ balance: "1000.00" }] };
            }

            if (sql.startsWith("INSERT INTO transactions")) {
                return { rowCount: 1, rows: [] };
            }

            throw new Error(`Unexpected SQL: ${sql}`);
        },

        release() {
            released = true;
        },
    };

    const req = {
        body: {
            fromAccountId: 42,
            toAccountId: 43,
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

    t.mock.method(pool, "connect", async () => client);

    await transfer(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        message: "Transfer completed",
    });

    assert.ok(queries.includes("COMMIT"));
    assert.ok(!queries.includes("ROLLBACK"));
    assert.equal(
        queries.filter((sql) => sql.startsWith("INSERT")).length,
        2,
    );
    assert.equal(released, true);
})

test("Блокирует счета по ID и сохраняет направление перевода", async (t) => {
    const queries = [];
    let released = false;

    const accounts = [
        { id: 42, user_id: 7, currency: "RUB" },
        { id: 43, user_id: 7, currency: "RUB" },
    ];

    const client = {
        async query(sql, params) {
            queries.push({ sql, params });

            if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
                return {};
            }

            if (sql.startsWith("SELECT id, user_id, currency FROM accounts")) {
                const account = accounts.find((item) => item.id === params[0]);

                return {
                    rowCount: account ? 1 : 0,
                    rows: account ? [account] : [],
                };
            }

            if (sql.startsWith("SELECT COALESCE")) {
                return { rows: [{ balance: "1000.00" }] };
            }

            if (sql.startsWith("INSERT INTO transactions")) {
                return { rowCount: 1, rows: [] };
            }

            throw new Error(`Unexpected SQL: ${sql}`);
        },

        release() {
            released = true;
        },
    };

    const req = {
        body: {
            fromAccountId: 43,
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

    t.mock.method(pool, "connect", async () => client);

    await transfer(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        message: "Transfer completed",
    });

// Блокировки: сначала меньший ID, затем больший.
    const lockQueries = queries.filter(({ sql }) =>
        sql.includes("FOR UPDATE"),
    );

    assert.deepEqual(
        lockQueries.map(({ params }) => params[0]),
        [42, 43],
    );

// Баланс проверяем именно у отправителя.
    const balanceQueries = queries.filter(({ sql }) =>
        sql.startsWith("SELECT COALESCE"),
    );

    assert.deepEqual(
        balanceQueries.map(({ params }) => params[0]),
        [43],
    );

// Списание — с 43, зачисление — на 42.
    const inserts = queries.filter(({ sql }) =>
        sql.startsWith("INSERT INTO transactions"),
    );

    assert.deepEqual(
        inserts.map(({ params }) => ({
            accountId: params[0],
            type: params[2],
            amount: params[3],
        })),
        [
            { accountId: 43, type: "expense", amount: 125.5 },
            { accountId: 42, type: "income", amount: 125.5 },
        ],
    );

    assert.ok(queries.some(({ sql }) => sql === "COMMIT"));
    assert.ok(!queries.some(({ sql }) => sql === "ROLLBACK"));
    assert.equal(released, true);
})