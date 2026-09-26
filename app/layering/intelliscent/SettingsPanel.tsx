"use client";

import type { IntelliScentPrefs } from "@/lib/client/localIntelliScent";
import type { PersonalModel } from "@/lib/intelliscent/personalization";
import { MIN_SAMPLES } from "@/lib/intelliscent/personalization";
import {
  DEFAULT_SETTINGS,
  type IntelliScentSettings,
  type SettingControl,
  type SettingsGroup,
} from "@/lib/intelliscent/settings";

function Control({
  control,
  settings,
  onChange,
}: {
  control: SettingControl;
  settings: IntelliScentSettings;
  onChange: (next: IntelliScentSettings) => void;
}) {
  const inputId = `setting-${control.id}`;

  if (control.kind === "slider") {
    const value = control.get(settings);
    return (
      <div className="param-row">
        <div className="param-row-head">
          <label htmlFor={inputId}>{control.label}</label>
          <span className="param-value">{control.format ? control.format(value) : value}</span>
        </div>
        <input
          id={inputId}
          className="param-slider"
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          onChange={(e) => onChange(control.set(settings, Number(e.target.value)))}
        />
        {(control.minLabel || control.maxLabel) && (
          <div className="param-scale muted" aria-hidden="true">
            <span>{control.minLabel}</span>
            <span>{control.maxLabel}</span>
          </div>
        )}
        {control.description && <p className="muted param-description">{control.description}</p>}
      </div>
    );
  }

  if (control.kind === "multiselect") {
    const selected = control.get(settings);
    const toggle = (value: string) =>
      onChange(control.set(settings, selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]));
    return (
      <div className="param-row">
        <div className="param-row-head">
          <span>{control.label}</span>
        </div>
        <div className="chip-toggle-row" role="group" aria-label={control.label}>
          {control.options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={selected.includes(o.value) ? "chip-toggle is-active" : "chip-toggle"}
              aria-pressed={selected.includes(o.value)}
              onClick={() => toggle(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {control.description && <p className="muted param-description">{control.description}</p>}
      </div>
    );
  }

  const checked = control.get(settings);
  return (
    <div className="param-row">
      <label className="toggle-row" htmlFor={inputId}>
        <input id={inputId} type="checkbox" checked={checked} onChange={(e) => onChange(control.set(settings, e.target.checked))} />
        <span>{control.label}</span>
      </label>
      {control.description && <p className="muted param-description">{control.description}</p>}
    </div>
  );
}

function Group({
  group,
  settings,
  onChange,
}: {
  group: SettingsGroup;
  settings: IntelliScentSettings;
  onChange: (next: IntelliScentSettings) => void;
}) {
  const body = (
    <>
      {group.description && <p className="muted param-description">{group.description}</p>}
      {group.controls.map((c) => (
        <Control key={c.id} control={c} settings={settings} onChange={onChange} />
      ))}
    </>
  );
  if (group.collapsedByDefault) {
    return (
      <details className="settings-group">
        <summary>{group.title}</summary>
        {body}
      </details>
    );
  }
  return (
    <section className="settings-group">
      <h3 className="settings-group-title">{group.title}</h3>
      {body}
    </section>
  );
}

/**
 * The IntelliScent settings menu. Entirely driven by `groups` (the
 * SETTINGS_GROUPS registry) - nothing here knows about specific settings.
 */
export default function SettingsPanel({
  groups,
  settings,
  onChange,
  prefs,
  onPrefsChange,
  personal,
}: {
  groups: readonly SettingsGroup[];
  settings: IntelliScentSettings;
  onChange: (next: IntelliScentSettings) => void;
  prefs: IntelliScentPrefs;
  onPrefsChange: (next: IntelliScentPrefs) => void;
  personal: PersonalModel;
}) {
  return (
    <details className="param-panel" open>
      <summary>
        <span className="param-panel-title">IntelliScent settings</span>
      </summary>
      <div className="param-panel-body">
        {groups.map((g) => (
          <Group key={g.id} group={g} settings={settings} onChange={onChange} />
        ))}

        <section className="settings-group">
          <h3 className="settings-group-title">Personalization</h3>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={prefs.personalization}
              onChange={(e) => onPrefsChange({ ...prefs, personalization: e.target.checked })}
            />
            <span>Learn from my combo ratings</span>
          </label>
          <p className="muted param-description">
            {personal.wearsCount === 0
              ? `Log how combos wear in My Combos. Adjustments kick in after ${MIN_SAMPLES} different combos agree - repeat wears of one combo count once.`
              : `${personal.wearsCount} wear${personal.wearsCount === 1 ? "" : "s"} logged across ${personal.combosCount} combo${personal.combosCount === 1 ? "" : "s"}.`}
          </p>
          {prefs.personalization && personal.adjustments.length > 0 && (
            <ul className="personal-adjustments">
              {personal.adjustments.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" className="link-button" onClick={() => onChange(DEFAULT_SETTINGS)}>
          Reset settings to the framework defaults
        </button>
      </div>
    </details>
  );
}
