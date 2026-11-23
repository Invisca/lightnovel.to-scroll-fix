# Lightnovel.to Scroll Fix

Tampermonkey userscript for Lightnovel.to that disables automatic next-chapter loading and guards against unexpected scroll-to-top resets.

## Install

1. Install Tampermonkey in your browser and allow it to run on Lightnovel.to.
2. [Install the userscript](https://github.com/Invisca/lightnovel.to-scroll-fix/raw/refs/heads/main/Lightnovel_Reader_Fix.user.js), or paste its contents into a new Tampermonkey script and save.
3. Disable any older Lightnovel position-recovery scripts, then reload the chapter.
4. Use the site's Previous and Next buttons to change chapters.

## How it works

- Sets `cont: false` in the site's `ln-reader-prefs`, preserving appearance settings.
- Filters the reader's one-pixel chapter-loading marker from its `1400px` IntersectionObserver callback.
- Guards numeric `scrollTo(0, 0)` calls from Next.js bundles while already reading farther down the same chapter. Briefly allows resets after explicit input to preserve intentional actions.

## Limitations

Based on the site's reader code captured November 23, 2026. Syntax and isolated behavior checks passed; live Safari behavior still needs verification. This guards scroll resets, not actual document reloads. Changes to the site may require updates. Continuous scroll is intentionally disabled.

## Remove

Disable or delete the script in Tampermonkey and reload. To restore continuous scrolling, turn it back on in the site's reader settings after disabling the script.
