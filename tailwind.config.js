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
          50: '#eef6ff',
          100: '#dbebff',
          200: '#b8d6ff',
          300: '#85b8ff',
          400: '#4a8cff',
          500: '#1a67f0',
          600: '#0d4fc7',
          700: '#0c3fa0',
          800: '#103682',
          900: '#12306c',
        },
      },
    },
  },
}
