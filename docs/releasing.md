# Releasing

## GitHub automation

- CI lives in `.github/workflows/ci.yml` and runs on pushes to `main` and pull requests.
- GitHub Releases live in `.github/workflows/release.yml` and trigger on every push to `main`.
- The release workflow computes a version in `vYYYY.M.N` form.
- `YYYY.M` comes from the current UTC year and month.
- `N` auto-increments within that month based on existing tags.
- The release workflow rebuilds the extension, creates the tag, packages `raycast-extension/dist`, and uploads the zip to the GitHub Release page.

## Raycast Store publishing

Public Raycast Store publishing is intentionally a local semi-automatic step:

```bash
npm run publish:store
```

That delegates to `npm run publish` inside `raycast-extension`, which uses Raycast's official publish flow to open or update a PR in `raycast/extensions`.

This is not handled by GitHub Actions because public store publishing still requires Raycast's publish CLI flow plus store review.
