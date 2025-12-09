"use client";

import { useMemo, useState } from "react";

/* ============================================================
   GLOBAL COUNTRY LIST (major import/export markets)
   ============================================================ */
const COUNTRIES = [
  // Europe
  { code: "UK", label: "United Kingdom", vatRate: 0.20 },
  { code: "FR", label: "France", vatRate: 0.20 },
  { code: "DE", label: "Germany", vatRate: 0.19 },
  { code: "IT", label: "Italy", vatRate: 0.22 },
  { code: "ES", label: "Spain", vatRate: 0.21 },
  { code: "NL", label: "Netherlands", vatRate: 0.21 },
  { code: "IE", label: "Ireland", vatRate: 0.23 },
  { code: "CH", label: "Switzerland", vatRate: 0.077 },
  { code: "NO", label: "Norway", vatRate: 0.25 },
  { code: "SE", label: "Sweden", vatRate: 0.25 },
  { code: "DK", label: "Denmark", vatRate: 0.25 },

  // Middle East
  { code: "AE", label: "United Arab Emirates", vatRate: 0.05 },
  { code: "SA", label: "Saudi Arabia", vatRate: 0.15 },
  { code: "QA", label: "Qatar", vatRate: 0.05 },
  { code: "KW", label: "Kuwait", vatRate: 0.05 },

  // Americas
  { code: "US", label: "United States", vatRate: 0 }, // Sales tax not modelled
  { code: "CA", label: "Canada", vatRate: 0.05 },
  { code: "MX", label: "Mexico", vatRate: 0.16 },

  // Asia
  { code: "JP", label: "Japan", vatRate: 0.10 },
  { code: "CN", label: "China", vatRate: 0.13 },
  { code: "SG", label: "Singapore", vatRate: 0.08 },
  { code: "HK", label: "Hong Kong", vatRate: 0 },

  // fallback
  { code: "OTHER", label: "Other / Not Listed", vatRate: 0 },
];

const ORIGINS = COUNTRIES;

/* ============================================================
   CURRENCIES
   ============================================================ */
const CURRENCIES = [
  { code: "GBP", symbol: "£" },
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
  { code: "AED", symbol: "د.إ" },
  { code: "JPY", symbol: "¥" },
];

/* ============================================================
   CATEGORY DUTY RATES (simplified but realistic)
   ============================================================ */
const DUTY_TABLE = {
  HANDBAG: { default: 0.08, US: 0.06, AE: 0.05 },
  JEWELLERY: { default: 0.04, US: 0.05, AE: 0.05 },
  RTW: { default: 0.04, US: 0.05, AE: 0.05 },
  SHOES: { default: 0.06, US: 0.06, AE: 0.05 },
  OTHER: { default: 0.03, US: 0.04, AE: 0.05 },
};

const CATEGORIES = [
  { code: "HANDBAG", label: "Luxury Handbag" },
  { code: "JEWELLERY", label: "Jewellery / Watch" },
  { code: "RTW", label: "Ready-to-wear" },
  { code: "SHOES", label: "Shoes" },
  { code: "OTHER", label: "Other luxury item" },
];

/* ============================================================
   HELPERS
   ============================================================ */
function getCurrencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

function getDutyRate(category, dest) {
  const cat = DUTY_TABLE[category] || DUTY_TABLE.OTHER;
  return cat[dest] ?? cat.default ?? 0;
}

