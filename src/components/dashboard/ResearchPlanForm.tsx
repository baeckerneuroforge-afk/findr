"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  Field,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
} from "@/components/ui/Field";
import {
  TopicEditor,
  emptyTopicDraft,
  topicDraftsToResearchTopics,
  type TopicDraft,
} from "./TopicEditor";

/** Client mirror of the server's stimulus-route limits (bucket
 *  research-stimuli). Kept in sync with
 *  app/api/research/plans/[id]/stimulus/route.ts — the route re-validates type,
 *  size and magic-byte signature; this only buys a fast, precise message before
 *  the upload round-trip. */
const STIMULUS_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const STIMULUS_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Status der einmaligen KI-Vision-Analyse eines Bild-Stimulus. Client-Spiegel
 *  von StimulusAnalysisStatus (stimulus-analysis.ts ist server-only und kann
 *  hier nicht importiert werden). Die Analyse läuft SYNCHRON im Upload-Request
 *  der Stimulus-Route — deren Response trägt bereits den finalen Status
 *  ('done' | 'failed' für Bilder, null für Links), kein Polling nötig. */
type StimulusAnalysisStatus = "pending" | "done" | "failed";

/** Defensiver Response-Read (Muster coerceStimulusAnalysisStatus serverseitig):
 *  alles außer den drei bekannten Werten liest als null → kein Badge. */
function coerceAnalysisStatus(raw: unknown): StimulusAnalysisStatus | null {
  return raw === "pending" || raw === "done" || raw === "failed" ? raw : null;
}

/**
 * Form for creating a new research plan. Spirit-spiegelt ManualDealForm:
 * use-client component, useState for form/submitting/error, inline Field
 * helpers, fetch POST to /api/research/plans, redirect to detail on success.
 *
 * KI-LEITFADEN-AFFORDANZ (zusätzlich, optional):
 *   Das Formular hat einen "Leitfaden mit KI generieren"-Block. Er ist
 *   stand-alone und ändert das normale Create-Verhalten NICHT, solange der
 *   Nutzer ihn nicht benutzt. Wenn er ihn benutzt:
 *     1. Titel + Objective müssen ausgefüllt sein.
 *     2. Form legt einen DRAFT-Plan an (POST /api/research/plans mit
 *        den aktuellen Feldern + leeren Topics).
 *     3. Mit dem frischen planId wird POST /[id]/guide aufgerufen — der
 *        Server generiert den Leitfaden + schreibt die Topics direkt in
 *        die DB.
 *     4. UI füllt den TopicEditor mit der gemappten Shape vor (label →
 *        topic, goalLink → intent, probes → hypotheses) — der Nutzer kann
 *        VOR dem finalen Speichern editieren.
 *     5. Der "Create plan"-Button wechselt zu "Save plan" und PATCH'ed
 *        den existierenden Draft (statt einen neuen anzulegen).
 *   Wenn der Nutzer die Affordanz nicht benutzt: alter Pfad, single POST.
 *
 * Der Trade-off: ein Draft wird angelegt SOBALD der Nutzer den Generator
 * benutzt — verlässt er die Seite ohne Save, bleibt der Draft als
 * 'draft'-Status in der Plan-Liste. Bewusst gewählt, weil der API-Vertrag
 * `/[id]/guide` einen planId verlangt (Auth + Ownership) und das die
 * sauberste Brücke zwischen Create-Form und planId-gebundenem Generate
 * ist.
 */

interface FormState {
  title: string;
  objective: string;
  persona: string;
  sampleTarget: string;
  // Visual-Intelligence opt-in. Default OFF. Sent as `visualCaptureEnabled`
  // (exact key) in the create/update body — the backend flag + interview-gate
  // already exist; this form only fills the value.
  visualCaptureEnabled: boolean;
  // Interaction mode. Default Text (false). Sent as `voiceEnabled` (exact key)
  // in the create/update body — the backend flag + voice route already exist;
  // this form only fills the value. Text fallback always stays available.
  voiceEnabled: boolean;
  // Market-Research use-case subtype. Default general_survey. Sent as `useCase`
  // (exact key) ONLY on the market-research path — the column + Zod enum +
  // interviewer focus-block already exist on main; this form only fills the
  // value and uses it to pick a preset. Discovery never sends it (byte-identical).
  useCase: UseCase;
  // Single stimulus per study (creative_test / concept_test). The asset itself
  // (url + type "image" | "link") is owned by the dedicated stimulus route and
  // mirrored here from its response for the preview; the description is a plain
  // field persisted via the normal create/update body (the Zod schema already
  // accepts it). Defaults: no asset, empty description.
  stimulusUrl: string | null;
  stimulusType: string | null;
  stimulusDescription: string;
  // TTS read-aloud opt-in. Default OFF. Sent as `ttsEnabled` (exact key) in the
  // create/update body — the backend flag + /speak route already exist; this
  // form only fills the value. It's its OWN field, but the UI couples it to
  // voiceEnabled (a read-aloud agent only makes sense once the participant has
  // the mic gesture that unlocks browser autoplay): the switch is disabled in
  // Text mode and switching back to Text clears it.
  ttsEnabled: boolean;
  topics: TopicDraft[];
}

/**
 * Market-Research use-case subtypes. Mirrors the backend `UseCaseSchema` enum
 * EXACTLY (general_survey | brand_research | creative_test | concept_test) — the
 * value is sent under the exact body key `useCase`, so any drift would make Zod
 * strip it silently. The selector lives only on the market-research path.
 */
type UseCase =
  | "general_survey"
  | "brand_research"
  | "creative_test"
  | "concept_test";

const USE_CASES: readonly UseCase[] = [
  "general_survey",
  "brand_research",
  "creative_test",
  "concept_test",
];

/**
 * Reactive methodology note per use-case — purely informational. Rendered
 * read-only under the pill selector; the note explains WHAT the interviewer
 * does differently for this study type. Switching the pill re-reads
 * `form.useCase` and swaps the note in render (NO state write). The i18n keys
 * live in the research.plans namespace, de + en with parity. Market-only —
 * `form.useCase` is fixed `general_survey` on the discovery path, where the
 * note isn't rendered at all.
 */
const METHOD_NOTE_KEY: Record<UseCase, string> = {
  general_survey: "methodNoteGeneral",
  brand_research: "methodNoteBrand",
  creative_test: "methodNoteCreative",
  concept_test: "methodNoteConcept",
};

/** Static, non-localized facet of each use-case preset. The three opening
 *  questions per use-case are localized — see `presetFor`, which pulls
 *  `${topicPrefix}T{1..3}{Label|Intent}` from the research.plans namespace so a
 *  DE user gets DE suggestions and an EN user gets EN ones. */
