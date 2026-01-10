import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import currencyRouter from "../routes/currency.routes.js";
import { 
    getExchangeRates, 
    convertCurrency, 
    getSupportedCurrencies,
    getCurrencyDetails,
    convertToUSD,
    formatCurrency 
} from "../services/currency.service.js";

dotenv.config();

// Create Express app for testing
const app = express();
app.use(express.json());
app.use("/api/currency", currencyRouter);

describe("Currency Service Tests", () => {
    
    describe("getExchangeRates()", () => {
        it("should return all exchange rates", async () => {
            const rates = await getExchangeRates();
            
            expect(rates).toHaveProperty("success", true);
            expect(rates).toHaveProperty("base", "USD");
            expect(rates).toHaveProperty("rates");
            expect(rates).toHaveProperty("timestamp");
            
            // Check USD rate
            expect(rates.rates.USD).toHaveProperty("code", "USD");
            expect(rates.rates.USD).toHaveProperty("rate", 1.0);
            
            // Check INR rate
            expect(rates.rates.INR).toHaveProperty("code", "INR");
            expect(rates.rates.INR.rate).toBe(0.012);
        });

        it("should include all supported currencies", async () => {
            const rates = await getExchangeRates();
            
            expect(rates.rates).toHaveProperty("USD");
            expect(rates.rates).toHaveProperty("INR");
            expect(rates.rates).toHaveProperty("EUR");
            expect(rates.rates).toHaveProperty("CAD");
            expect(rates.rates).toHaveProperty("GBP");
        });
    });

    describe("convertCurrency()", () => {
        it("should convert INR to USD correctly", () => {
            const result = convertCurrency(100, "INR", "USD");
            expect(result).toBe(1.20); // 100 * 0.012 = 1.20
        });

        it("should convert USD to INR correctly", () => {
            const result = convertCurrency(1, "USD", "INR");
            expect(result).toBe(83.33); // 1 / 0.012 = 83.33
        });

        it("should convert EUR to GBP correctly", () => {
            const result = convertCurrency(100, "EUR", "GBP");
            // 100 EUR * 1.09 = 109 USD
            // 109 USD / 1.27 = 85.83 GBP
            expect(result).toBe(85.83);
        });

        it("should return same amount for same currency", () => {
            const result = convertCurrency(100, "USD", "USD");
            expect(result).toBe(100.00);
        });

        it("should handle decimal amounts", () => {
            const result = convertCurrency(123.45, "INR", "USD");
            expect(result).toBe(1.48); // 123.45 * 0.012 = 1.4814 -> 1.48
        });

        it("should throw error for unsupported source currency", () => {
            expect(() => {
                convertCurrency(100, "XYZ", "USD");
            }).toThrow("Unsupported currency: XYZ");
        });

        it("should throw error for unsupported target currency", () => {
            expect(() => {
                convertCurrency(100, "USD", "ABC");
            }).toThrow("Unsupported currency: ABC");
        });

        it("should be case-insensitive", () => {
            const result1 = convertCurrency(100, "inr", "usd");
            const result2 = convertCurrency(100, "INR", "USD");
            expect(result1).toBe(result2);
        });
    });

    describe("getSupportedCurrencies()", () => {
        it("should return array of currencies", () => {
            const currencies = getSupportedCurrencies();
            
            expect(Array.isArray(currencies)).toBe(true);
            expect(currencies.length).toBe(5);
        });

        it("should include required fields", () => {
            const currencies = getSupportedCurrencies();
            
            currencies.forEach(currency => {
                expect(currency).toHaveProperty("code");
                expect(currency).toHaveProperty("name");
                expect(currency).toHaveProperty("symbol");
                expect(currency).toHaveProperty("rateToUSD");
            });
        });

        it("should include USD", () => {
            const currencies = getSupportedCurrencies();
            const usd = currencies.find(c => c.code === "USD");
            
            expect(usd).toBeDefined();
            expect(usd.name).toBe("US Dollar");
            expect(usd.symbol).toBe("$");
            expect(usd.rateToUSD).toBe(1.0);
        });
    });

    describe("getCurrencyDetails()", () => {
        it("should return currency details for valid code", () => {
            const euro = getCurrencyDetails("EUR");
            
            expect(euro).toHaveProperty("code", "EUR");
            expect(euro).toHaveProperty("name", "Euro");
            expect(euro).toHaveProperty("symbol", "€");
            expect(euro).toHaveProperty("rate", 1.09);
        });

        it("should be case-insensitive", () => {
            const euro1 = getCurrencyDetails("eur");
            const euro2 = getCurrencyDetails("EUR");
            
            expect(euro1.code).toBe(euro2.code);
        });

        it("should throw error for invalid currency", () => {
            expect(() => {
                getCurrencyDetails("XYZ");
            }).toThrow("Currency not found: XYZ");
        });
    });

    describe("convertToUSD()", () => {
        it("should convert INR to USD", () => {
            const result = convertToUSD(8300, "INR");
            expect(result).toBe(99.60); // 8300 * 0.012
        });

        it("should convert EUR to USD", () => {
            const result = convertToUSD(100, "EUR");
            expect(result).toBe(109.00); // 100 * 1.09
        });

        it("should return same for USD to USD", () => {
            const result = convertToUSD(100, "USD");
            expect(result).toBe(100.00);
        });
    });

    describe("formatCurrency()", () => {
        it("should format USD correctly", () => {
            const formatted = formatCurrency(1234.56, "USD");
            expect(formatted).toBe("$1234.56");
        });

        it("should format INR correctly", () => {
            const formatted = formatCurrency(8300, "INR");
            expect(formatted).toBe("₹8300.00");
        });

        it("should format EUR correctly", () => {
            const formatted = formatCurrency(99.99, "EUR");
            expect(formatted).toBe("€99.99");
        });

        it("should format GBP correctly", () => {
            const formatted = formatCurrency(50.50, "GBP");
            expect(formatted).toBe("£50.50");
        });

        it("should round to 2 decimals", () => {
            const formatted = formatCurrency(123.456, "USD");
            expect(formatted).toBe("$123.46");
        });

        it("should handle unknown currency", () => {
            const formatted = formatCurrency(100, "XYZ");
            expect(formatted).toBe("100.00 XYZ");
        });
    });
});

