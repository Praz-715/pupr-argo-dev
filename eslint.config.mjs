import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/** eslint-config-next 16 sudah menyediakan flat config — tidak perlu FlatCompat. */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      // hasil introspect drizzle, bukan kode tulisan tangan
      'lib/db/schema.ts',
      'lib/db/relations.ts',
      'lib/db/meta/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default eslintConfig
