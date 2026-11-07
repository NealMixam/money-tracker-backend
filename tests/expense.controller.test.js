const { createExpense } = require("../controllers/expense.controller");
const test = require("node:test");
const pool = require("../db");
const assert = require("node:assert/strict");

test("Отклоняет amount: true до получения соединения с БД", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            accountId: 42,
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

    await createExpense(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error:
            "Amount must be a positive decimal string with at most two decimal places and must not exceed 9999999999.99",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Создаёт расход и освобождает соединение", async (t) => {
    const createdExpense = {
        id: 101,
        user_id: 7,
        amount: "125.50",
        date: "2026-11-07",
    };

    const client = {
        query: t.mock.fn(async (sql) => {
            if (sql.trim().startsWith("SELECT")) {
                return {
                    rowCount: 1,
                    rows: [{ id: 42, user_id: 7 }],
                };
            }

            if (sql.trim().startsWith("INSERT")) {
                return {
                    rowCount: 1,
                    rows: [createdExpense],
                };
            }

            throw new Error("Неожиданный SQL-запрос");
        }),

        release: t.mock.fn(),
    };

    const connectMock = t.mock.method(pool, "connect", async () => {
        return client;
    });

    const req = {
        body: {
            accountId: 42,
            amount: "125.50",
            description: "Продукты",
            date: "2026-11-07",
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

    await createExpense(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, createdExpense);

    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(client.query.mock.callCount(), 2);
    assert.equal(client.release.mock.callCount(), 1);

    const insertArguments = client.query.mock.calls[1].arguments;

    assert.deepEqual(insertArguments[1], [
        42,
        7,
        "expense",
        125.5,
        "Продукты",
        "2026-11-07",
    ]);

    const selectArguments = client.query.mock.calls[0].arguments;

    assert.deepEqual(selectArguments[1], [42]);
})