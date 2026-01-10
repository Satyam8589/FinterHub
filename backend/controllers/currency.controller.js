import { 
    getExchangeRates, 
    convertCurrency, 
    getSupportedCurrencies,
    getCurrencyDetails 
} from "../services/currency.service.js";

export const fetchExchangeRates = async (req, res) => {
    try {
        const rates = await getExchangeRates();
        return res.status(200).json(rates);
    } catch (error) {
        return res.status(500).json({ 
            message: "Failed to fetch exchange rates",
            error: error.message 
        });
    }
};

export const performCurrencyConversion = async (req, res) => {
    try {
        const { amount, from, to } = req.body;

        if (amount === undefined || amount === null || !from || !to) {
            return res.status(400).json({ 
                message: "Missing required fields: amount, from, to" 
            });
        }

        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ 
                message: "Amount must be a positive number" 
            });
        }

        const convertedAmount = convertCurrency(parseFloat(amount), from, to);

        return res.status(200).json({
            success: true,
            original: {
                amount: parseFloat(amount),
                currency: from.toUpperCase()
            },
            converted: {
                amount: convertedAmount,
                currency: to.toUpperCase()
            },
            rate: convertedAmount / parseFloat(amount),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return res.status(400).json({ 
            message: error.message 
        });
    }
};

export const fetchSupportedCurrencies = async (req, res) => {
    try {
        const currencies = getSupportedCurrencies();
        return res.status(200).json({
            success: true,
            count: currencies.length,
            currencies: currencies
        });
    } catch (error) {
        return res.status(500).json({ 
            message: "Failed to fetch supported currencies",
            error: error.message 
        });
    }
};

export const fetchCurrencyDetails = async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({ 
                message: "Currency code is required" 
            });
        }

        const currency = getCurrencyDetails(code);
        return res.status(200).json({
            success: true,
            currency: currency
        });

    } catch (error) {
        return res.status(404).json({ 
            message: error.message 
        });
    }
};
