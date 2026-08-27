import { useState } from "react";
import { SP } from "../../components/common/theme.js";
import { CollapsiblePanel } from "../../components/common/CollapsiblePanel.jsx";
import { Tabs } from "../../components/common/Tabs.jsx";
import { PortfolioSnapshot } from "./PortfolioSnapshot.jsx";
import { PortfolioUpload } from "./PortfolioUpload.jsx";
import { PortfolioTab } from "./PortfolioTab.jsx";
import { OptimalHoldings } from "./OptimalHoldings.jsx";
import { CashAllocator } from "./CashAllocator.jsx";
import { BridgeTrades } from "./BridgeTrades.jsx";

const SUB_TABS = [
  { id: "holdings", label: "Holdings" },
  { id: "optimal", label: "Optimal Holdings" },
  { id: "cash", label: "Cash Allocator" },
  { id: "bridge", label: "Bridge Trades" },
];

// One nav destination for everything portfolio-related. The four tools
// used to each be a separate top-level nav item; they're the same
// components with the same props here, just reached through a secondary
// tab strip so "Portfolio" doesn't cost four rows in the primary nav.
function PortfolioPage({ result, userPortfolioCount, refreshKey, onUploaded }) {
  const [sub, setSub] = useState("holdings");
  return (
    <div>
      <PortfolioSnapshot result={result} />

      <div style={{ marginTop: SP.xl, marginBottom: SP.xl }}>
        <CollapsiblePanel title="Import Portfolio" defaultOpen={userPortfolioCount === 0} right={userPortfolioCount > 0 ? `${userPortfolioCount} holdings on file` : null}>
          <PortfolioUpload onUploaded={onUploaded} />
        </CollapsiblePanel>
      </div>

      <Tabs items={SUB_TABS} active={sub} onChange={setSub} />
      <div className="grid-table-scroll">
        {sub === "holdings" && <PortfolioTab result={result} userPortfolioCount={userPortfolioCount} refreshKey={refreshKey} />}
        {sub === "optimal" && <OptimalHoldings result={result} refreshKey={refreshKey} />}
        {sub === "cash" && <CashAllocator result={result} />}
        {sub === "bridge" && <BridgeTrades result={result} userPortfolioCount={userPortfolioCount} refreshKey={refreshKey} />}
      </div>
    </div>
  );
}

export { PortfolioPage };
