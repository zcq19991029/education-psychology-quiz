# Practice-site project playbook

## Product shape

Build the study flow around the question card. Keep course selection, import, AI settings, usage help, reset, and update actions available from a compact sidebar. Avoid large banners, repeated guidance cards, or decorative panels that push the question below the fold.

Use one responsive shell: a fixed desktop sidebar and a readable mobile layout with labels, not icon-only controls. The visible version belongs in the header on both desktop and mobile. Every interactive control needs a visible pressed, loading, success, or error state.

Offer immersion as a focused mode that hides navigation and auxiliary panels, centers the card at every viewport size, has a labelled exit button, and exits on Escape where the browser supports it. Entering settings or another view must exit immersion first so forms are never squeezed into an unusable layout.

## Question data and imports

Store each question as an object with a stable id, subject, type, stem, ordered options, answer array, and optional source explanation. Support arbitrary option counts rather than assuming A–D. Preserve E and later options during OCR or text parsing.

Separate subject banks. A question imported from a psychology file must never enter the education bank because a filename or source label was guessed incorrectly. Show counts by subject and by question type. Counts must describe the active module rather than an aggregate from all modules.

During import, remove answer keys embedded at the end of a question or copied from an answer section so students are not shown the answer in the stem or an option. Detect malformed boundaries where a subsequent question was appended to the last option. Always present an import preview with editable type and answer fields.

Detect likely duplicates before import using normalized stems and show the source, answer, confidence, and conflict warning. Default to removing true duplicates but let the user retain a question after preview. Do not call a duplicate check “AI detection” unless the application actually makes an AI request; deterministic similarity detection is still useful and should be labelled honestly.

Keep full papers separate when requested: their objective items can enter the practice bank, while original subjective material and reference answers remain a read-only paper view.

## Progress and navigation

Persist browser-local progress by profile, subject, and question type. A refresh must not reset completed totals. Distinguish: total, attempted, unseen, known, remaining, and wrong. “Remaining” must include questions marked for another round. Do not merge single-choice, multiple-choice, and judgment statistics.

Keep history and forward stacks so “previous question” remains available even after marking a question known. Provide a reviewed scope and a known scope. In the known scope, allow the learner to move a remembered question back to remaining without relying on the immediately previous card.

Changing the practice mode is an explicit queue reset. When the learner clicks random practice, rebuild from the current eligible set with a fresh shuffle and do not resume the prior saved random queue; clicking random again must produce another shuffle.

If immersion includes a temporary answer-reveal mode, show the correct option in the existing card without writing attempts, right/wrong results, known status, or local answer overrides. Keep the reveal switch active across next and previous navigation. Its counter should show the current position and the number of questions remaining in the active queue, rather than attempting to merge temporary viewing with historical practice statistics.

Keyboard shortcuts and swipe gestures must be supplemental controls, never the only way to act. For drag interactions, show live horizontal card displacement, animate snap-back when released short of the threshold, and avoid pointer capture or overlays that prevent option clicks. On desktop, mouse drag should match touch drag behavior.

For uncertainty handling, support an option-level long press that visibly marks an item as excluded. Keep exclusion separate from the selected answer and scoring state; it must be reversible and clear when the question card changes.

Theme preferences and optional user-uploaded background images belong in a separate browser-local key from profile progress. Keep the current palette as the default, provide accessible named preset palettes, reject oversized uploads before storing their data URL, and never clear progress when a theme changes. Apply the chosen accent across navigation, selected states, progress and primary actions; image backgrounds should cover the page beneath semi-transparent surfaces, with a user-controlled opacity range and a one-click restore-default action. Do not apply a separate opaque image or fixed gradient to the header: use the same page image beneath its glass layer. Route selected-state fills through the same opacity variable as ordinary surfaces.

Offer a broad preset set rather than only adjacent hues: include a default, cool, purple, warm, pink, red, and a high-contrast monochrome option. Register every preset in the theme-name allowlist, body-class cleanup, CSS variables, soft-color RGB variable, and the visible selector panel so a saved preference always reloads correctly.

An app-provided background image can be a separate optional preset. Ship the asset with the site, leave it unselected by default, and set its first-use surface opacity to 70% while retaining the ordinary opacity slider. When any background image is active, raise the size and weight of header metadata and add a restrained light text shadow so breadcrumb and status copy remains legible over the image.

Theme color must never replace answer-feedback semantics: after submission, correct options and correct analyses stay green; incorrect options and incorrect analyses stay red. Apply the selected theme only to neutral and pre-answer controls.

When adding a theme, audit all visible text and small controls, including breadcrumbs, secondary help text, counts, shortcut panels, navigation buttons, progress labels, and active-tab copy. Theme conversion is incomplete if any of these retain the former palette.

