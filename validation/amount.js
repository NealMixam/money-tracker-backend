function isValidAmount(amount) {

    if (typeof amount !== 'string') {
        return false;
    }

    const amountPattern = /^\d+(\.\d{1,2})?$/;

    if (!amountPattern.test(amount)) {
        return false;
    }

    const numericAmount = Number(amount);

    const MAX_AMOUNT = 9_999_999_999.99;

    return Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount <= MAX_AMOUNT;
}

module.exports = { isValidAmount };