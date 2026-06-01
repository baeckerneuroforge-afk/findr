# Offener Studien-Link — Anti-Abuse v1: Platform-Ebene (WAF + Bot-Schutz)

> Etappe 5, Teil 3 (Plan §3 / §7 E5). **ANLEITUNG, kein Code-Bau.** Diese Maßnahmen
> sitzen auf der **Vercel-Dashboard-/CLI-Ebene**, NICHT im Repo. Sie ergänzen die
> bereits gebaute **strukturelle Bremse** (`max_sessions`-Cap, server-seitig im
> screen-Endpoint, VOR dem Opus-Turn). Reihenfolge der Schutzschichten:
>
> 1. **Vercel Auto-DDoS** — schon an, jedes Projekt, jeder Plan, ohne Config (L3/L4/L7).
> 2. **WAF Rate-Limit-Rule** (dieser Doc, Schritt A) — per-IP-Velocity-Bremse am Edge.
> 3. **`max_sessions`-Cap** (gebaut, E5) — harte per-Link-Mengenbremse vor dem Opus-Turn.
> 4. **Screening** (gebaut, Pflicht) — deterministische Soft-Schranke pro Walk-in.

---

## Warum die WAF-Rule echt gegen Spend schützt (nicht nur Komfort)

**Vercel berechnet KEINE Requests, die von WAF-Rate-Limits/Denies oder DDoS-
Mitigations blockiert werden.** Ein am Edge ge-rate-limiteter Request erreicht die
Function **nie** → es läuft **kein** Code, **kein** `createResearchInterview`,
**kein** Opus-Turn. Die WAF-Rule ist damit selbst eine **Kostenbremse**, komplementär
zum `max_sessions`-Cap: der Cap begrenzt die **Gesamtzahl** Sessions pro Link, die
WAF-Rule begrenzt die **Velocity pro IP** (verhindert, dass ein einzelner Bot den Cap
in Sekunden ausschöpft oder mit Brute-Force-Screening-Versuchen DB-Last erzeugt).

---

## Gehört irgendetwas in `vercel.json`? → NEIN.

WAF-Custom-Rules und Rate-Limits sind **Firewall-Objekte**, verwaltet über das
**Firewall-Dashboard** oder die **`vercel firewall`-CLI** (staged → `publish`). Es gibt
**kein** `vercel.json`-Feld für Rate-Limit-Rules. → **`vercel.json` bleibt unangetastet**
(weiterhin nur die zwei Crons). Genau deshalb ist das eine reine Dashboard-/CLI-Anleitung
und keine Code-Änderung.

---

## Schritt A — WAF Rate-Limit-Rules (KEINE npm-dep, jetzt machbar)

Zwei Pfad-Familien, **disjunkt** (`/interview/open/…` ist die GET-Eintrittsseite;
`/api/interview/open/…` ist der POST-Submit — der teure, Opus-tragende). Method-Scoping,
weil GET (Seitenaufruf, billig) und POST (Submit, kann Opus feuern) unterschiedliche
Limits brauchen.

> **Staged Rollout (verbindlich, wie bei einer Prod-Migration):** erst `log`, Traffic im
> Dashboard prüfen, dann in `preview` blocken, dann in Prod blocken. NIE in einem Schritt
> scharf schalten — Rate-Limits kollidieren öfter mit echten Nutzern als sie aussehen.
> Voraussetzung: `vercel link` (Projekt verknüpft). **Die `add`-Befehle stagen nur** —
> live wird es erst mit `vercel firewall publish` (das führst **du** aus, ich nicht).

### A1 — Submit-Endpoint (POST, der Opus-Pfad): das wichtigste Limit

```bash
# Stage 1 — LOG (blockt nichts, sammelt Daten). Großzügiges Limit zum Tunen.
vercel firewall rules add "OpenLink submit rate-limit" \
  --condition '{"type":"path","op":"pre","value":"/api/interview/open/"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 20 \
  --rate-limit-keys ip \
  --rate-limit-action log \
  --yes
vercel firewall diff           # prüfen
# vercel firewall publish --yes # DU schaltest live
```

Nach Review im Dashboard (`https://vercel.com/<team>/<project>/firewall/traffic?filter=<ruleId>`)
auf scharf stellen — Limit auf ~**10 Requests / 60s / IP**, Aktion `deny` (403):

```bash
vercel firewall rules edit "OpenLink submit rate-limit" \
  --condition '{"type":"path","op":"pre","value":"/api/interview/open/"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --rate-limit-window 60 \
  --rate-limit-requests 10 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --yes
```

> **Begründung 10/min/IP:** ein echter Walk-in submittet 1× (+ ggf. 2–3 Retries nach
> Abweisung). 10/min/IP lässt das locker zu, deckelt aber einen Bot auf max. 10 Opus-
> fähige Versuche/Minute/IP — und die kommen ohnehin erst durch, wenn sie Screening
> bestehen UND der Link unter `max_sessions` ist. Doppelte Bremse.