function money(amount, currency) {
  const meta = getCurrencyMeta(currency);
  return `${meta.symbol}${amount.toFixed(2)} ${currency}`;
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function DutyCalculatorPage() {
  /* ------------ User Inputs ------------ */
  const [origin, setOrigin] = useState("EU");
  const [destination, setDestination] = useState("UK");
  const [currency, setCurrency] = useState("GBP");
  const [category, setCategory] = useState("HANDBAG");

  const [itemValue, setItemValue] = useState("");
  const [shippingCost, setShippingCost] = useState("");

  const [includeShippingInDuty, setIncludeShippingInDuty] = useState(true);
  const [includeShippingInVat, setIncludeShippingInVat] = useState(true);

  /* --- NEW PROFESSIONAL PRICING INPUTS ---- */
  const [marginPercent, setMarginPercent] = useState("12");
  const [processorFeePercent, setProcessorFeePercent] = useState("2.9");
  const [fxPercent, setFxPercent] = useState("1.5");
  const [insurancePercent, setInsurancePercent] = useState("0.5");
  const [riskBufferPercent, setRiskBufferPercent] = useState("3");
  const [handlingFee, setHandlingFee] = useState("0");

  /* ------------ Parsing ------------ */
  const parsedItem = parseFloat(itemValue) || 0;
  const parsedShip = parseFloat(shippingCost) || 0;
  const parsedHandling = parseFloat(handlingFee) || 0;

  const destinationMeta = COUNTRIES.find((c) => c.code === destination);
  const vatRate = destinationMeta?.vatRate ?? 0;

  /* ============================================================
     CORE CALCULATIONS
     ============================================================ */
  const {
    dutyRate,
    dutyAmount,
    vatBase,
    vatAmount,
    landedCost,
    commercialCost,
    recommendedPrice,
    profit,
  } = useMemo(() => {
    const dRate = getDutyRate(category, destination);

    const dutyBase =
      parsedItem + (includeShippingInDuty ? parsedShip : 0);

    const dutyAmountCalc = dutyBase * dRate;

    const vatBaseCalc =
      parsedItem +
      (includeShippingInVat ? parsedShip : 0) +
      dutyAmountCalc;

    const vatAmountCalc = vatBaseCalc * vatRate;

    const landed =
      parsedItem +
      parsedShip +
      dutyAmountCalc +
      vatAmountCalc;

    const insuranceFee = (insurancePercent / 100) * landed;
    const fxFee = (fxPercent / 100) * landed;
    const riskFee = (riskBufferPercent / 100) * landed;
    const processorFee = (processorFeePercent / 100) * landed;

    const commercial =
      landed +
      insuranceFee +
      fxFee +
      riskFee +
      processorFee +
      parsedHandling;

    const sellingPrice =
      commercial * (1 + marginPercent / 100);

    const profitCalc = sellingPrice - commercial;

    return {
      dutyRate: dRate,
      dutyAmount: dutyAmountCalc,
      vatBase: vatBaseCalc,
      vatAmount: vatAmountCalc,
      landedCost: landed,
      commercialCost: commercial,
      recommendedPrice: sellingPrice,
      profit: profitCalc,
    };
  }, [
    parsedItem,
    parsedShip,
    parsedHandling,
    includeShippingInDuty,
    includeShippingInVat,
    marginPercent,
    processorFeePercent,
    insurancePercent,
    fxPercent,
    riskBufferPercent,
    category,
    destination,
  ]);

  /* ============================================================
     UI
     ============================================================ */
  return (
    <main className="min-h-screen bg-white text-slate-900 pb-20">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full border border-slate-300 flex items-center justify-center text-[10px] font-semibold">
              TF
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Tufffinds
              </p>
              <p className="text-sm font-medium">
                International Duties & Pricing Engine
              </p>
            </div>
          </div>

          <span className="hidden md:block text-[10px] border px-3 py-1 rounded-full bg-slate-50">
            Internal Estimate Tool
          </span>
        </div>
      </header>

      <div className="w-full flex justify-center px-4 pt-10">
        <div className="w-full max-w-4xl">

          {/* Title */}
          <h1 className="text-xl text-center font-medium">
            Full International Duties, Fees & Pricing Calculator
          </h1>

          <p className="text-center text-slate-500 mt-2 mb-10 text-sm">
            Designed for sourcing, personal shopping and luxury retail pricing.
          </p>

          {/* ============================================================
              GRID: LEFT (inputs) RIGHT (results)
              ============================================================ */}
          <div className="grid gap-8 lg:grid-cols-2">

            {/* LEFT PANEL: INPUTS */}
            <section className="space-y-6">

              {/* Shipment Card */}
              <div className="border rounded-xl p-5 shadow-sm">
                <h2 className="font-medium text-sm">Shipment Details</h2>

                {/* origin/destination */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Origin country">
                    <select value={origin} onChange={e => setOrigin(e.target.value)}
                      className="input">
                      {ORIGINS.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Destination country">
                    <select value={destination} onChange={e => setDestination(e.target.value)}
                      className="input">
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* category */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Category">
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="input">
                      {CATEGORIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Currency">
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="input">
                      {CURRENCIES.map((c) => (
                        <option key={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* values */}
                <div className="grid grid-cols-2 gap-4 mt-5">
                  <Field label="Item value">
                    <input className="input" type="number"
                      value={itemValue} onChange={e => setItemValue(e.target.value)} />
                  </Field>

                  <Field label="Shipping cost">
                    <input className="input" type="number"
                      value={shippingCost} onChange={e => setShippingCost(e.target.value)} />
                  </Field>
                </div>

                {/* toggles */}
                <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600 mt-4">
                  <label>
                    <input type="checkbox" checked={includeShippingInDuty}
                      onChange={e => setIncludeShippingInDuty(e.target.checked)} />{" "}
                    Include shipping in duty base
                  </label>

                  <label>
                    <input type="checkbox" checked={includeShippingInVat}
                      onChange={e => setIncludeShippingInVat(e.target.checked)} />{" "}
                    Include shipping in VAT base
                  </label>
                </div>
              </div>

              {/* Pricing inputs */}
              <div className="border rounded-xl p-5 shadow-sm">
                <h2 className="font-medium text-sm">Pricing & Fees</h2>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Margin %">
                    <input className="input" type="number"
                      value={marginPercent} onChange={e => setMarginPercent(e.target.value)} />
                  </Field>

                  <Field label="Card processor fee %">
                    <input className="input" type="number"
                      value={processorFeePercent} onChange={e => setProcessorFeePercent(e.target.value)} />
                  </Field>

                  <Field label="FX conversion %">
                    <input className="input" type="number"
                      value={fxPercent} onChange={e => setFxPercent(e.target.value)} />
                  </Field>

                  <Field label="Insurance %">
                    <input className="input" type="number"
                      value={insurancePercent} onChange={e => setInsurancePercent(e.target.value)} />
                  </Field>

                  <Field label="Risk buffer %">
                    <input className="input" type="number"
                      value={riskBufferPercent} onChange={e => setRiskBufferPercent(e.target.value)} />
                  </Field>

                  <Field label="Handling fee">
                    <input className="input" type="number"
                      value={handlingFee} onChange={e => setHandlingFee(e.target.value)} />
                  </Field>
                </div>
              </div>

            </section>

            {/* RIGHT PANEL: RESULTS */}
            <section className="space-y-6">

              <div className="border rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-medium">Landed Cost Breakdown</h2>

                <Line label="Item value" value={money(parsedItem, currency)} />
                <Line label="Shipping" value={money(parsedShip, currency)} />
                <Line label={`Duty (${(dutyRate * 100).toFixed(1)}%)`} value={money(dutyAmount, currency)} />
                <Line label={`VAT (${(vatRate * 100).toFixed(1)}%)`} value={money(vatAmount, currency)} />

                <Line label="Landed cost" value={money(landedCost, currency)} highlight />
              </div>

              <div className="border rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-medium">Commercial Cost Breakdown</h2>

                <Line label="Landed cost" value={money(landedCost, currency)} />
                <Line label="Handling fee" value={money(parsedHandling, currency)} />
                <Line label="Card processor fee" value={`${processorFeePercent}%`} />
                <Line label="FX fee" value={`${fxPercent}%`} />
                <Line label="Insurance" value={`${insurancePercent}%`} />
                <Line label="Risk buffer" value={`${riskBufferPercent}%`} />

                <Line label="Commercial cost" value={money(commercialCost, currency)} highlight />
              </div>

              <div className="border rounded-xl p-5 shadow-sm bg-slate-50">
                <h2 className="text-sm font-medium">Final Pricing</h2>

                <Line label={`Margin (${marginPercent}%)`} value="—" />
                <Line label="Recommended selling price" value={money(recommendedPrice, currency)} highlight />
                <Line label="Estimated profit" value={money(profit, currency)} />
              </div>

            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ============================================================
   PRESENTATION COMPONENTS
   ============================================================ */
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase text-slate-500 tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function Line({ label, value, hint, highlight }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${highlight ? "font-semibold text-slate-900" : "text-slate-700"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
