"use client";

import type { IntelliScentParamDef, IntelliScentParams } from "@/lib/intelliscent/params";

/**
 * The IntelliScent settings menu. Renders one slider per entry in `defs`,
 * so the number and kind of inputs are driven entirely by the param
 * registry (lib/intelliscent/params.ts) - nothing here is param-specific.
 */
export default function ParamPanel({
  defs,
  values,
  onChange,
  onReset,
}: {
  defs: readonly IntelliScentParamDef[];
  values: IntelliScentParams;
  onChange: (next: IntelliScentParams) => void;
  onReset: () => void;
}) {
  return (
    <details className="param-panel" open>
      <summary>
        <span className="param-panel-title">IntelliScent settings</span>
        <span className="muted param-summary">{defs.map((d) => `${d.label} ${values[d.id]}`).join(" · ")}</span>
      </summary>

      <div className="param-panel-body">
        {defs.map((def) => (
          <div key={def.id} className="param-row">
            <div className="param-row-head">
              <label htmlFor={`param-${def.id}`}>{def.label}</label>
              <span className="param-value">{values[def.id]}</span>
            </div>
            <input
              id={`param-${def.id}`}
              className="param-slider"
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={values[def.id]}
              onChange={(e) => onChange({ ...values, [def.id]: Number(e.target.value) })}
            />
            <div className="param-scale muted" aria-hidden="true">
              <span>{def.minLabel}</span>
              <span>{def.maxLabel}</span>
            </div>
            <p className="muted param-description">{def.description}</p>
          </div>
        ))}
        <button type="button" className="link-button" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
    </details>
  );
}
