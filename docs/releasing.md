# Releasing

## Local release flow

1. Run `npm run release -- patch|minor|major "notes"`
2. Run `npm run release:tag`
3. Push both commit and tag with `git push origin main --follow-tags`

## GitHub automation

- CI lives in `.github/workflows/ci.yml` and runs on pushes to `main` and pull requests.
- GitHub Releases live in `.github/workflows/release.yml` and trigger when you push a semver tag like `v0.2.1`.
- The release workflow rebuilds the extension, packages `raycast-extension/dist`, and uploads the zip to the GitHub Release page.
