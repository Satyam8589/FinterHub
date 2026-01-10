import mongoose from "mongoose";

const currencyRateSchema = new mongoose.Schema({
    baseCurrency: {
        type: String,
        required: true,
        default: "USD"
    },
    rates: {
        type: Map,
        of: {
            code: String,
            name: String,
            symbol: String,
            rate: Number
        }
    },
    fetchedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

currencyRateSchema.index({ fetchedAt: -1 });

const CurrencyRate = mongoose.model("CurrencyRate", currencyRateSchema);

export default CurrencyRate;