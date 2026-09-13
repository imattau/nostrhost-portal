// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('tailwindcss/plugin')

module.exports = {
  plugins: [
    // A `.link` component class, usable via both a template class and
    // `@apply link` (see components/CustomText.vue) — replaces DaisyUI's
    // `.link` now that DaisyUI is gone.
    plugin(({ addComponents, theme }) => {
      addComponents({
        '.link': {
          color: theme('colors.brand.600'),
          '&:hover': { textDecorationLine: 'underline' },
        },
        '.dark .link': {
          color: theme('colors.brand.400'),
        },
      })
    }),
  ],
  theme: {
    screens: {
      sm: '620px',
      md: '848px',
      lg: '1044px',
      xl: '1240px',
      '2xl': '1436px',
    },
    extend: {
      colors: {
        // Shared with the admin UI redesign (forks/admin) so both surfaces
        // read as one product.
        brand: {
          50: '#f5f0ff',
          100: '#ede5ff',
          200: '#dacaff',
          300: '#c4a8ff',
          400: '#a37bff',
          500: '#8b5cf6',
          600: '#7541db',
          700: '#6134bb',
          800: '#4d2a91',
          900: '#2b1c4a',
        },
        portal: {
          background: 'rgb(var(--portal-background) / <alpha-value>)',
          surface: 'rgb(var(--portal-surface) / <alpha-value>)',
          elevated: 'rgb(var(--portal-elevated) / <alpha-value>)',
          input: 'rgb(var(--portal-input) / <alpha-value>)',
          border: 'rgb(var(--portal-border) / <alpha-value>)',
          foreground: 'rgb(var(--portal-foreground) / <alpha-value>)',
          muted: 'rgb(var(--portal-muted) / <alpha-value>)',
        },
      },
    },
  },
}
