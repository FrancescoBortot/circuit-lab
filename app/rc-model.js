(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RCModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({ mode: 'cycle', resistance: 10000, capacitance: 1e-7,
    voltage: 5, initial: 0, duration: 0.01, switchTime: 0.004, samples: 1200, autoTime: true });

  function validate(p) {
    const errors = {};
    if (!['charge', 'discharge', 'cycle'].includes(p.mode)) errors.mode = 'Scegli una modalità valida.';
    for (const [key, label] of [['resistance', 'La resistenza'], ['capacitance', 'La capacità'], ['duration', 'La durata']]) {
      if (!Number.isFinite(p[key]) || p[key] <= 0) errors[key] = `${label} deve essere maggiore di zero.`;
    }
    for (const [key, label] of [['voltage', 'La tensione della sorgente'], ['initial', 'La tensione iniziale']]) {
      if (!Number.isFinite(p[key]) || Math.abs(p[key]) > 1e6) errors[key] = `${label} deve essere un numero tra −10⁶ e 10⁶ V.`;
    }
    const maxVoltage = Math.max(Math.abs(p.voltage), Math.abs(p.initial));
    if (Number.isFinite(p.resistance) && p.resistance > 0 && !Number.isFinite(2 * maxVoltage / p.resistance)) {
      errors.resistance = 'La resistenza è troppo piccola per rappresentare la corrente.';
    }
    if (Number.isFinite(p.capacitance) && p.capacitance > 0 && !Number.isFinite(p.capacitance * maxVoltage * maxVoltage)) {
      errors.capacitance = 'La capacità è troppo grande per rappresentare l’energia.';
    }
    const tau = p.resistance * p.capacitance;
    if (!errors.resistance && !errors.capacitance && (!Number.isFinite(tau) || tau < 1e-15 || tau > 1e15)) {
      errors.capacitance = 'Scegli R e C in modo che RC sia tra 10⁻¹⁵ e 10¹⁵ s.';
    }
    if (Number.isFinite(p.duration) && (p.duration < 1e-15 || p.duration > 1e15)) errors.duration = 'La durata deve essere tra 10⁻¹⁵ e 10¹⁵ s.';
    if (p.autoTime && (errors.resistance || errors.capacitance)) delete errors.duration;
    if (p.mode === 'cycle' && !(p.autoTime && (errors.resistance || errors.capacitance)) && (!Number.isFinite(p.switchTime) || p.switchTime <= 0 || p.switchTime >= p.duration)) {
      errors.switchTime = 'La scarica deve iniziare dopo zero e prima della fine.';
    }
    if (!Number.isInteger(p.samples) || p.samples < 100 || p.samples > 10000) errors.samples = 'Scegli tra 100 e 10 000 campioni.';
    return errors;
  }

  function assertValid(p) {
    const errors = validate(p);
    if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
    return p;
  }

  // R, C, time, voltage and current always use SI units internally.
  // side='left' preserves the one-sided limit of current at an ideal switch.
  function at(p, time, side = 'right') {
    const t = Math.max(0, time);
    const tau = p.resistance * p.capacitance;
    let source, vc, phase;
    if (p.mode === 'discharge') {
      source = 0;
      vc = p.initial * Math.exp(-t / tau);
      phase = 'discharge';
    } else if (p.mode === 'cycle' && (t > p.switchTime || (t === p.switchTime && side !== 'left'))) {
      const peak = stepVoltage(p.initial, p.voltage, p.switchTime / tau);
      source = 0;
      vc = peak * Math.exp(-(t - p.switchTime) / tau);
      phase = 'discharge';
    } else {
      source = p.voltage;
      vc = stepVoltage(p.initial, p.voltage, t / tau);
      phase = 'charge';
    }
    const vr = source - vc;
    return { t, source, vc, vr, current: vr / p.resistance,
      charge: p.capacitance * vc, energy: 0.5 * p.capacitance * vc * vc, phase };
  }

  function stepVoltage(initial, final, normalizedTime) {
    // expm1 preserves the small initial excursion; the other form preserves a small final value.
    return normalizedTime < .5
      ? initial + (final - initial) * -Math.expm1(-normalizedTime)
      : final + (initial - final) * Math.exp(-normalizedTime);
  }

  function sample(p, start = 0, end = p.duration, count = p.samples) {
    assertValid(p);
    const times = new Set([start, end]);
    for (let i = 1; i < count - 1; i++) times.add(start + (end - start) * i / (count - 1));
    if (p.mode === 'cycle' && p.switchTime >= start && p.switchTime <= end) times.add(p.switchTime);
    const result = [];
    for (const t of [...times].sort((a, b) => a - b)) {
      if (p.mode === 'cycle' && t === p.switchTime && t > start) result.push(at(p, t, 'left'));
      result.push(at(p, t));
    }
    return result;
  }

  const PREFIXES = [ [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''],
    [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'] ];
  function scale(value, unit) {
    const abs = Math.abs(value);
    const entry = abs === 0 ? [1, ''] : PREFIXES.find(([factor]) => abs >= factor * 0.999999999) || PREFIXES[PREFIXES.length - 1];
    return { value: value / entry[0], factor: entry[0], unit: entry[1] + unit };
  }
  function format(value, unit = '', digits = 3) {
    if (!Number.isFinite(value)) return '—';
    const s = scale(value, unit);
    const number = Number(s.value.toPrecision(digits));
    return `${new Intl.NumberFormat('it-IT', { maximumSignificantDigits: digits }).format(Object.is(number, -0) ? 0 : number)}${s.unit ? ' ' + s.unit : ''}`;
  }
  function csv(p) {
    return '\uFEFF' + ['tempo_s,sorgente_V,condensatore_V,resistore_V,corrente_A,carica_C,energia_J',
      ...sample(p).map(s => [s.t, s.source, s.vc, s.vr, s.current, s.charge, s.energy]
        .map(n => n.toExponential(12)).join(','))].join('\r\n');
  }
  function project(p, units = {}) {
    assertValid(p);
    return JSON.stringify({ application: 'RC Studio', version: 1, parameters: p, units }, null, 2);
  }
  function readProject(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('Il file non contiene un progetto JSON valido.'); }
    if (!parsed || parsed.application !== 'RC Studio' || parsed.version !== 1 || !parsed.parameters) {
      throw new Error('Questo file non è un progetto RC Studio compatibile.');
    }
    const p = Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, parsed.parameters[key]]));
    if (typeof p.autoTime !== 'boolean') throw new Error('L’impostazione del tempo automatico non è valida.');
    assertValid(p);
    return { parameters: p, units: parsed.units || {} };
  }
  return { DEFAULTS, validate, assertValid, at, sample, scale, format, csv, project, readProject };
});
