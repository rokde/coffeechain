import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default defineConfig(
  globalIgnores([
    'dist',
    'test-results',
    'playwright-report',
    'factory',
    '.claude',
    'src-tauri/target',
    'src-tauri/gen',
  ]),
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    // Spec names the HUD root component Hud.vue.
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    files: ['src/sim/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'three',
                'vue',
                'pinia',
                '**/render',
                '**/render/**',
                '**/ui',
                '**/ui/**',
                '**/app',
                '**/app/**',
              ],
              message: 'src/sim/ stays pure: no Three.js, Vue, Pinia, render/, ui/ or app/.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seedable PRNG in src/sim/rng.ts.' },
      ],
    },
  },
)
