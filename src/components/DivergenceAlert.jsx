import { truncateAddress } from "../lib/utils.js";
import { WarningCircle } from "@phosphor-icons/react";

export default function DivergenceAlert({ divergence }) {
  if (!divergence) return null;

  return (
    <div className="bg-status-suspicious-bg border border-status-suspicious/30 rounded-xl p-5" role="alert">
      <div className="flex items-center gap-2 mb-2">
        <WarningCircle className="text-status-suspicious" size={20} weight="fill" />
        <p className="text-sm font-bold text-status-suspicious uppercase tracking-wider">
          Point of Divergence Detected
        </p>
      </div>
      <p className="text-sm text-slate-700 mb-5 ml-7">
        This batch was transferred to an actor not on the previous custodian's approved list.
      </p>
      <div className="bg-white/60 rounded-lg p-4 ml-7 flex flex-col gap-3">
        <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
          <span className="font-medium text-slate-500">Last authorized custodian</span>
          <span className="text-right text-slate-900 font-mono text-xs">
            {divergence.lastAuthorizedOrg && divergence.lastAuthorizedOrg !== "Unknown Organization"
              ? <><strong className="font-sans font-semibold block">{divergence.lastAuthorizedOrg}</strong></>
              : null
            }
            {truncateAddress(divergence.lastAuthorized)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-slate-500">First unauthorized recipient</span>
          <span className="text-right text-status-suspicious font-mono text-xs">
            {divergence.firstUnauthorizedOrg && divergence.firstUnauthorizedOrg !== "Unknown Organization"
              ? <><strong className="font-sans font-semibold block">{divergence.firstUnauthorizedOrg}</strong></>
              : null
            }
            {truncateAddress(divergence.firstUnauthorized)}
          </span>
        </div>
      </div>
    </div>
  );
}
