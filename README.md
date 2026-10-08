# Branching Futures

A visual, browser-based learning lab for deterministic decisions, probability,
and generative sampling. One shared story prompt travels through three animated
lanes. Repeated runs accumulate into branching trails, output mosaics, and
readable stories.

**No live AI, API keys, backend, analytics, remote fonts, or runtime dependencies.**
The model and all experiment data stay in the browser.

## Visual presentation

The interface uses the supplied Unum color palette: Blue (`#015294`) for the
primary action, dark Blue (`#004470`) and Slate (`#26495f`) for diagram surfaces,
Pool (`#bbdee1`), Sky (`#a1d3ea`), and Gold (`#fac832`) for the three lanes,
and neutral shades for readable text and boundaries.

Sampled paths, tiles, and story markers share a stable mapping to 27 distinct
palette shades, one per possible story. Color is supplemented by readable
output text and counts. The branded top bar, traditional-versus-AI article,
and site footer are omitted; the toy-model disclosure and walkthrough remain.
The reference image and source presentation are not published with the app.

## Run locally

Requires Node.js 22.18 or newer and a current browser.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally <http://127.0.0.1:5173>.
Installing development tools initially requires an internet connection; running
the installed demo does not.

For an optimized build:

```sh
npm run build
npm run preview
```

The generated `dist/` directory can be hosted on a static web server. Serve it
over HTTP rather than opening the HTML directly as a `file:` URL.

## Deploy to GitHub Pages

The app is a static site: no server-side AI, secrets, or API service is needed.
Relative asset URLs in [vite.config.ts](./vite.config.ts) support both a root
site and a project site such as `https://<owner>.github.io/<repository>/`.
You do not need to hard-code the repository name.

1. Create or choose a GitHub repository and add the app source, including
   `package-lock.json`. Review the files before committing or pushing.
2. In the repository, open **Settings > Pages** and select **GitHub Actions**
   as the build and deployment source.
3. Push the app to `main`, or manually run **Deploy GitHub Pages** from the
   **Actions** tab. If your publishing branch has another name, update the
   branch filter in [the workflow](./.github/workflows/pages.yml).
4. The workflow installs dependencies, runs the model and browser tests, builds
   the app, checks it under a repository-style URL, and uploads **only `dist/`**.
   The deployment job publishes that tested artifact to the `github-pages`
   environment and reports the site URL.

The workflow uses Node.js 24 and official GitHub actions. Repository or
organization policies must permit Pages and the listed actions. Environment
protection rules may require someone to approve deployment. No repository,
remote, or live deployment is created by the local setup.

**Publication boundary:** treat the site and its JavaScript bundle as public
unless approved private Pages access has been explicitly configured. A private
source repository alone is not an access-control guarantee for the website.
Use original synthetic examples, not confidential training content, real case
documents, internal system details, or personal information.

Source PowerPoint files are excluded by [.gitignore](./.gitignore), and the
deployment artifact test rejects presentation files. Keep source slides out of
[public/](./public/): Vite copies that folder into the published build. Ignore
rules do not remove files that were already committed, and the file-extension
check is not a substitute for reviewing the content of the app itself.

To test the production build locally beneath a Pages-style repository path:

```sh
npm run test:pages
```

This builds the app, mounts it at `/branching-futures/` in a temporary preview
server, and verifies asset paths, styling, the favicon, a 50-run experiment,
anchor navigation, reloads, and the absence of source presentations in the
artifact. It does not contact GitHub or publish anything.

See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
for repository setup and deployment permissions.

## A short teaching sequence

1. Choose a curated prompt and press **Run once**. Follow the pulse through the
   three decisions. The rules lane follows a programmed route; the middle lane
   always picks the most likely option; the third makes weighted random draws.
2. Press **Run 50**. The first two lanes repeat their outputs while sampled
   continuations spread across different paths. Counts represent completed
   comparisons, each consisting of one run in every lane.
3. Use **Pause** or **Step one decision** to inspect the conditional probabilities.
   Inspect an earlier decision using the numbered buttons. The context shown
   above the bars is the context for those exact probabilities.
4. Adjust **Temperature** between 0.2 and 2.0. Cooler distributions favor the
   leading option; warmer distributions give alternatives more weight. The
   greedy lane still picks the highest probability.
5. Enable **Lock random seed** and repeat a single run. The same seed, prompt,
   and temperature replay the same choices. A locked batch replays the complete
   random sequence; it does **not** produce one identical sampled answer 50 times.

**Walk me through** provides this explanation inside the app.

Changing the prompt, temperature, seed, or seed-lock setting cancels any
in-flight animation and clears the old experiment. **Reset experiment** clears
results but preserves settings. Repeated run clicks otherwise accumulate results.
The mosaics retain the latest 50 completed comparisons; aggregate counts and
unique outcomes cover the whole current experiment. Invalid seeds are reported
visibly and do not start a run.

The interface supports keyboard navigation and reduced-motion preferences.
With reduced motion enabled, ordinary runs complete immediately; manual stepping
still reveals one decision at a time.

## What the model actually is

The three presets use **hand-authored conditional probability tables**, not a
trained language model. Each story has three decisions, three choices per
decision, and 27 possible complete paths. Each choice is a word or a phrase
chunk, not an actual language-model token.

- **Explicit rules:** a fixed lookup route for the selected prompt. It does not
  consult probabilities or a random number generator.
- **Model + top choice:** normalize the current context's weights and always
  select the maximum. Ties use the first option.
- **Model + sampling:** use the same conditional tables, but sample each choice
  according to its probability. The seed controls a local Mulberry32 generator.
- **Temperature:** probabilities are proportional to `weight ** (1 / T)`,
  evaluated in log space for numerical stability. Displayed percentages are
  rounded; generation uses the unrounded probabilities.

The diagrams merge common choices into three layers. Branch widths show the
conditional probabilities for their incoming contexts. Animated pulses follow
current decisions; colored trails represent completed output sequences.

This explains **output selection**, not how an LLM is trained, reasons, represents
knowledge, or behaves on arbitrary prompts. Real models use far richer context
and a much larger token vocabulary. A displayed probability is not a measure of
truth or correctness. A fixed seed here is a property of this controlled demo,
not a promise of reproducibility from every real-world model API.

Rules vs. learning and deterministic vs. sampled inference are separate
distinctions: traditional ML can output probabilities, and generative models can
use deterministic decoding. The intentionally different fixed-rule and greedy
stories also demonstrate that repeatability does not imply one correct answer.

## Validate

```sh
npm test
npm run build

# One-time browser installation for automated UI tests:
npx playwright install chromium --only-shell
npm run test:e2e
npm run test:pages
```

Unit tests cover normalization, temperature, weighted draws, context-dependent
transitions, seeded replay, invalid inputs, and bounded history. Playwright tests
exercise the actual browser controls, output variation, seed validation, batch
replay, animation cancellation, manual stepping, the walkthrough, mobile layout,
reduced motion, and the absence of external requests or runtime errors.
The Pages suite additionally exercises the built artifact at a repository
subpath. Run the browser suites sequentially; they share the local test-results
directory.

## Source map

- [Story scenarios](./src/scenarios.ts): the three curated worlds and their
  explicitly authored conditional weights.
- [Probability engine](./src/model.ts): pure generation, validation, seeded
  sampling, and experiment history.
- [Visualizations](./src/visualization.ts): SVG branches, trails, and pulses.
- [Interface](./src/main.ts): playback, controls, probability inspection,
  mosaics, and the walkthrough.
- [Styles](./src/style.css): responsive design and reduced-motion behavior.
