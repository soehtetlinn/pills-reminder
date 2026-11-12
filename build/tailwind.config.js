// Tailwind build settings. Rebuild tailwind.css after changing classes in index.html or app.js:
//   npx tailwindcss@3.4.17 -c build/tailwind.config.js -i build/input.css -o tailwind.css --minify
module.exports = {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans Myanmar"', 'Padauk', '"Myanmar Text"', 'Pyidaungsu', 'system-ui', 'sans-serif'] }
    }
  }
};
