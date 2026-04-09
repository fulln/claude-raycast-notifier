# Releasing

## Local release flow

1. Run `npm run release -- patch|minor|major "notes"`
2. Run `npm run release:tag`
3. Push both commit and tag with `git push origin main --follow-tags`

## GitHub automation

- CI lives in `.github/workflows/ci.yml` and runs on pushes to `main` and pull requests.
- GitHub Releases live in `.github/workflows/release.yml` and trigger when you push a semver tag like `v0.2.1`.
- The release workflow rebuilds the extension, packages `raycast-extension/dist`, and uploads the zip to the GitHub Release page.

## Raycast Store publishing

Public Raycast Store publishing is intentionally a local semi-automatic step:

```bash
npm run publish:store
```

That delegates to `npm run publish` inside `raycast-extension`, which uses Raycast's official publish flow to open or update a PR in `raycast/extensions`.

This is not handled by GitHub Actions because public store publishing still requires Raycast's publish CLI flow plus store review.
