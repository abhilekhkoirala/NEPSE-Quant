// NEPSE transaction cost calculator (broker commission, SEBON fee, NEPSE
// fee, DP charge, CGT) — effective May 14 2024 rates. Moved verbatim from
// src/App.jsx.
import { CGT_SHORT_TERM_RATE, CGT_LONG_TERM_RATE } from "../config/constants.js";

function calcNEPSECost(turnover, { isSell = false, profitRs = null, longTerm = false } = {}) {
  if (!turnover || turnover <= 0) return { broker: 0, sebon: 0, dp: 0, nepse: 0, cgt: 0, total: 0, cgtRate: 0 };

  // Tiered broker commission (post-10% SEBON reduction, May 2024)
  let brokerRate;
  if      (turnover <= 50_000)       brokerRate = 0.0036;
  else if (turnover <= 500_000)      brokerRate = 0.0033;
  else if (turnover <= 2_000_000)    brokerRate = 0.0031;
  else if (turnover <= 10_000_000)   brokerRate = 0.0027;
  else                                brokerRate = 0.0024;

  const broker  = turnover * brokerRate;          // Broker commission
  const sebon   = turnover * 0.00015;             // SEBON regulatory fee: 0.015%
  const nepse   = broker   * 0.20;                // NEPSE fee: 20% of broker commission
  const dp      = 25;                             // DP charge: flat Rs. 25 per transaction

  // Capital Gain Tax — sellers only, on profit (not turnover)
  let cgt = 0, cgtRate = 0;
  if (isSell && profitRs !== null && profitRs > 0) {
    cgtRate = longTerm ? CGT_LONG_TERM_RATE : CGT_SHORT_TERM_RATE;
    cgt     = profitRs * cgtRate;
  }

  const total = broker + sebon + nepse + dp + cgt;
  return { broker, sebon, dp, nepse, cgt, total, cgtRate, brokerRate };
}


export { calcNEPSECost };
