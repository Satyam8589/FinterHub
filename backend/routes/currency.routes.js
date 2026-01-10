import { Router } from "express";
import { 
    fetchExchangeRates, 
    performCurrencyConversion, 
    fetchSupportedCurrencies,
    fetchCurrencyDetails 
} from "../controllers/currency.controller.js";

const router = Router();

router.get("/rates", fetchExchangeRates);

router.post("/convert", performCurrencyConversion);

router.get("/supported", fetchSupportedCurrencies);

router.get("/:code", fetchCurrencyDetails);

export default router;