<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

PWA identity lives in public/manifest.json; generate /sw.js with vite-plugin-pwa and register only through src/lib/pwa.ts, excluding dev/previews, to avoid stale editor content. Cache only identity assets so authenticated functionality stays unchanged.