Extend that audit across every workspace, not only the practice card: import forms and previews, AI settings labels and helper text, full-paper lists, learning-overview rows, review navigation, floating AI-question windows, dialogs, and sidebar metadata. Inputs, selects, textareas, placeholders, file-picker labels, and transparent cards must use the selected theme variables while feedback states retain their fixed semantic colors.

## AI configuration and explanation

The app sends AI requests directly from the browser to the selected provider. Explain this in the UI. Keep API keys session-only by default, with an explicit opt-in for persistent local storage. Do not send keys to GitHub or claim cross-device sync.

Do not call AI automatically after every answer. Render a clearly styled button such as “查看 AI 逐项解析”; show a loading state as streaming text arrives; expose useful provider failures such as timeout, balance, model restriction, or invalid key. Put a bounded timeout around test, models-list, and chat requests.

When adding free-form AI follow-up questions, use the same provider, model, and key configured by the learner. A launcher may open a movable floating window so the learner can keep the question card visible. Make the drag handle distinct from the close button, stream the reply into a visible loading message, and include the current question as context. Browser speech recognition should only transcribe into an editable text field; offer normal typing when microphone permission or recognition support is unavailable.

Ask the model for one explanation per option, including every available option letter. Preserve a standard answer and any source explanation even when AI is unavailable.

When independent review disagrees with a bank answer, require a structured AI conclusion with an option letter or an explicit “无法确定”. Present an explicit choice UI: the learner can select which AI option(s) to adopt or keep the bank answer. Persist the chosen correction in a separate browser-local override layer and clearly label it as local-only. Ordinary users must never write the shipped public bank; only an authorized maintainer may review evidence, update repository data, and release a confirmed correction. Never silently replace an answer or guess from an ambiguous review paragraph.

For a maintainer-requested public answer correction, first state an independent judgment based on the stem, options, and relevant subject knowledge, then compare it with the AI review and source evidence. Only after that reasoning agrees should the maintainer-controlled repository answer be changed and released. Record the corrected option explicitly so a request such as “改为 B” cannot be confused with a fallback plan or an instruction to auto-adopt AI output.

Memory aids are optional. For each explanation:

- show `常见口诀｜…` only when the model is confident it is broadly used and accurate;
- show `AI 联想｜…` only for an explicitly labelled, fact-preserving association or pun;
- show a short neutral note when there is no dependable tip, instead of fabricating a rhyme or issuing another forced AI request;
- never assert that a phrase comes from a named commercial institution unless that source was supplied in the project materials.

## Public release and cache

GitHub Pages and browser caches can retain JavaScript, CSS, or JSON after a deployment. Version asset URLs and fetched data with an explicit cache version, use `cache: 'no-store'` for public bank data, and provide a “检查更新” action that reloads the document without clearing localStorage.

The update action should also clear Cache Storage and unregister stale service workers when supported, then reload with a unique query parameter. Keep localStorage, IndexedDB question banks, progress, and theme preferences intact so a cache repair cannot erase study data.

For the current Sites Worker/D1 product, follow the repository scripts and the release procedure in SKILL.md. Documentation-only commits do not stamp or deploy the application. Use the historical stamp-release.mjs and Pages workflow only when explicitly maintaining the older Pages implementation. Confirm the actual production URL and visible version after a product deployment.

## Offline classroom single-file build

When the learner must copy one HTML file to a classroom computer and open it by double-clicking, build a separate portable artifact rather than changing the online module entry point. Inline the stylesheet, bundled application code, and the public question-bank JSON into the HTML. Remove the online Content-Security-Policy meta tag from that artifact because it blocks the inline bootstrap script under `file://`.

Do not bundle optional PDF.js or Mammoth import dependencies into the startup bundle. Older classroom browsers can fail while parsing private class fields in PDF.js, preventing the entire practice app from starting. Mark those vendor modules external during the portable bundle; load them only when the user opens material import. After generating the artifact, launch it with a real `file:///` browser URL and verify that a question card renders, not merely that the file exists or returns HTTP 200. If it remains on “正在加载题目…”, inspect the visible startup error and the browser console before delivering it.

## Common failure modes to prevent

- A stale JSON cache made a newly expanded question bank still display its old count.
- A generic parser merged E into D and copied an answer key into a stem.
- A card-level pointer capture blocked option buttons.
- A secondary AI-tip request looked frozen because it lacked a separate loading state.
- Icon-only mobile sidebar actions were unclear and sometimes visually crowded.
- Immersion mode could leave settings forms compressed until the page exited the mode.
- Hard-coded version strings were inaccurate when release time changed.
- A large announcement, hero, help panel, and statistics block together displaced the core practice card.
