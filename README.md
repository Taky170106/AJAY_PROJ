# AI Doctor — Minimal Prototype

Single-file implementation of the core claimed workflow from the IDF-B disclosure:

**Sensor → Cloud AI → Alert → Clinician Action**

## Run

Option A — just open the file:
```
double-click index.html
```

Option B — local server (already running in this session):
```
http://localhost:8731/
```

## What is implemented

| Tab | Covers disclosure section |
|---|---|
| **Patient Node** | §7.2/§7.5 simulated IoT temperature stream (15-min interval), symptom checklist + Web Speech voice logging, live fever chart with 4-h forecast |
| **Cloud AI Engine** | §7.4 median de-noise, fever-pattern recognition (intermittent / remittent / continuous), multi-modal risk score (temperature + symptoms), sequence forecast (LSTM stand-in), closed-loop alert dispatcher, Table 2 guidance matrix |
| **Clinician Dashboard** | §7.3 auto-ranked triage list, patient detail + insights, alert centre actions (acknowledge / advise / escalate), historical analytics with symptom events |
| **Architecture & TRL** | §7.1 three-tier block diagram, in-scope vs out-of-scope, TRL 3–4 assessment |

## Key logic (all in `index.html`)

- `riskScore(temp, symptoms)` — quantitative temperature term + weighted symptom term, red-flag bonus for fever+rash
- `detectPattern(temps)` — turns/range analysis of the fever curve shape
- `forecastTemp(temps, hours)` — robust linear trend projected 4–6 h ahead (stand-in for LSTM)
- `decide(temp)` — HIGH → clinician page + patient notification; MODERATE → virtual assistant asks follow-up questions before escalation

## Deliberately not included

Physical ESP32/BLE firmware, trained ML weights, real SMS/push gateway, HIPAA-grade backend, persistence.