interface UseCaseMeta {
  /** Preset interaction mode → the form's `voiceEnabled` boolean. */
  voiceEnabled: boolean;
  /** Preset participant target → the form's `sampleTarget` STRING field. */
  sampleTarget: string;
  /** creative_test/concept_test need a stimulus asset (module folgt) → soft
   *  hint badge. NOT a lock — the study can still be created. */
  needsStimulus: boolean;
  /** i18n key for the pill label (research.plans namespace). */
  titleKey: string;
  /** Prefix for the 3 localized preset topics. */
  topicPrefix: string;
}

const USE_CASE_META: Record<UseCase, UseCaseMeta> = {
  general_survey: {
    voiceEnabled: false,
    sampleTarget: "30",
    needsStimulus: false,
    titleKey: "ucGeneralSurveyTitle",
    topicPrefix: "ucGs",
  },
  brand_research: {
    voiceEnabled: false,
    sampleTarget: "40",
    needsStimulus: false,
    titleKey: "ucBrandResearchTitle",
    topicPrefix: "ucBr",
  },
  creative_test: {
    voiceEnabled: true,
    sampleTarget: "25",
    needsStimulus: true,
    titleKey: "ucCreativeTestTitle",
    topicPrefix: "ucCr",
  },
  concept_test: {
    voiceEnabled: false,
    sampleTarget: "30",
    needsStimulus: true,
    titleKey: "ucConceptTestTitle",
    topicPrefix: "ucCo",
  },
};

/**
 * Build the preset slice of the form-state for a use-case. Pure: takes the
 * research.plans translator so the three opening questions are localized. The
 * returned fields are the ONLY ones a card touches — `useCase` plus the three
 * already-existing form fields (voiceEnabled / sampleTarget STRING / topics).
 * Each topic fills BOTH topic + intent so a submit straight after picking a
 * card passes the server-side Zod min-length checks unchanged.
 */
function presetFor(
  useCase: UseCase,
  t: (key: string) => string,
): Pick<FormState, "useCase" | "voiceEnabled" | "sampleTarget" | "topics"> {
  const meta = USE_CASE_META[useCase];
  const topics: TopicDraft[] = [1, 2, 3].map((n) => ({
    topic: t(`${meta.topicPrefix}T${n}Label`),
    intent: t(`${meta.topicPrefix}T${n}Intent`),
    hypotheses: [],
  }));
  return {
    useCase,
    voiceEnabled: meta.voiceEnabled,
    sampleTarget: meta.sampleTarget,
    topics,
  };
}

/** Optional Generator-Inputs — leer wenn ungenutzt. */
interface GenInputs {
  segment: string;
  role: string;
  topicCount: string;
}

const INITIAL_GEN: GenInputs = { segment: "", role: "", topicCount: "" };

/** Shape returned by POST /api/research/plans/[id]/guide — kept inline
 *  here so the UI doesn't import the engine module (which is server-only).
 *  Must match InterviewGuide in src/lib/research/guide-generator.ts. */
interface GeneratedGuide {
  title: string;
  objective: string;
  estimatedMinutes: number;
  topics: Array<{
    id: string;
    label: string;
    goalLink: string;
    mainQuestion: string;
    probes: string[];
  }>;
  screeningQuestions?: string[];
}

const INITIAL_FORM: FormState = {
  title: "",
  objective: "",
  persona: "",
  sampleTarget: "",
  // Default OFF — VI is opt-in per study; an untouched form sends false.
  visualCaptureEnabled: false,
  // Default Text — voice is opt-in per study; an untouched form sends false.
  voiceEnabled: false,
  // Default general_survey. On the market-research path the matching preset is
  // applied at mount (see the lazy useState init); on the discovery path this
  // value is never sent, so the create body stays byte-identical.
  useCase: "general_survey",
  // No stimulus by default. Set via the stimulus route (asset) + this form's
  // description field; only ever touched on the needsStimulus use-cases.
  stimulusUrl: null,
  stimulusType: null,
  stimulusDescription: "",
  // Default OFF — read-aloud is opt-in and only enabled while voice is on.
  ttsEnabled: false,
  // Start with one empty topic so the editor isn't blank — encourages the
  // user to fill at least one in. Empty topics are dropped at submit time.
  topics: [emptyTopicDraft()],
};

/**
 * M3 — the SAME form serves both research areas. `studyType` decides exactly
 * two things: (1) the create payload stamps 'market_research' (omitted for the
 * default product_discovery path → byte-identical discovery create), and (2)
 * the post-create redirect lands in the matching area. Everything else — the
 * fields, the AI guide generator, validation — is shared verbatim.
 */
type FormStudyType = "product_discovery" | "market_research";

