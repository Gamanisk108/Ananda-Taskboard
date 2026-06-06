import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
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
    // Colorful pictographs (📋⚙️🎉…) plus the symbol/dingbat glyphs we converted to
    // icons (✓ ✔ ✕ ✖ ✗ ↻ ↺ ↔), which are NOT \p{Extended_Pictographic}.
    const RE = /\p{Extended_Pictographic}|[✓✔✕✖✗↻↺↔]/gu
    const check = (node, text) => {
      if (!text) return
      for (const m of text.matchAll(RE)) {
        if (!allow.has(m[0])) { context.report({ node, messageId: 'emoji', data: { ch: m[0] } }); break }
      }
    }
    return {
      JSXText: (n) => check(n, n.value),
      Literal: (n) => { if (typeof n.value === 'string') check(n, n.value) },
      TemplateElement: (n) => check(n, n.value?.raw),
    }
  },
}

export default defineConfig([
  globalIgnores(['dist']),
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
      // 👥 group marker (used by Claude Design too), 🌐 Global Overview tab identity,
      // and friendly empty/success accents — all intentional, not chrome icons.
      'local/no-emoji-icon': ['error', { allow: ['👥', '🌐', '🙂', '🎉', '🧹', '🙏', '✅', '📁'] }],
    },
  },
])
