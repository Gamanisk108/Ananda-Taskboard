import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import emojiRegex from 'emoji-regex'
import { defineConfig, globalIgnores } from 'eslint/config'

// Design hard-rule #5: UI icons must be line-art SVG (lucide-react), never emoji.
// This local rule flags emoji/dingbat glyphs in rendered strings (JSX text, string
// literals, template chunks) so a stray ⚙️/📋/✕/✓ can't sneak back into the chrome.
// Genuinely-decorative or design-sanctioned emoji are listed in `allow` below — the
// single place that documents which emoji are intentional (e.g. 👥 for groups, which
// Claude Design itself uses). Add to `allow` rather than sprinkling eslint-disable.
const noEmojiIcon = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow emoji as UI icons; use a lucide-react line-art icon instead.' },
    schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: {
      emoji: 'Emoji "{{ch}}" rendered as UI — use a lucide-react line-art icon (design rule #5). If it is intentional/decorative, add it to the `allow` list in eslint.config.js.',
    },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? [])
    // emoji-regex handles full emoji (incl. ZWJ sequences, skin tones, flags).
    // The extra set catches symbol/dingbat glyphs we converted to icons
    // (✓ ✔ ✕ ✖ ✗ ↻ ↺ ↔) that are NOT classified as emoji.
    const extraGlyphs = /[✓✔✕✖✗↻↺↔]/u
    const report = (node, ch) => context.report({ node, messageId: 'emoji', data: { ch } })
    const check = (node, text) => {
      if (!text) return
      for (const m of text.matchAll(emojiRegex())) {
        if (!allow.has(m[0])) { report(node, m[0]); return }
      }
      const g = text.match(extraGlyphs)
      if (g && !allow.has(g[0])) report(node, g[0])
    }
    return {
      JSXText: (n) => check(n, n.value),
      Literal: (n) => { if (typeof n.value === 'string') check(n, n.value) },
      TemplateElement: (n) => check(n, n.value?.raw),
    }
  },
}

export default defineConfig([
  globalIgnores(['dist', 'playwright.config.ts', 'tests/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { local: { rules: { 'no-emoji-icon': noEmojiIcon } } },
    rules: {
      // Per Gordon 2026-06-06: the ONLY allowed emoji are project-picker emoji.
      // 👥 group marker is a "revisit later" exception (design itself uses it; DN7);
      // 🙂 is the EmojiPicker's own default placeholder (the project picker itself).
      // Everything else (🌐 🎉 🧹 🙏 ✅ 📁 📋 …) was converted to lucide line-art.
      'local/no-emoji-icon': ['error', { allow: ['👥', '🙂'] }],
      // Hard UI rule: no native form controls that render browser chrome. Native
      // <select> carets sit too close to the edge (use SingleSelect / MultiSelect,
      // design D2) and native <input type="color"> is a square swatch (use the
      // circular ColorPicker). Self-enforces the no-native-control sweeps. The one
      // sanctioned exception is the custom-color hatch INSIDE ColorPicker, which
      // carries a single documented eslint-disable.
      'no-restricted-syntax': ['error',
        { selector: 'JSXOpeningElement[name.name="select"]', message: 'No native <select> — use SingleSelect / MultiSelect from components/common (design D2: custom popover + caret).' },
        { selector: 'JSXAttribute[name.name="type"][value.value="color"]', message: 'No native <input type="color"> — use the circular ColorPicker from components/common (hard rule: swatch pickers are circles + a recommended palette).' },
      ],
    },
  },
])