export function ResearchPlanForm({
  studyType = "product_discovery",
}: {
  studyType?: FormStudyType;
} = {}) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const isMarket = studyType === "market_research";
  // The two areas share one create form but redirect into their own detail
  // route after save. Discovery → byte-identical to pre-M3.
  const detailBase = isMarket
    ? "/dashboard/market-research"
    : "/dashboard/research-plans";
  // Market-only create-payload key — see createResearchPlan: omitting it on the
  // discovery path keeps that POST body + DB row byte-identical.
  const studyTypePayload = isMarket
    ? ({ studyType: "market_research" } as const)
    : ({} as const);
  // On the market-research path the form opens already reflecting the default
  // card (general_survey): text mode, 3 opening questions, sampleTarget 30. The
  // lazy init runs once, deterministically (same messages on server + client),
  // so there's no effect and no hydration mismatch. Discovery is untouched.
  const [form, setForm] = useState<FormState>(() =>
    isMarket ? { ...INITIAL_FORM, ...presetFor("general_survey", t) } : INITIAL_FORM,
  );
  // Market-only create/update-payload key. On the discovery path it stays `{}`
  // so the POST/PATCH body is byte-identical to pre-selector — exactly the same
  // discipline as studyTypePayload above. Recomputed each render so it always
  // reflects the currently-picked card.
  const useCasePayload = isMarket ? { useCase: form.useCase } : {};
  // Single source for the stimulus-driven UI: true ONLY for creative_test +
  // concept_test. Drives both the VI recommendation hint (below) and the
  // stimulus block. Always false on the discovery path (form.useCase is fixed
  // general_survey there), so everything gated on it stays byte-identical.
  const needsStimulus = USE_CASE_META[form.useCase].needsStimulus;
  // Market-only create/update-payload key for the stimulus description. The
  // asset (url/type) is owned by the stimulus route; only the description rides
  // the normal body — and only on the needsStimulus use-cases, so the discovery
  // (and non-stimulus market) bodies stay byte-identical.
  const stimulusDescriptionPayload = needsStimulus
    ? {
        stimulusDescription:
          form.stimulusDescription.trim() === ""
            ? null
            : form.stimulusDescription.trim(),
      }
    : {};
  // Visual-Intelligence-Empfehlung — reaktiver Read derselben `needsStimulus`-
  // Facette, die die Use-Case-Karten schon tragen (true NUR für creative_test +
  // concept_test). Rein visuell: ändert den VI-Toggle-Default NICHT (bleibt aus)
  // und aktiviert nichts automatisch. Wechselt der Nutzer die Karte, ändert sich
  // form.useCase → der Hinweis erscheint/verschwindet. Auf dem Discovery-Pfad ist
  // form.useCase fix general_survey (needsStimulus false) → immer false → der
  // VI-Block bleibt dort byte-identisch.
  const recommendVisualCapture = needsStimulus;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stimulus block UI-state (transient, not part of the persisted form):
  // `stimulusMode` picks which input is shown, `linkDraft` is the URL field
  // before it's committed, `stimulusBusy` covers the route round-trips, and
  // `stimulusFileRef` lets us clear the file input after each pick (mirrors
  // BrandingSettingsForm).
  const [stimulusMode, setStimulusMode] = useState<"image" | "link">("image");
  const [linkDraft, setLinkDraft] = useState("");
  const [stimulusBusy, setStimulusBusy] = useState(false);
  const [stimulusError, setStimulusError] = useState<string | null>(null);
  // Status der KI-Analyse des aktuellen Bild-Stimulus (transient, gespiegelt
  // aus der Response der Stimulus-Route). 'pending' wird optimistisch beim
  // Start des Bild-Uploads gesetzt (die Analyse läuft synchron in genau diesem
  // Request); die Response überschreibt mit dem finalen Stand. null = kein
  // Badge (Link-Stimulus, entfernt, oder noch nie analysiert).
  const [stimulusAnalysisStatus, setStimulusAnalysisStatus] =
    useState<StimulusAnalysisStatus | null>(null);
  const stimulusFileRef = useRef<HTMLInputElement>(null);
  // Guards ensureDraftPlanId against a concurrency race: the `planId` STATE
  // guard only blocks a second create AFTER setPlanId has flushed, so two
  // callers entering while planId is still null would both POST a draft. This
  // ref holds the in-flight create promise so overlapping callers await the
  // SAME create instead of issuing a second one — independent of React's
  // state-flush timing.
  const draftCreatePromiseRef = useRef<Promise<string> | null>(null);

  // KI-Generator state. `planId` flips the form into edit-mode (PATCH) once
  // a draft has been created via the generator. `lastGuide` is shown as a
  // preview block so the user sees the generated mainQuestion + probes
  // (which the TopicEditor's lossy shape doesn't expose).
  const [genInputs, setGenInputs] = useState<GenInputs>(INITIAL_GEN);
  const [planId, setPlanId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastGuide, setLastGuide] = useState<GeneratedGuide | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** Pick a use-case card: stamp `useCase` AND overlay its preset (mode,
   *  3 opening questions, sampleTarget). Switching cards = a new product, so
   *  the preset overwrites those fields wholesale — title/objective/persona and
   *  the VI/TTS toggles are left exactly as the user has them. Everything the
   *  preset writes stays fully editable afterwards. */
  function applyUseCase(useCase: UseCase) {
    setForm((current) => ({ ...current, ...presetFor(useCase, t) }));
    // The stimulus block is gated on needsStimulus, so switching to a use-case
    // that doesn't need one would hide the block — and its Remove control —
    // while an uploaded asset still lingers on the draft plan (orphan). Switch
    // = new product (same discipline as the preset overwrite above): clear the
    // asset too. DELETE if it reached the server; the typed description is kept
    // (it's decoupled from the asset and not sent for non-stimulus use-cases).
    if (!USE_CASE_META[useCase].needsStimulus && form.stimulusUrl) {
      void handleStimulusRemove();
    }
  }

  function updateGen<K extends keyof GenInputs>(key: K, value: GenInputs[K]) {
    setGenInputs((current) => ({ ...current, [key]: value }));
  }

  /** Voice/Text mode switch. Coupled to TTS: read-aloud only makes sense in
   *  voice mode (where the mic gesture unlocks autoplay), so switching to Text
   *  clears ttsEnabled in the same update. ttsEnabled stays its own field —
   *  this is pure UI coupling, not a field merge. */
  function setVoiceMode(enabled: boolean) {
    setForm((current) => ({
      ...current,
      voiceEnabled: enabled,
      ttsEnabled: enabled ? current.ttsEnabled : false,
    }));
  }

  /** Translates the rich InterviewGuide.topics into TopicDraft[] the existing
   *  editor knows how to render. Lossy on mainQuestion (kept in lastGuide for
   *  the preview block); the agent reads label/goalLink/probes via the
   *  topic/intent/hypotheses mapping already wired in plans-service. */
  function guideTopicsToDrafts(guide: GeneratedGuide): TopicDraft[] {
    return guide.topics.map((t) => ({
      topic: t.label,
      intent: t.goalLink,
      hypotheses: t.probes,
    }));
  }

  /**
   * Ensure a draft plan exists and return its id. The create form has no planId
   * until submit, but two features need one earlier: the AI guide generator and
   * the stimulus upload. Both call this — the FIRST one to run creates the draft
   * (status 'draft' by DB default) and stores its id; later calls reuse it. Once
   * a draft exists, handleSubmit PATCHes it instead of creating a second plan,
   * so there are no orphaned uploads. The create body is byte-identical to the
   * generator's previous inline draft-create (topics:[], sampleTarget:null);
   * needs title + objective ≥ 3 chars (callers validate that first).
   */
  async function ensureDraftPlanId(): Promise<string> {
    if (planId) return planId;
    // Already creating (concurrent caller)? Await the same create, don't POST a
    // second draft. The ref is set/awaited synchronously within this tick, so
    // it closes the window the `planId` state guard leaves open.
    if (draftCreatePromiseRef.current) return draftCreatePromiseRef.current;

    const create = (async () => {
      const createRes = await fetch("/api/research/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          objective: form.objective.trim(),
          topics: [],
          persona: form.persona.trim() === "" ? null : form.persona.trim(),
          sampleTarget: null,
          visualCaptureEnabled: form.visualCaptureEnabled,
          voiceEnabled: form.voiceEnabled,
          ttsEnabled: form.ttsEnabled,
          ...useCasePayload,
          ...studyTypePayload,
        }),
      });
      const createData = (await createRes.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!createRes.ok || !createData.planId) {
        throw new Error(createData.error ?? t("errCreateDraft"));
      }
      setPlanId(createData.planId);
      return createData.planId;
    })();

    draftCreatePromiseRef.current = create;
    try {
      return await create;
    } catch (err) {
      // Let a later attempt retry instead of caching a rejected promise.
      draftCreatePromiseRef.current = null;
      throw err;
    }
  }

  /**
   * "Leitfaden mit KI generieren" handler. Two-stage:
   *   1. If no planId yet → create a draft plan with the current form fields
   *      (empty topics) so we have an id to attach to /[id]/guide.
   *   2. POST /api/research/plans/[id]/guide with goal (= objective) +
   *      segment/role/topicCount. Server generates + writes topics. We
   *      receive the full guide and refresh local state.
   */
  async function handleGenerate() {
    setGenError(null);
    const title = form.title.trim();
    const objective = form.objective.trim();
    if (title.length < 3) {
      setGenError(t("errTitleGen"));
      return;
    }
    if (objective.length < 3) {
      setGenError(t("errObjectiveGen"));
      return;
    }

    // Optional topicCount: empty → engine uses its default (5). Out-of-range
    // is caught client-side so the user sees a precise message.
    let topicCount: number | undefined;
    if (genInputs.topicCount.trim() !== "") {
      const parsed = Number(genInputs.topicCount);
      if (!Number.isInteger(parsed) || parsed < 3 || parsed > 10) {
        setGenError(t("errTopicCount"));
        return;
      }
      topicCount = parsed;
    }

    setGenerating(true);
    try {
      // Stage 1: ensure a draft plan exists (shared with the stimulus upload).
      const currentPlanId = await ensureDraftPlanId();

      // Stage 2: generate the guide on that plan.
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(currentPlanId)}/guide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: objective,
            segment:
              genInputs.segment.trim() === ""
                ? undefined
                : genInputs.segment.trim(),
            role:
              genInputs.role.trim() === "" ? undefined : genInputs.role.trim(),
            topicCount,
            language: "de",
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        guide?: GeneratedGuide;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.guide) {
        const message =
          res.status === 404
            ? tc("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : res.status === 400
                ? (data.error ?? tc("errInvalidRequest"))
                : (data.detail ?? data.error ?? t("errGuideGen"));
        throw new Error(message);
      }

      // Prefill the topic editor + remember the rich guide for the preview.
      update("topics", guideTopicsToDrafts(data.guide));
      setLastGuide(data.guide);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : t("errGuideGen"));
    } finally {
      setGenerating(false);
    }
  }

  /** True once title + objective are long enough to create the draft the
   *  stimulus upload needs. Used for a precise message instead of a server 400. */
  function hasStimulusBasics(): boolean {
    return form.title.trim().length >= 3 && form.objective.trim().length >= 3;
  }

  /** Image branch: validate type + size locally (mirrors the route), ensure a
   *  draft plan exists, then POST the file to /[id]/stimulus. The route returns
   *  { stimulus_url, stimulus_type }; we mirror them into form-state for the
   *  preview. The description is NOT sent here — it rides the normal submit. */
  async function handleStimulusFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStimulusError(null);

    const clearInput = () => {
      if (stimulusFileRef.current) stimulusFileRef.current.value = "";
    };

    if (!STIMULUS_ACCEPTED_TYPES.includes(file.type)) {
      setStimulusError(t("errStimulusType"));
      clearInput();
      return;
    }
    if (file.size > STIMULUS_MAX_BYTES) {
      setStimulusError(t("errStimulusSize"));
      clearInput();
      return;
    }
    if (!hasStimulusBasics()) {
      setStimulusError(t("errStimulusNeedsBasics"));
      clearInput();
      return;
    }

    setStimulusBusy(true);
    // Optimistisch 'pending': die Vision-Analyse läuft synchron in genau
    // diesem Upload-Request. Schlägt der Upload fehl, hat der Server nichts
    // geschrieben (alte Analyse bleibt gültig) → vorherigen Stand wiederherstellen.
    const previousAnalysisStatus = stimulusAnalysisStatus;
    setStimulusAnalysisStatus("pending");
    try {
      const id = await ensureDraftPlanId();
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(id)}/stimulus`,
        { method: "POST", body },
      );
      const data = (await res.json().catch(() => ({}))) as {
        stimulus_url?: string;
        stimulus_type?: string;
        stimulus_analysis_status?: string | null;
        error?: string;
      };
      if (!res.ok || !data.stimulus_url) {
        throw new Error(data.error ?? t("errStimulusUpload"));
      }
      setForm((current) => ({
        ...current,
        stimulusUrl: data.stimulus_url ?? null,
        stimulusType: data.stimulus_type ?? null,
      }));
      // Finaler Stand aus der Response (Analyse lief synchron im Request).
      setStimulusAnalysisStatus(
        coerceAnalysisStatus(data.stimulus_analysis_status),
      );
    } catch (err) {
      setStimulusAnalysisStatus(previousAnalysisStatus);
      setStimulusError(
        err instanceof Error ? err.message : t("errStimulusUpload"),
      );
    } finally {
      setStimulusBusy(false);
      clearInput();
    }
  }

  /** Link branch: validate http(s) locally (mirrors the route's parseHttpUrl),
   *  ensure a draft, then POST the url as JSON. Same response handling as the
   *  image branch. */
  async function handleStimulusLink() {
    setStimulusError(null);
    let normalized: string;
    try {
      const url = new URL(linkDraft.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("scheme");
      }
      normalized = url.toString();
    } catch {
      setStimulusError(t("errStimulusUrl"));
      return;
    }
    if (!hasStimulusBasics()) {
      setStimulusError(t("errStimulusNeedsBasics"));
      return;
    }

    setStimulusBusy(true);
    try {
      const id = await ensureDraftPlanId();
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(id)}/stimulus`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalized }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        stimulus_url?: string;
        stimulus_type?: string;
        stimulus_analysis_status?: string | null;
        error?: string;
      };
      if (!res.ok || !data.stimulus_url) {
        throw new Error(data.error ?? t("errStimulusUpload"));
      }
      setForm((current) => ({
        ...current,
        stimulusUrl: data.stimulus_url ?? null,
        stimulusType: data.stimulus_type ?? null,
      }));
      // Link-Stimulus → Server invalidiert eine alte Bild-Analyse (Status
      // null in der Response) → Badge verschwindet. Spiegelung wie im Bild-Zweig.
      setStimulusAnalysisStatus(
        coerceAnalysisStatus(data.stimulus_analysis_status),
      );
      setLinkDraft("");
    } catch (err) {
      setStimulusError(
        err instanceof Error ? err.message : t("errStimulusUpload"),
      );
    } finally {
      setStimulusBusy(false);
    }
  }

  /** Remove the current ASSET via DELETE. The typed description is intentionally
   *  kept: it's decoupled from the asset (asset = route, description = normal
   *  submit body) and never reaches the server before the final submit, so
   *  there's no server description to "mirror" here — clearing it would only
   *  destroy text the user may want to keep when swapping assets. Falls back to
   *  a local-only clear if no draft exists yet. */
  async function handleStimulusRemove() {
    setStimulusError(null);
    if (!planId) {
      setForm((current) => ({
        ...current,
        stimulusUrl: null,
        stimulusType: null,
      }));
      setStimulusAnalysisStatus(null);
      setLinkDraft("");
      return;
    }
    setStimulusBusy(true);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/stimulus`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(t("errStimulusRemove"));
      setForm((current) => ({
        ...current,
        stimulusUrl: null,
        stimulusType: null,
      }));
      // DELETE räumt serverseitig auch Analyse + Status ab — Badge weg.
      setStimulusAnalysisStatus(null);
      setLinkDraft("");
    } catch (err) {
      setStimulusError(
        err instanceof Error ? err.message : t("errStimulusRemove"),
      );
    } finally {
      setStimulusBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const title = form.title.trim();
    const objective = form.objective.trim();
    if (title.length < 3) {
      setError(t("errTitleShort"));
      return;
    }
    if (objective.length < 3) {
      setError(t("errObjectiveShort"));
      return;
    }

    // Hard requirement: stimulus-driven use-cases (creative_test/concept_test,
    // gated by USE_CASE_META.needsStimulus) cannot be submitted without an
    // uploaded asset. Only the asset (stimulusUrl) is required — the description
    // stays optional. general_survey/brand_research keep needsStimulus=false,
    // and the discovery path fixes form.useCase to a non-stimulus case, so both
    // are unaffected. Safe for the draft-first flow: a set stimulusUrl implies
    // ensureDraftPlanId already ran during upload, so this only gates the final
    // POST/PATCH — it never creates or races a plan itself.
    if (needsStimulus && !form.stimulusUrl) {
      setError(t("errStimulusRequired"));
      return;
    }

    // Optional sampleTarget: empty string -> null. Non-numeric / out-of-range
    // is rejected here so the user sees a precise message instead of a
    // generic 400 from the API's Zod validation.
    let sampleTarget: number | null = null;
    if (form.sampleTarget.trim() !== "") {
      const parsed = Number(form.sampleTarget);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        setError(t("errSampleTarget"));
        return;
      }
      sampleTarget = parsed;
    }

    const topics = topicDraftsToResearchTopics(form.topics);

    setSubmitting(true);
    try {
      // Branch: if the generator already created a draft, PATCH it instead
      // of creating a second plan. Otherwise plain POST as before. The PATCH
      // path mirrors the existing update flow; both end on the same detail
      // redirect.
      if (planId) {
        const res = await fetch(
          `/api/research/plans/${encodeURIComponent(planId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              objective,
              topics,
              persona: form.persona.trim() === "" ? null : form.persona.trim(),
              sampleTarget,
              visualCaptureEnabled: form.visualCaptureEnabled,
              voiceEnabled: form.voiceEnabled,
              ttsEnabled: form.ttsEnabled,
              ...useCasePayload,
              ...stimulusDescriptionPayload,
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? t("errSavePlan"));
        }
        router.push(`${detailBase}/${planId}`);
        return;
      }

      const res = await fetch("/api/research/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          objective,
          topics,
          persona: form.persona.trim() === "" ? null : form.persona.trim(),
          sampleTarget,
          visualCaptureEnabled: form.visualCaptureEnabled,
          voiceEnabled: form.voiceEnabled,
          ttsEnabled: form.ttsEnabled,
          ...useCasePayload,
          ...studyTypePayload,
          ...stimulusDescriptionPayload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!res.ok || !data.planId) {
        throw new Error(data.error ?? t("errCreatePlan"));
      }
      // Hand off to the detail page; status starts as 'draft' there.
      router.push(`${detailBase}/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errCreatePlan"));
    } finally {
      setSubmitting(false);
    }
  }

  // Forschungsziel-Feld als eine Quelle. Auf dem Market-Pfad steht es oben als
  // intent-first Block, auf dem Discovery-Pfad an seiner ursprünglichen Stelle
  // in der Felder-Section — beide rendern dasselbe Feld (gleicher State, gleiche
  // Handler, kein neues Feld), sodass keine Drift entstehen kann.
  const objectiveField = (
    <Field label={t("fldObjective")} required hint={t("objectiveHint")}>
      <textarea
        value={form.objective}
        onChange={(e) => update("objective", e.target.value)}
        placeholder={t("phObjective")}
        rows={3}
        disabled={submitting}
        className={FIELD_TEXTAREA_CLASS}
      />
    </Field>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Intent-first + Studientyp — NUR auf dem Market-Research-Pfad. Discovery
          rendert nichts hiervon (kein Selektor, kein Hinweis, kein vorgezogenes
          Ziel) → Formular dort byte-identisch. Auf dem Market-Pfad wird das
          Forschungsziel als prominenter erster Input nach oben gezogen, danach
          folgt der entbuntete Pill-Selektor + ein reaktiver Methodik-Hinweis. */}
      {isMarket && (
        <>
          {/* 1. Intent-first: das Forschungsziel als prominenter erster Input,
              gerahmt von einer ruhigen Leitfrage. Reiner Re-Use von
              objectiveField — gleiches Feld, gleicher State, kein neues Feld. */}
          <section className="space-y-3">
            <h2 className="text-h2 text-neutral-900">
              {t("marketGoalHeadline")}
            </h2>
            {objectiveField}
          </section>

          {/* 2. Studientyp: aus den vier bunten Kacheln wird eine dezente
              Pill-Zeile. GLEICHE applyUseCase-Logik wie zuvor (steuert
              form.useCase + Preset) — nur die Optik ist ruhiger. */}
          <section className="space-y-3">
            <div>
              <h2 className="text-h3 text-neutral-900">
                {t("ucSelectorTitle")}
              </h2>
              <p className="mt-0.5 text-small text-neutral-500">
                {t("ucSelectorDesc")}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label={t("ucSelectorTitle")}
              className="flex flex-wrap gap-2"
            >
              {USE_CASES.map((uc) => {
                const meta = USE_CASE_META[uc];
                const selected = form.useCase === uc;
                return (
                  <button
                    key={uc}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => applyUseCase(uc)}
                    disabled={submitting || stimulusBusy || generating}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-small outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                      selected
                        ? "border-primary-200 bg-primary-50 font-medium text-primary-700"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                    }`}
                  >
                    {t(meta.titleKey)}
                    {meta.needsStimulus && (
                      <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-caption font-medium leading-none text-primary-700">
                        {t("ucStimulusBadge")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Methodik-Hinweis — additiv & reaktiv. Reiner Read von
                form.useCase über METHOD_NOTE_KEY (KEIN State-Write); wechselt
                beim Pill-Wechsel. Erklärt, was der Interviewer bei diesem
                Studientyp methodisch anders macht. */}
            <p className="rounded-r-md border-l-2 border-primary-600 bg-neutral-50 px-3 py-2 text-caption text-neutral-600">
              {t(METHOD_NOTE_KEY[form.useCase])}
            </p>
          </section>
        </>
      )}

      <section className="space-y-4">
        <Field label={t("fldTitle")} required>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder={t("phTitle")}
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        {/* Forschungsziel — auf dem Discovery-Pfad hier an unveränderter Stelle
            (byte-identisch). Auf dem Market-Pfad steht es bereits oben als
            intent-first Block, daher hier nur, wenn NICHT Market. Gleiche
            objectiveField-Quelle → keine Drift. */}
        {!isMarket && objectiveField}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fldTargetPersona")} hint={t("personaHint")}>
            <textarea
              value={form.persona}
              onChange={(e) => update("persona", e.target.value)}
              placeholder={t("phPersona")}
              rows={2}
              disabled={submitting}
              className={FIELD_TEXTAREA_CLASS}
            />
          </Field>

          <Field label={t("fldSampleTarget")} hint={t("sampleTargetHint")}>
            <input
              value={form.sampleTarget}
              onChange={(e) => update("sampleTarget", e.target.value)}
              placeholder={t("phSampleTarget")}
              inputMode="numeric"
              disabled={submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>

        {/* Visual-Intelligence opt-in (default OFF). Shown for BOTH study
            types — there's no stimulus field in the data model to gate on, so
            the hint sets the expectation that it only helps when participants
            demonstrate on-screen. Writes `visualCaptureEnabled` (exact key) in
            the submit body; the backend flag + interview-gate already exist. */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="block text-body-strong text-neutral-900">
                {t("fldVisualCapture")}
              </span>
              <span className="mt-1 block text-caption text-neutral-500">
                {t("visualCaptureHint")}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-caption text-neutral-500">
                {form.visualCaptureEnabled
                  ? t("visualCaptureOn")
                  : t("visualCaptureOff")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.visualCaptureEnabled}
                aria-label={t("fldVisualCapture")}
                onClick={() =>
                  update("visualCaptureEnabled", !form.visualCaptureEnabled)
                }
                disabled={submitting}
                className={`relative inline-flex h-6 w-11 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                  form.visualCaptureEnabled
                    ? "bg-primary-600"
                    : "bg-neutral-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    form.visualCaptureEnabled
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
          {/* Empfehlungs-Hinweis — NUR bei den Stimulus-Modulen (creative_test /
              concept_test → needsStimulus). Rein visuell/hinweisend: ändert den
              Toggle-Default NICHT (bleibt aus) und aktiviert nichts automatisch.
              Reaktiv an form.useCase gekoppelt via recommendVisualCapture. */}
          {recommendVisualCapture && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50/60 px-3 py-2">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
              <p className="text-caption text-primary-700">
                <span className="font-medium">
                  {t("visualCaptureRecLabel")}:
                </span>{" "}
                {t("visualCaptureRecHint")}
              </p>
            </div>
          )}
        </div>

        {/* Stimulus — NUR bei needsStimulus (creative_test / concept_test).
            Das Asset (Bild/Link) wird über die dedizierte Route an einen
            Draft-Plan gehängt: ist noch keine planId da, legt ensureDraftPlanId
            zuerst die Studie an (braucht Titel + Ziel), dann lädt das Asset
            hoch → keine verwaisten Uploads. Die Beschreibung ist ein normales
            Feld und reist beim Speichern im Body mit. Auf dem Discovery-Pfad
            ist needsStimulus immer false → der Block rendert dort nie. */}
        {needsStimulus && (
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="min-w-0">
              <span className="block text-body-strong text-neutral-900">
                {t("stimulusSectionTitle")}
              </span>
              <span className="mt-1 block text-caption text-neutral-500">
                {t("stimulusSectionDesc")}
              </span>
            </div>

            {/* Aktueller Stimulus — Bild-Thumbnail bzw. Link-Chip + Entfernen.
                Nur sichtbar, wenn ein Asset gesetzt ist (nach Upload bzw. im
                Draft). Ersetzen = einfach erneut hochladen/Link setzen unten. */}
            {form.stimulusUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-2">
                {form.stimulusType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.stimulusUrl}
                    alt={t("stimulusThumbAlt")}
                    className="h-14 w-14 shrink-0 rounded-md border border-neutral-200 bg-white object-contain p-1"
                  />
                ) : (
                  <a
                    href={form.stimulusUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-small text-primary-700 underline underline-offset-2 hover:text-primary-800"
                  >
                    {form.stimulusUrl}
                  </a>
                )}
                <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-caption font-medium leading-none text-neutral-600">
                  {form.stimulusType === "image"
                    ? t("stimulusModeImage")
                    : t("stimulusModeLink")}
                </span>
                <button
                  type="button"
                  onClick={handleStimulusRemove}
                  disabled={stimulusBusy || submitting || generating}
                  className="ml-auto shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-small text-neutral-700 hover:border-neutral-300 disabled:opacity-50"
                >
                  {stimulusBusy ? t("stimulusRemoving") : t("stimulusRemove")}
                </button>
              </div>
            )}

            {/* KI-Analyse-Status (Etappe 2) — nur für Bild-Stimuli. Die Analyse
                läuft synchron im Upload-Request; 'pending' ist der optimistische
                Stand WÄHREND des Uploads, die Response liefert final done/failed.
                Bei null (kein Bild, Link, entfernt): nichts. failed ist bewusst
                dezent (neutral, kein Alarm) — der Stimulus funktioniert im
                Interview auch ohne Analyse; erneutes Hochladen analysiert neu. */}
            {stimulusAnalysisStatus === "pending" && (
              <p className="mt-2 inline-flex items-center gap-2 text-caption text-neutral-500">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
                  aria-hidden="true"
                />
                {t("stimulusAnalysisPending")}
              </p>
            )}
            {stimulusAnalysisStatus === "done" && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-caption font-medium text-success-700">
                  <svg
                    className="h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                  {t("stimulusAnalysisDone")}
                </span>
                <span className="text-caption text-neutral-500">
                  {t("stimulusAnalysisFormDoneHint")}
                </span>
              </p>
            )}
            {stimulusAnalysisStatus === "failed" && (
              <p className="mt-2 text-caption text-neutral-500">
                {t("stimulusAnalysisFailed")}{" "}
                {t("stimulusAnalysisReuploadHint")}
              </p>
            )}

            {/* Umschalter Bild | Link — gleicher Segmented-Control-Stil wie der
                Interaktionsmodus unten. */}
            <div
              role="radiogroup"
              aria-label={t("stimulusSectionTitle")}
              className="mt-3 inline-flex items-center gap-0.5 rounded-full bg-neutral-100 p-0.5"
            >
              {(["image", "link"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={stimulusMode === mode}
                  onClick={() => {
                    setStimulusMode(mode);
                    setStimulusError(null);
                  }}
                  disabled={stimulusBusy || submitting || generating}
                  className={`rounded-full px-3.5 py-1.5 text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                    stimulusMode === mode
                      ? "bg-primary-600 text-white"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {mode === "image"
                    ? t("stimulusModeImage")
                    : t("stimulusModeLink")}
                </button>
              ))}
            </div>

            {/* Eingabe je Modus. Bild: verstecktes File-Input in einem Label
                (spiegelt BrandingSettingsForm) mit lokaler Vorvalidierung.
                Link: URL-Feld + Setzen-Button. */}
            {stimulusMode === "image" ? (
              <div className="mt-3">
                <label
                  className={`inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-body-strong text-neutral-700 ${
                    stimulusBusy || submitting || generating
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer"
                  }`}
                >
                  {stimulusBusy
                    ? t("stimulusImageUploading")
                    : form.stimulusType === "image" && form.stimulusUrl
                      ? t("stimulusReplace")
                      : t("stimulusImageUpload")}
                  <input
                    ref={stimulusFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={stimulusBusy || submitting || generating}
                    onChange={handleStimulusFile}
                    className="sr-only"
                  />
                </label>
                <p className="mt-1.5 text-caption text-neutral-500">
                  {t("stimulusImageHint")}
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      type="url"
                      value={linkDraft}
                      onChange={(e) => setLinkDraft(e.target.value)}
                      placeholder={t("phStimulusLink")}
                      aria-label={t("stimulusLinkLabel")}
                      disabled={stimulusBusy || submitting || generating}
                      className={FIELD_INPUT_CLASS}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleStimulusLink}
                    disabled={
                      stimulusBusy ||
                      submitting ||
                      generating ||
                      linkDraft.trim() === ""
                    }
                  >
                    {stimulusBusy
                      ? t("stimulusLinkSetting")
                      : form.stimulusType === "link" && form.stimulusUrl
                        ? t("stimulusReplace")
                        : t("stimulusLinkSet")}
                  </Button>
                </div>
                <p className="mt-1.5 text-caption text-neutral-500">
                  {t("stimulusLinkHint")}
                </p>
              </div>
            )}

            {/* Beschreibung — fließt in die Fragen des KI-Interviewers. Normales
                Feld; wird beim Speichern über stimulusDescriptionPayload
                mitgesendet (NICHT über die Asset-Route). */}
            <div className="mt-4">
              <Field
                label={t("stimulusDescLabel")}
                hint={t("stimulusDescHint")}
              >
                <textarea
                  value={form.stimulusDescription}
                  onChange={(e) =>
                    update("stimulusDescription", e.target.value)
                  }
                  placeholder={t("phStimulusDesc")}
                  rows={2}
                  disabled={submitting}
                  className={FIELD_TEXTAREA_CLASS}
                />
              </Field>
            </div>

            {/* Pflicht-Hinweis (proaktiv, neben dem Uploader). Hart durchgesetzt
                wird die Pflicht jetzt in handleSubmit (Guard needsStimulus &&
                !stimulusUrl) — ohne Asset ist die Studie nicht absendbar.
                Unkritisch fürs planId-Timing: ein gesetztes stimulusUrl
                impliziert bereits einen Draft (ensureDraftPlanId lief beim
                Upload); der Guard gated nur den finalen POST/PATCH. */}
            {!form.stimulusUrl && (
              <p className="mt-3 rounded-md border border-warning-500/30 bg-warning-50 px-3 py-2 text-caption text-warning-700">
                {t("stimulusRequiredHint")}
              </p>
            )}

            {stimulusError && (
              <p className="mt-2 text-small text-danger-700">{stimulusError}</p>
            )}
          </div>
        )}

        {/* Interaktionsmodus — Text (Default) oder Voice. Sichtbar für BEIDE
            Studientypen (kein study_type-Gate). Schreibt `voiceEnabled` (exakt
            dieser Key) in dieselben Submit-Pfade wie visualCaptureEnabled;
            ein unberührtes Formular sendet false (Text). Der Backend-Flag + die
            Voice-Route existieren bereits — dieses Formular füllt nur den Wert. */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="block text-body-strong text-neutral-900">
                {t("fldInteractionMode")}
              </span>
              <span className="mt-1 block text-caption text-neutral-500">
                {t("interactionModeHint")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("fldInteractionMode")}
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-neutral-100 p-0.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!form.voiceEnabled}
                onClick={() => setVoiceMode(false)}
                disabled={submitting}
                className={`rounded-full px-3.5 py-1.5 text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                  !form.voiceEnabled
                    ? "bg-primary-600 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {t("modeTextLabel")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.voiceEnabled}
                onClick={() => setVoiceMode(true)}
                disabled={submitting}
                className={`rounded-full px-3.5 py-1.5 text-small font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                  form.voiceEnabled
                    ? "bg-primary-600 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {t("modeVoiceLabel")}
              </button>
            </div>
          </div>
        </div>

        {/* Sprachausgabe der KI (TTS) — eigenes Feld `ttsEnabled` (exakt dieser
            Key) in denselben Submit-Pfaden wie voiceEnabled. Produktregel: nur
            im Voice-Modus aktiv (dort gibt es die Mic-Geste, die das Autoplay
            der Browser entsperrt). Im Text-Modus ist der Schalter deaktiviert
            und ein Wechsel auf Text setzt das Feld zurück (siehe setVoiceMode).
            Ein unberührtes Formular sendet false. Der Backend-Flag + die
            /speak-Route existieren bereits — dieses Formular füllt nur den Wert. */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="block text-body-strong text-neutral-900">
                {t("fldTts")}
              </span>
              <span className="mt-1 block text-caption text-neutral-500">
                {form.voiceEnabled ? t("ttsHint") : t("ttsRequiresVoice")}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-caption text-neutral-500">
                {form.ttsEnabled ? t("ttsOn") : t("ttsOff")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.ttsEnabled}
                aria-label={t("fldTts")}
                onClick={() => update("ttsEnabled", !form.ttsEnabled)}
                disabled={submitting || !form.voiceEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                  form.ttsEnabled ? "bg-primary-600" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    form.ttsEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* KI-Leitfaden-Generator — optional, ändert das Standard-Verhalten
          nicht, wenn nicht benutzt. Setzt sich VOR den Topic-Editor, damit
          das Ergebnis direkt sichtbar in die Topic-Liste darunter fließt. */}
      <section className="space-y-3 rounded-lg border border-primary-200 bg-primary-50/40 p-4">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("genTitle")}</h2>
          <p className="mt-0.5 text-small text-neutral-600">{t("genDesc")}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("genFldSegment")} hint={t("genSegmentHint")}>
            <input
              value={genInputs.segment}
              onChange={(e) => updateGen("segment", e.target.value)}
              placeholder={t("phSegment")}
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label={t("genFldRole")} hint={t("genRoleHint")}>
            <input
              value={genInputs.role}
              onChange={(e) => updateGen("role", e.target.value)}
              placeholder={t("phRole")}
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label={t("genFldTopicCount")} hint={t("genTopicCountHint")}>
            <input
              value={genInputs.topicCount}
              onChange={(e) => updateGen("topicCount", e.target.value)}
              placeholder={t("phTopicCount")}
              inputMode="numeric"
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3">
          {genError ? (
            <span className="max-w-md text-caption text-danger-700">
              {genError}
            </span>
          ) : planId ? (
            <span className="text-caption text-neutral-500">
              {t("genStatusDraft")}
            </span>
          ) : (
            <span className="text-caption text-neutral-500">
              {t("genStatusNew")}
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerate}
            disabled={generating || submitting || stimulusBusy}
          >
            {generating
              ? t("genBtnGenerating")
              : planId
                ? t("genBtnRegen")
                : t("genBtn")}
          </Button>
        </div>

        {/* Preview of mainQuestion + screening — TopicEditor's lossy shape
            doesn't show these, but they're the most concrete output of the
            generator. Read-only block, purely informational. */}
        {lastGuide && (
          <div className="space-y-3 border-t border-primary-200/60 pt-3">
            {/* Quality-Bar — ruhiges Trust-Element ÜBER der Leitfaden-Anzeige.
                Statische Aussage über die Interview-Disziplin der Engine (gilt
                für ALLE Studientypen), KEIN Live-Validator des konkreten
                Leitfadens. Die Zeitangabe ist ein reiner Read der Fragenanzahl
                (lastGuide.topics.length = Haupt-/Themenfragen, je 1 pro Topic):
                lo = round(n·1.3), hi = round(n·1.8). Kein State-Write. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-md border border-success-500/30 bg-success-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-success-700">
                {["qualNoLeading", "qualOneQuestion", "qualProbesVague"].map(
                  (key) => (
                    <span key={key} className="inline-flex items-center gap-1.5">
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                      {t(key)}
                    </span>
                  ),
                )}
              </div>
              <span className="text-caption font-medium text-success-700">
                {lastGuide.topics.length} {t("qualMetaQuestions")} · ~
                {Math.round(lastGuide.topics.length * 1.3)}–
                {Math.round(lastGuide.topics.length * 1.8)}{" "}
                {t("qualMetaMinutes")}
              </span>
            </div>
            {/* Split-View: LINKS der generierte Leitfaden, RECHTS eine
                read-only Live-Vorschau der Teilnehmer-Sicht. Die Quality-Bar
                oben bleibt unverändert über dem Split. Auf schmalen Screens
                stapelt die Vorschau unter den Leitfaden (single column). */}
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {/* LINKS — der generierte Leitfaden in ruhigen Karten:
                  Themen-Label + Hauptfrage je Topic. Inhalt unverändert zum
                  bisherigen Preview, nur in die linke Spalte gesetzt. */}
              <div className="space-y-3">
                <p className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                  {t("genPreviewTitle", {
                    count: lastGuide.topics.length,
                    minutes: lastGuide.estimatedMinutes,
                  })}
                </p>
                <ul className="space-y-2">
                  {lastGuide.topics.map((topic) => (
                    <li
                      key={topic.id}
                      className="rounded-md border border-neutral-200 bg-white p-3"
                    >
                      <p className="text-small font-medium text-neutral-900">
                        {topic.label}
                      </p>
                      <p className="mt-1 text-small italic text-neutral-700">
                        „{topic.mainQuestion}"
                      </p>
                    </li>
                  ))}
                </ul>
                {lastGuide.screeningQuestions &&
                  lastGuide.screeningQuestions.length > 0 && (
                    <div>
                      <p className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                        {t("genScreeningTitle")}
                      </p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {lastGuide.screeningQuestions.map((q, i) => (
                          <li key={i} className="text-small text-neutral-700">
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* RECHTS — Teilnehmer-Vorschau. Rein illustrativ & READ-ONLY:
                  KEIN State-Write, KEINE Interview-Engine. Begrüßungs-Bubble +
                  die ERSTE echte Frage aus lastGuide.topics[0].mainQuestion
                  (verbindet die Vorschau mit dem Leitfaden — editiert man den
                  Leitfaden später, zieht die Vorschau automatisch nach) + eine
                  STATISCHE Beispiel-Nachfrage (klar als Beispiel markiert,
                  nicht aus Daten). Sticky auf Desktop. */}
              <div className="lg:sticky lg:top-4">
                <p className="mb-2 text-caption font-medium uppercase tracking-wider text-neutral-500">
                  {t("previewParticipantTitle")}
                </p>
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-caption font-semibold text-white"
                      aria-hidden="true"
                    >
                      KI
                    </span>
                    <span className="text-small font-medium text-neutral-700">
                      {t("previewAiSender")}
                    </span>
                  </div>
                  <div className="space-y-2.5 px-3 py-4">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-small text-neutral-700">
                      {t("previewGreeting")}
                    </div>
                    {lastGuide.topics[0]?.mainQuestion && (
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-white px-3 py-2 text-small text-neutral-800">
                        {lastGuide.topics[0].mainQuestion}
                      </div>
                    )}
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-small text-neutral-500">
                      <span className="mb-1 inline-block rounded-full bg-neutral-200 px-1.5 py-0.5 text-caption font-medium leading-none text-neutral-500">
                        {t("previewExampleBadge")}
                      </span>
                      <span className="block">{t("previewExampleProbe")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2">
                    <span className="flex-1 truncate rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-caption text-neutral-400">
                      {t("previewAnswerPlaceholder")}
                    </span>
                    {form.voiceEnabled && (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600"
                        aria-hidden="true"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                          <path d="M12 18v3" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-caption text-neutral-500">
                  {form.voiceEnabled
                    ? t("previewModeTextVoice")
                    : t("previewModeTextOnly")}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("topicsFormTitle")}</h2>
          <p className="mt-0.5 text-small text-neutral-500">
            {t("topicsFormDesc")}
          </p>
        </div>
        <TopicEditor
          topics={form.topics}
          onChange={(topics) => update("topics", topics)}
          disabled={submitting}
        />
      </section>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || generating || stimulusBusy}>
          {submitting
            ? planId
              ? t("submitSaving")
              : t("submitCreating")
            : planId
              ? t("submitSave")
              : t("submitCreate")}
        </Button>
        <span className="text-small text-neutral-500">
          {planId ? t("submitHelpEdit") : t("submitHelpNew")}
        </span>
      </div>
    </form>
  );
}
