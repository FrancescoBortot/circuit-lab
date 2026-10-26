const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../rc-model.js');
const p = overrides => ({ ...M.DEFAULTS, ...overrides });
function close(actual, expected, rel = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= rel * Math.max(Math.abs(expected), 1e-20), `${actual} ≠ ${expected}`);
}

test('charge starts at V0 and reaches 63.212% of the excursion after RC', () => {
  const circuit = p({ mode: 'charge' });
  close(M.at(circuit, 0).vc, 0);
  close(M.at(circuit, .001).vc, 5 * (1 - Math.exp(-1)));
  close(M.at(circuit, .005).vc / 5, 1 - Math.exp(-5));
});
test('nonzero and negative initial voltage obey the general step response', () => {
  const circuit = p({ mode: 'charge', initial: -2, voltage: 3 });
  close(M.at(circuit, 0).vc, -2);
  close(M.at(circuit, .001).vc, 3 - 5 * Math.exp(-1));
});
test('discharge has a closed resistor-to-ground path and negative reference current', () => {
  const circuit = p({ mode: 'discharge', initial: 5 });
  const s = M.at(circuit, .001);
  close(s.source, 0); close(s.vc, 5 * Math.exp(-1));
  close(s.current, -s.vc / circuit.resistance);
});
test('cycle preserves capacitor voltage through switching and reverses current', () => {
  const circuit = p({ switchTime: .0005 });
  const left = M.at(circuit, circuit.switchTime, 'left');
  const right = M.at(circuit, circuit.switchTime);
  close(left.vc, right.vc); close(left.source, 5); close(right.source, 0);
  assert.ok(left.current > 0 && right.current < 0);
  close(M.at(circuit, circuit.switchTime + .001).vc, right.vc / Math.E);
});
test('a short charge pulse discharges from its actual voltage, not the source voltage', () => {
  const circuit = p({ switchTime: 1e-5 });
  const peak = 5 * (1 - Math.exp(-.01));
  close(M.at(circuit, circuit.switchTime).vc, peak);
  close(M.at(circuit, circuit.switchTime + .001).vc, peak / Math.E);
});
test('KVL, capacitor derivative, charge, and energy agree in both phases', () => {
  const circuit = p({ initial: .7 });
  for (const t of [.0002, .002, .0045, .008]) {
    const s = M.at(circuit, t), dt = 1e-9;
    const kvlResidual = s.source - s.vc - s.current * circuit.resistance;
    assert.ok(Math.abs(kvlResidual) < 1e-12 * Math.max(1, Math.abs(s.vc), Math.abs(s.source)));
    close(s.charge, circuit.capacitance * s.vc);
    close(s.energy, .5 * circuit.capacitance * s.vc ** 2);
    close((M.at(circuit, t + dt).vc - M.at(circuit, t - dt).vc) / (2 * dt) * circuit.capacitance, s.current, 1e-7);
  }
});
test('zero excitation and an already settled initial state remain constant', () => {
  for (const t of [0, .001, .01]) {
    close(M.at(p({ mode: 'discharge', initial: 0 }), t).vc, 0);
    close(M.at(p({ mode: 'charge', initial: 5 }), t).vc, 5);
    close(M.at(p({ mode: 'charge', initial: 5 }), t).current, 0);
  }
});
test('charge is numerically stable for very small time steps', () => {
  const s = M.at(p({ mode: 'charge' }), 1e-20);
  close(s.vc, 5e-17, 1e-14);
});
test('changing R or C stretches time by the expected factor', () => {
  close(M.at(p({ mode: 'charge', resistance: 100000 }), .01).vc,
    M.at(p({ mode: 'charge' }), .001).vc);
  close(M.at(p({ mode: 'charge', capacitance: 1e-6 }), .01).vc,
    M.at(p({ mode: 'charge' }), .001).vc);
});
test('a large initial voltage settles accurately to a small nonzero source', () => {
  const circuit = p({ mode: 'charge', initial: 1e6, voltage: 1e-6 });
  close(M.at(circuit, .1).vc, 1e-6);
});
test('plots include one-sided event samples and both interval endpoints', () => {
  const circuit = p({ switchTime: .001234567 });
  const samples = M.sample(circuit);
  close(samples[0].t, 0); close(samples.at(-1).t, circuit.duration);
  const event = samples.filter(s => s.t === circuit.switchTime);
  assert.equal(event.length, 2); close(event[0].vc, event[1].vc);
  assert.equal(event[0].source, 5); assert.equal(event[1].source, 0);
  assert.ok(samples.every((s, i) => !i || s.t >= samples[i - 1].t));
});
test('the sample selector specifies the regular point count, before switch events', () => {
  assert.equal(M.sample(p({ mode: 'charge', samples: 600 })).length, 600);
  assert.equal(M.sample(p({ mode: 'discharge', samples: 1200 })).length, 1200);
});
test('rejects invalid electrical parameters, timing, and project data', () => {
  for (const invalid of [{ resistance: 0 }, { capacitance: -1 }, { voltage: Infinity },
    { duration: 0 }, { samples: 4 }, { switchTime: .02 }, { initial: NaN }, { mode: 'unknown' },
    { resistance: 1e-308, capacitance: 1e308 }]) {
    assert.ok(Object.keys(M.validate(p(invalid))).length > 0);
  }
  assert.throws(() => M.readProject('{broken'));
  assert.throws(() => M.readProject(JSON.stringify({ application: 'Other', version: 1 })));
  const invalid = JSON.parse(M.project(p())); invalid.parameters.resistance = null;
  assert.throws(() => M.readProject(JSON.stringify(invalid)));
});
test('project round-trip preserves physical values and preferred units', () => {
  const circuit = p({ mode: 'discharge', initial: -3, resistance: 4700, autoTime: false });
  const units = { resistance: 1000, capacitance: 1e-9 };
  const saved = M.readProject(M.project(circuit, units));
  assert.deepEqual(saved.parameters, circuit); assert.deepEqual(saved.units, units);
});
test('CSV exports SI values including the event discontinuity', () => {
  const rows = M.csv(p()).replace(/^\uFEFF/, '').split('\r\n');
  assert.match(rows[0], /tempo_s.*corrente_A.*energia_J/);
  const first = rows[1].split(',').map(Number);
  close(first[0], 0); close(first[1], 5); close(first[2], 0); close(first[4], .0005);
  assert.ok(rows.slice(1).every(row => row.split(',').every(value => Number.isFinite(Number(value)))));
});
