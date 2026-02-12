/**
 * Tailwind CSS configuration file
 * https://tailwindcss.com/docs/configuration
 *
 * Note: Tailwind CSS v4 does not require a JS file configuration anymore
 * but it's still useful for advanced configuration and IntelliSense support in IDEs.
 */

/**
 * Tailwind CSS v4 configuration
 * Note: In v4, dark mode is configured via CSS (@variant) not JS config
 * @type {import('tailwindcss/tailwind-config')}
 */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
