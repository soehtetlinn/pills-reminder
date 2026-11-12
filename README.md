# ဆေးနှင့် အစားအစာ အချိန်ဇယား (Medication & Meal Routine Tracker)

A Burmese-language daily medication and meal tracker. Static site, no build step on deploy:

- `index.html` – markup, `app.js` – all behaviour, `tailwind.css` – prebuilt styles
- `sw.js`, `manifest.webmanifest`, `icons/` – installable PWA, offline, mobile notifications
- `firebase-config.js`, `firestore.rules` – Google login and sync across devices

When `firebase-config.js` holds a config, nothing is shown until the user signs in with Google.
Signing out wipes the copy of the data kept on that device.

## Styles

`tailwind.css` is generated. After changing class names in `index.html` or `app.js`, rebuild it:

```bash
npx tailwindcss@3.4.17 -c build/tailwind.config.js -i build/input.css -o tailwind.css --minify
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

## Deploy to Netlify

Connect the GitHub repository in Netlify. No build command is needed; the publish directory is the
repository root (already set in `netlify.toml`).

## Google login and sync (optional)

Sync across devices uses Firebase (Google sign-in + Firestore). It stays off until
`firebase-config.js` is filled in:

1. Create a Firebase project and add a Web app; copy its config into `firebase-config.js`.
2. Authentication → Sign-in method → enable Google.
3. Authentication → Settings → Authorized domains → add the site's domain(s).
4. Firestore Database → create a database, then paste `firestore.rules` into the Rules tab.

## Notes

- Data (times, daily log) is stored in the browser's `localStorage` on the device only.
- Reminders fire while the page is open in a browser tab; there is no push server.
- The app is a reminder aid and does not replace a doctor's instructions.
