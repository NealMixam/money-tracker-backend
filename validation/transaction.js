function isValidAccountId(accountId) {
    return (
        Number.isInteger(accountId) &&
        accountId > 0 &&
        accountId <= 2147483647
    );
}

function isValidDescription(description) {
    if (description == null) {
        return true;
    }

    return typeof description === 'string' && description.length <= 1000;
}

function isValidDate(date) {
    if (date == null) {
        return true;
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (typeof date !== "string" || !datePattern.test(date)) {
        return false;
    }

    const [year, month, day] = date.split("-").map(Number);

    if (year < 1 || month < 1 || month > 12) {
        return false;
    }

    const isLeapYear =
        year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);

    const daysInMonths = [
        31,
        isLeapYear ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    const maxDay = daysInMonths[month - 1];

    return day >= 1 && day <= maxDay;
}

module.exports = {
    isValidAccountId,
    isValidDescription,
    isValidDate,
};