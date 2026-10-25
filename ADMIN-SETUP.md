# Landman admin setup

The admin dashboard is designed around the Macho Home Lands concept and now supports persistent listing and portfolio management through the repository-backed API.

Required deployment environment variables:

- `GITHUB_TOKEN`: a token allowed to read and update this repository's contents.
- `ADMIN_PASSWORD`: the password used to enter the admin dashboard.
- `GITHUB_OWNER`: optional, defaults to `joab8291-glitch`.
- `GITHUB_REPO`: optional, defaults to `landmankenya`.
- `GITHUB_BRANCH`: optional, defaults to `main`.

The API stores listing changes in `data/listings.json`, site settings in `data/site-settings.json`, and uploaded images under `images/uploads/`.

The deployment platform must run the `api/` directory as serverless functions. If the site is served as static-only files, the dashboard will display the login page but cannot persist changes until serverless API support and the environment variables are configured.
