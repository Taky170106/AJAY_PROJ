// Headless harness: loads the real <script> from index.html, stubs the DOM,
// runs the AI pipeline and prints its output.
const fs = require('fs');
const vm = require('vm');

// Capture output so we can write a guaranteed-UTF-8 log file (LOGFILE env var).
const __lines = [];
console.log = (...a) => __lines.push(a.join(' '));
process.on('exit', () => {
  const text = __lines.join('\r\n') + '\r\n';
  if (process.env.LOGFILE) fs.appendFileSync(process.env.LOGFILE, text, 'utf8');
  else fs.writeSync(1, text, 'utf8');
});

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function fakeEl(extra = {}) {
  const ctx2d = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : () => {}),
    set: (t, p, v) => { t[p] = v; return true; }
  });
  const store = { dataset: {}, width: 900, height: 230,
    classList: { add(){}, remove(){}, contains(){return false;} },
    getContext: () => ctx2d, ...extra };
  return new Proxy(store, {
    get(t, p) {
      if (p === 'querySelector') return () => fakeEl();
      if (p === 'querySelectorAll') return () => [];
      if (p === 'appendChild' || p === 'addEventListener' || p === 'focus') return () => {};
      if (p === 'scrollTop') return 0;
      if (p in t) return t[p];
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const els = {
  '#scenario': fakeEl({ value: process.argv[2] || 'rising' }),
};
const document = {
  querySelector: s => els[s] || (els[s] = fakeEl()),
  querySelectorAll: () => [],
  createElement: () => fakeEl(),
};
const ctx = vm.createContext({
  document, window: {}, console,
  Math, JSON, String, Number, Array, Object, Set, Map,
  setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0,
});
vm.runInContext(code, ctx, { filename: 'index.html<script>' });

// ---- drive the simulation -------------------------------------------------
const G = e => vm.runInContext(e, ctx);
const S = G('S');
const f1 = G('f1');
const pad = (s, n) => String(s).padEnd(n);

console.log('\n=== AI DOCTOR PROTOTYPE — headless run ===');
console.log('scenario: ' + (els['#scenario'].value) + '\n');
console.log(pad('T+', 7) + pad('Temp °C', 9) + pad('Risk', 6) + pad('Level', 11) +
            pad('Pattern', 14) + pad('Forecast 4h', 13) + pad('Severity', 10) + 'Action');

for (let i = 0; i < 26; i++) {
  ctx.step();
  const action = S.level === 'HIGH' ? 'PAGE CLINICIAN'
              : S.level === 'MODERATE' ? 'FOLLOW-UP Qs' : 'LOG & OBSERVE';
  console.log(
    pad(ctx.stamp(), 7) +
    pad(f1(S.temps[S.temps.length - 1]), 9) +
    pad(S.risk, 6) + pad(S.level, 11) + pad(S.pattern, 14) +
    pad(S.forecast != null ? f1(S.forecast) : '-', 13) +
    pad(S.sev, 10) + action
  );
}

console.log('\n--- Symptom logger: patient submits symptoms ---');
['ache', 'breath'].forEach(id => S.symptoms.add(id));
const temp = S.temps[S.temps.length - 1];
S.risk = ctx.riskScore(temp, S.symptoms);
S.level = ctx.levelOf(S.risk);
const c = ctx.classify(temp, S.symptoms, ctx.forecastTemp(S.temps, 4));
S.sev = c.sev; S.cause = c.cause;
ctx.decide(temp);
console.log('symptoms: Severe body ache + Shortness of breath');
console.log('temp ' + f1(temp) + ' °C  →  risk ' + S.risk + '/100  →  ' + S.level +
            '  →  severity ' + S.sev);

console.log('\n--- Closed-loop alert log (' + S.alerts + ' generated) ---');
S.log.slice(0, 6).forEach(a =>
  console.log('[' + a.level + '] T+' + a.time + '  ' + a.title + '\n         ' + a.msg));

console.log('\n--- Virtual AI Doctor (NLP) ---');
['What should I do if my temperature rises above 102°F?',
 'Do I need a doctor?',
 'my head hurts and I have a fever'].forEach(q => {
  console.log('Patient : ' + q);
  console.log('AI Doctor: ' + ctx.reply(q).replace(/\n/g, '\n           ') + '\n');
});

console.log('--- Clinician triage list (auto-ranked) ---');
const mine = { name: 'You (this device)', age: 31, temp, syms: [...S.symptoms],
               pat: S.pattern, risk: S.risk };
const list = G('SEED_PATIENTS').map(p => ({ ...p, risk: p.risk ?? ctx.riskScore(p.temp, new Set(p.syms)) }))
  .concat([mine]).sort((a, b) => b.risk - a.risk);
console.log(pad('#', 3) + pad('Patient', 20) + pad('Temp', 8) + pad('Pattern', 14) + pad('Risk', 6) + 'Level');
list.forEach((p, i) => console.log(
  pad(i + 1, 3) + pad(p.name, 20) + pad(f1(p.temp), 8) + pad(p.pat, 14) +
  pad(p.risk, 6) + ctx.levelOf(p.risk)));

console.log('\nCloud counters → packets: ' + S.packets + ', inferences: ' + S.inferences +
            ', alerts: ' + S.alerts);
console.log('=== end of run ===\n');


