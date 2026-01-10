/**
 * Currency Service
 * Handles all currency-related business logic including conversion and formatting
 */

/**
 * Currency exchange rates to USD
 * In production, these should be fetched from a live API
 */
const EXCHANGE_RATES = {
    USD: {
        code: "USD",
        name: "US Dollar",
        symbol: "$",
        rate: 1.0,
        lastUpdated: new Date("2026-01-10")
    },
    INR: {
        code: "INR",
        name: "Indian Rupee",
        symbol: "₹",
        rate: 0.012,  // 1 INR = 0.012 USD (approx 83 INR = 1 USD)
        lastUpdated: new Date("2026-01-10")
    },
    EUR: {
        code: "EUR",
        name: "Euro",
        symbol: "€",
        rate: 1.09,   // 1 EUR = 1.09 USD
        lastUpdated: new Date("2026-01-10")
    },
    CAD: {
        code: "CAD",
        name: "Canadian Dollar",
        symbol: "C$",
        rate: 0.74,   // 1 CAD = 0.74 USD
        lastUpdated: new Date("2026-01-10")
    },
    GBP: {
        code: "GBP",
        name: "British Pound",
        symbol: "£",
        rate: 1.27,   // 1 GBP = 1.27 USD
        lastUpdated: new Date("2026-01-10")
    }
};

/**
 * Get all exchange rates
 */
export const getExchangeRates = async () => {
    try {
        // In production, fetch from external API
        // const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        // const data = await response.json();
        // return data.rates;

        return {
            success: true,
            base: "USD",
            rates: EXCHANGE_RATES,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        throw new Error(`Failed to fetch exchange rates: ${error.message}`);
    }
};

/**
 * Convert amount from one currency to another
 */
export const convertCurrency = (amount, fromCurrency, toCurrency) => {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // Validate currencies
    if (!EXCHANGE_RATES[from]) {
        throw new Error(`Unsupported currency: ${from}`);
    }
    if (!EXCHANGE_RATES[to]) {
        throw new Error(`Unsupported currency: ${to}`);
    }

    // If same currency, return original amount
    if (from === to) {
        return parseFloat(amount.toFixed(2));
    }

    // Convert to USD first, then to target currency
    const amountInUSD = amount * EXCHANGE_RATES[from].rate;
    const convertedAmount = amountInUSD / EXCHANGE_RATES[to].rate;

    return parseFloat(convertedAmount.toFixed(2));
};

/**
 * Get list of supported currencies
 */
export const getSupportedCurrencies = () => {
    return Object.values(EXCHANGE_RATES).map(currency => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        rateToUSD: currency.rate
    }));
};

/**
 * Get specific currency details
 */
export const getCurrencyDetails = (currencyCode) => {
    const code = currencyCode.toUpperCase();
    const currency = EXCHANGE_RATES[code];
    
    if (!currency) {
        throw new Error(`Currency not found: ${code}`);
    }
    
    return currency;
};

/**
 * Convert amount to USD (base currency)
 */
export const convertToUSD = (amount, currency) => {
    return convertCurrency(amount, currency, 'USD');
};

/**
 * Format amount with currency symbol
 */
export const formatCurrency = (amount, currencyCode) => {
    const code = currencyCode.toUpperCase();
    const currency = EXCHANGE_RATES[code];
    
    if (!currency) {
        return `${amount.toFixed(2)} ${code}`;
    }
    
    return `${currency.symbol}${amount.toFixed(2)}`;
};
