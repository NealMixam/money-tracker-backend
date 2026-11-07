const test = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../db");
const { createIncome } = require("../controllers/income.controller");

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

    await createIncome(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error:
            "Amount must be a positive decimal string with at most two decimal places and must not exceed 9999999999.99",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Отклоняет неправильный accountId до получения соединения с БД", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            accountId: "42",
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

    await createIncome(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error:
            "AccountId must be a positive integer",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Отклоняет неправильный description до получения соединения с БД", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            accountId: 42,
            amount: "125.50",
            description: 123,
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

    await createIncome(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error:
            "Description must be a string of at most 1000 characters",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Отклоняет неправильную date до получения соединения с БД", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
        body: {
            accountId: 42,
            amount: "125.50",
            date: "2026-02-30",
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

    await createIncome(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error:
            "Invalid date",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Отклоняет отсутствующее тело запроса до получения соединения с БД", async (t) => {
    const connectMock = t.mock.method(pool, "connect", async () => {
        throw new Error("Обработчик попытался получить соединение с БД");
    });

    const req = {
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

    await createIncome(req, res);

    assert.equal(res.statusCode, 400);

    assert.deepEqual(res.body, {
        error:
            "Request body must be a JSON object",
    });

    assert.equal(connectMock.mock.callCount(), 0);
});

test("Создаёт доход и освобождает соединение", async (t) => {
    const createdIncome = {
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
                    rows: [createdIncome],
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
            description: "Зарплата",
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

    await createIncome(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, createdIncome);

    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(client.query.mock.callCount(), 2);
    assert.equal(client.release.mock.callCount(), 1);

    const insertArguments = client.query.mock.calls[1].arguments;

    assert.deepEqual(insertArguments[1], [
        42,
        7,
        "income",
        125.5,
        "Зарплата",
        "2026-11-07",
    ]);

    const selectArguments = client.query.mock.calls[0].arguments;

    assert.deepEqual(selectArguments[1], [42]);
})

test("Запрещает создание дохода на чужом счёте и освобождает соединение", async (t) => {
    const client = {
        query: t.mock.fn(async () => {
            return {
                rowCount: 1,
                rows: [{ id: 42, user_id: 9 }],
            };
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
            description: "Зарплата",
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

    await createIncome(req, res);

    assert.equal(res.statusCode, 403);

    assert.deepEqual(res.body, {
        error: "Account does not belong to you",
    });

    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(client.query.mock.callCount(), 1);
    assert.equal(client.release.mock.callCount(), 1);
})

test("Возвращает 404 и освобождает соединение, если счёт не найден", async (t) => {
    const client = {
        query: t.mock.fn(async () => {
            return {
                rowCount: 0,
                rows: [],
            };
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
            description: "Зарплата",
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

    await createIncome(req, res);
    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(client.query.mock.callCount(), 1);
    assert.equal(client.release.mock.callCount(), 1);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
        error: "Account not found",
    });
})

test("Возвращает 500 и освобождает соединение при ошибке SQL-запроса", async (t) => {
    const client = {
        query: t.mock.fn(async () => {
            throw new Error("Ошибка запроса в тесте");
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
            description: "Зарплата",
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

    await createIncome(req, res);
    assert.equal(connectMock.mock.callCount(), 1);
    assert.equal(client.query.mock.callCount(), 1);
    assert.equal(client.release.mock.callCount(), 1);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
        error: "Internal server error",
    });
})