describe("Currency Controller API Tests", () => {
    
    describe("GET /api/currency/rates", () => {
        it("should return all exchange rates", async () => {
            const response = await request(app)
                .get("/api/currency/rates")
                .expect(200);

            expect(response.body).toHaveProperty("success", true);
            expect(response.body).toHaveProperty("base", "USD");
            expect(response.body).toHaveProperty("rates");
        });

        it("should return proper JSON format", async () => {
            const response = await request(app)
                .get("/api/currency/rates")
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body.rates).toHaveProperty("USD");
            expect(response.body.rates).toHaveProperty("INR");
        });
    });

    describe("POST /api/currency/convert", () => {
        it("should convert currency successfully", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: 100,
                    from: "INR",
                    to: "USD"
                })
                .expect(200);

            expect(response.body).toHaveProperty("success", true);
            expect(response.body.original.amount).toBe(100);
            expect(response.body.original.currency).toBe("INR");
            expect(response.body.converted.amount).toBe(1.20);
            expect(response.body.converted.currency).toBe("USD");
        });

        it("should return 400 if amount is missing", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    from: "INR",
                    to: "USD"
                })
                .expect(400);

            expect(response.body.message).toContain("required");
        });

        it("should return 400 if from currency is missing", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: 100,
                    to: "USD"
                })
                .expect(400);

            expect(response.body.message).toContain("required");
        });

        it("should return 400 if to currency is missing", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: 100,
                    from: "INR"
                })
                .expect(400);

            expect(response.body.message).toContain("required");
        });

        it("should return 400 if amount is negative", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: -100,
                    from: "INR",
                    to: "USD"
                })
                .expect(400);

            expect(response.body.message).toContain("positive");
        });

        it("should return 400 if amount is zero", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: 0,
                    from: "INR",
                    to: "USD"
                })
                .expect(400);

            expect(response.body.message).toContain("positive");
        });

        it("should return 400 for invalid currency", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: 100,
                    from: "XYZ",
                    to: "USD"
                })
                .expect(400);

            expect(response.body.message).toContain("Unsupported currency");
        });

        it("should handle large amounts", async () => {
            const response = await request(app)
                .post("/api/currency/convert")
                .send({
                    amount: 1000000,
                    from: "INR",
                    to: "USD"
                })
                .expect(200);

            expect(response.body.converted.amount).toBe(12000.00);
        });
    });

    describe("GET /api/currency/supported", () => {
        it("should return list of supported currencies", async () => {
            const response = await request(app)
                .get("/api/currency/supported")
                .expect(200);

            expect(response.body).toHaveProperty("success", true);
            expect(response.body).toHaveProperty("count", 5);
            expect(Array.isArray(response.body.currencies)).toBe(true);
        });

        it("should include all required fields", async () => {
            const response = await request(app)
                .get("/api/currency/supported")
                .expect(200);

            response.body.currencies.forEach(currency => {
                expect(currency).toHaveProperty("code");
                expect(currency).toHaveProperty("name");
                expect(currency).toHaveProperty("symbol");
                expect(currency).toHaveProperty("rateToUSD");
            });
        });
    });

    describe("GET /api/currency/:code", () => {
        it("should return currency details for valid code", async () => {
            const response = await request(app)
                .get("/api/currency/EUR")
                .expect(200);

            expect(response.body).toHaveProperty("success", true);
            expect(response.body.currency.code).toBe("EUR");
            expect(response.body.currency.name).toBe("Euro");
            expect(response.body.currency.symbol).toBe("€");
        });

        it("should be case-insensitive", async () => {
            const response = await request(app)
                .get("/api/currency/eur")
                .expect(200);

            expect(response.body.currency.code).toBe("EUR");
        });

        it("should return 404 for invalid currency", async () => {
            const response = await request(app)
                .get("/api/currency/XYZ")
                .expect(404);

            expect(response.body.message).toContain("not found");
        });

        it("should return all currency details", async () => {
            const response = await request(app)
                .get("/api/currency/GBP")
                .expect(200);

            expect(response.body.currency).toHaveProperty("code");
            expect(response.body.currency).toHaveProperty("name");
            expect(response.body.currency).toHaveProperty("symbol");
            expect(response.body.currency).toHaveProperty("rate");
            expect(response.body.currency).toHaveProperty("lastUpdated");
        });
    });
});

describe("Currency Conversion Edge Cases", () => {
    it("should handle very small amounts", () => {
        const result = convertCurrency(0.01, "USD", "INR");
        expect(result).toBe(0.83);
    });

    it("should handle decimal precision", () => {
        const result = convertCurrency(123.456789, "EUR", "USD");
        expect(result).toBe(134.57); // Rounded to 2 decimals
    });

    it("should handle conversion chain correctly", () => {
        // INR -> USD -> EUR
        const inr = 8300;
        const usd = convertToUSD(inr, "INR"); // 99.60
        const eur = convertCurrency(usd, "USD", "EUR"); // 91.38
        
        expect(eur).toBe(91.38);
    });

    it("should maintain precision in round-trip conversion", () => {
        const original = 100;
        const converted = convertCurrency(original, "USD", "EUR");
        const backToOriginal = convertCurrency(converted, "EUR", "USD");
        
        // Should be close to original (within rounding error)
        expect(Math.abs(backToOriginal - original)).toBeLessThan(0.01);
    });
});