### A2 — Eintrittsseite (GET, render-only, billig): lockereres Limit

```bash
vercel firewall rules add "OpenLink entry rate-limit" \
  --condition '{"type":"path","op":"pre","value":"/interview/open/"}' \
  --condition '{"type":"method","op":"eq","value":"GET"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 30 \
  --rate-limit-keys ip \
  --rate-limit-action log \
  --yes
# nach Review: --rate-limit-action deny (oder challenge), Limit ~30/60s/IP belassen
```

> Die Prefixe sind disjunkt: `/interview/open/` matcht die Seite, NICHT `/api/interview/open/`
> (das beginnt mit `/api`). Keine Doppel-Matches.

### Wissenswert / Caveats

- **Per-Region-Zähler:** Limits zählen **pro Region**. Bei N aktiven Regionen kann das
  effektive Limit kollektiv um ~N× überschritten werden. Für einen Studien-Link unkritisch
  (der `max_sessions`-Cap ist die globale, region-übergreifende Mengenbremse).
- **`--duration`** (persistenter Block nach erstem Treffer, z. B. `--duration 15m`) ist
  Pro/Enterprise. Oben bewusst weggelassen (per-Request, plan-agnostisch).
- **Verifikation:** mit Observability Plus per `vc metrics vercel.firewall_action.count
  --group-by waf_action --since 24h --format json`; sonst über die Dashboard-Traffic-URL.
- **Alternative zur CLI:** Dashboard → Projekt → **Firewall → Custom Rules** → Rule mit
  Condition `Path` _starts with_ `/api/interview/open/` **und** `Method` _equals_ `POST`,
  Action **Rate Limit** (Window 60s, 10 req, Key IP, on-exceed Deny). Identisch zur CLI.

---

## Schritt B — Managed Bot Protection (KEINE npm-dep, Dashboard-Toggle)

Dashboard → Projekt → **Firewall → Bot Protection** (managed ruleset) aktivieren. Blockt
bekannte/deklarierte Bots anhand von Vercels Signalen, **ohne** Code und **ohne** dep.
Reine Config-Ebene. Für bekannte gute Crawler (Googlebot etc.) nutzt Vercel verifizierte
Bot-Signale statt UA-Strings — keine Gefahr, legitime Unfurler/Monitore zu blocken.

> UA-Substring-Blocks (`bot`, `curl`, `python`, `headless`) hier **vermeiden** — sie
> over-matchen massiv (Monitore, Link-Previewer, Partner-Integrationen). Das managed
> Ruleset ist die saubere, treffsichere Variante.

---

## Schritt C — Vercel BotID auf den Submit → braucht eine dep-Entscheidung (STOP + Report)

**Ehrliche Korrektur zur Plan-Annahme:** Der Plan listet „BotID auf den Submit" als
„platform-level, keine npm-dep". Das stimmt für Schritt A+B (WAF Rate-Limit + managed Bot
Protection). Die **eigentliche BotID-Durchsetzung** (der unsichtbare Kasada-CAPTCHA, der
am Submit hart gated) ist aber **nicht** rein Dashboard:

- Sie verlangt das **first-party `botid`-Paket** (npm-dep) **plus** minimale Verdrahtung:
  einen Client-Provider auf `/interview/open/[token]` und einen `checkBotId()`-Aufruf
  **server-seitig** ganz vorne in `POST /api/interview/open/[token]/screen`.
- Das ist genau die Art „neue dep + Schema/Wiring", die der Plan (§3/§8) und meine
  Arbeits-Leitplanke („Deps vor Einbau verifizieren, bei Unsicherheit STOP + Report,
  nicht auf Verdacht bauen") bewusst aus v1 **heraushalten**.

**Empfehlung:**
1. **Jetzt (kein dep):** Schritt A (Rate-Limit) + Schritt B (managed Bot Protection)
   aktivieren — das schließt das Spend-Tor auf Platform-Ebene zusammen mit dem gebauten
   `max_sessions`-Cap.
2. **Als kleiner Folge-Schritt (deine Entscheidung):** `botid` (first-party, niedriges
   Risiko) hinzufügen + `checkBotId()` im screen-Endpoint vor der Screening-Auswertung.
   Das ist die stärkste Bot-Schranke, ist aber eine **bewusste dep-Aufnahme** — ich baue
   sie **nicht** auf Verdacht. Sag Bescheid, dann scope ich sie als eigene kleine Etappe
   (dep-Check gegen den Stack, Client-Provider, ein `checkBotId()`-Guard, DSGVO-Hinweis).

> Ebenfalls weiterhin **deferred** (Plan §3/§8, braucht Store/dep/Entscheidung): per-IP/
> Fingerprint-**Cooldown** (Upstash/Vercel KV) und **Captcha/Turnstile**. Nicht v1.
