# Is She the Wolf? — Japanese Script Study

Episodes 1–3 of the local Japanese subtitle transcripts, presented as short seven-line lessons. Furigana is generated during preparation and rendered directly on the Japanese script line. The first lesson chunks include hand-written translations and nuance notes; later cues remain available as script rows with compact automatic prompts until they are reviewed.

```sh
cd web
npm install
npm run dev
```

The source `.srt` files are kept in `prepare/sources/srt/`. Progress and display preferences are stored in the browser's local storage.

To rebuild the prepared dataset after changing source subtitles:

```sh
cd prepare
npm install
npm run prepare:data
npm run validate:data
```

The web app lives entirely in `web/`; run its build commands from that directory. The preparation tools write the generated episode JSON into `web/public/data/`.

The current episode and lesson page are shareable through the URL, for example `?episode=02&page=3`. Browser back/forward navigation is supported.

The Vite build uses relative paths (`base: './'`), so serve the contents of `dist/` from the reverse-proxy subdirectory of your choice. Keep the generated `data/` directory alongside `index.html`.
