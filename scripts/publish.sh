#!/usr/bin/env bash
# Publish Bolo Khata. NOT RUN YET: every step here makes something public and needs Sakshi's go-ahead.
#
#   scripts/publish.sh github     create public repo sakshi12saboo/bolo-khata and push main
#   scripts/publish.sh vercel     link Vercel project "bolo-khata", set env vars, deploy to production
#   scripts/publish.sh cloudrun   (optional) deploy the same app to Google Cloud Run
#   scripts/publish.sh all        github, then vercel
#
# Secrets are read from the shell environment and piped to the CLIs. They are never echoed or written to disk.
set -euo pipefail
cd "$(dirname "$0")/.."

GH_USER="sakshi12saboo"
REPO="bolo-khata"
VERCEL_PROJECT="bolo-khata"
MODEL="${GEMINI_MODEL:-gemini-3.5-flash}"
GCP_REGION="${GCP_REGION:-asia-south1}"

die() { echo "publish: $*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*"; }

preflight() {
  step "Preflight: clean tree, types, unit tests"
  [ -n "${GEMINI_API_KEY:-}" ] || die "GEMINI_API_KEY is not set in this shell"
  [ -z "$(git status --porcelain)" ] || die "uncommitted changes; commit first"
  npm ci --silent
  npm run typecheck
  npm test
}

github() {
  step "GitHub as $GH_USER (never the active gh account, never switching accounts)"
  GH_TOKEN="$(gh auth token --user "$GH_USER")" || die "no gh token stored for $GH_USER"
  export GH_TOKEN
  [ "$(gh api user --jq .login)" = "$GH_USER" ] || die "token does not belong to $GH_USER"

  if ! gh repo view "$GH_USER/$REPO" >/dev/null 2>&1; then
    gh repo create "$GH_USER/$REPO" --public \
      --description "Bolo Khata: voice-first billing and udhaar ledger for kirana stores (Gemini)"
  fi
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$REPO.git"
  [ "$(git remote get-url origin)" = "https://github.com/$GH_USER/$REPO.git" ] || die "origin points somewhere else"

  # Push with this token only: bypass any stored credential helper (the keychain holds another account).
  local auth
  auth="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')"
  git -c credential.helper= -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $auth" push -u origin main
  unset auth
  gh repo edit "$GH_USER/$REPO" --add-topic kirana --add-topic gemini --add-topic voice --add-topic hackathon >/dev/null
  echo "Repo: https://github.com/$GH_USER/$REPO"
}

vercel_deploy() {
  step "Vercel project $VERCEL_PROJECT"
  vercel whoami
  echo "Check the account above is Sakshi's (sakshi12saboo-2586). Ctrl-C now if not."
  sleep 5
  vercel link --yes --project "$VERCEL_PROJECT" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"}

  step "Env vars (values piped from the shell, not printed)"
  for target in production; do
    vercel env rm GEMINI_API_KEY "$target" --yes >/dev/null 2>&1 || true
    printf '%s' "$GEMINI_API_KEY" | vercel env add GEMINI_API_KEY "$target" >/dev/null
    vercel env rm GEMINI_MODEL "$target" --yes >/dev/null 2>&1 || true
    printf '%s' "$MODEL" | vercel env add GEMINI_MODEL "$target" >/dev/null
  done
  echo "GEMINI_API_KEY and GEMINI_MODEL=$MODEL set for production"

  step "Deploy to production"
  local url
  url="$(vercel deploy --prod --yes)"
  echo "Deployed: $url"

  step "Smoke check the live API"
  curl -fsS -X POST "$url/api/understand" -H 'content-type: application/json' \
    --data '{"text":"aaj kitna becha?","context":{"products":[],"customers":[]}}' | head -c 200
  echo

  step "Put the live link in the README"
  sed -i '' "s#{{APP_URL}}#$url#g" README.md
  git commit -qam "docs: live app link" && echo "README updated; run 'scripts/publish.sh github' again to push it"
}

cloudrun() {
  # Optional: same container on Google Cloud Run (Buildathon scores Google Cloud use). Needs gcloud logged in.
  step "Cloud Run in $GCP_REGION (project: $(gcloud config get-value project 2>/dev/null))"
  gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
  if ! gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
    printf '%s' "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
  else
    printf '%s' "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
  fi
  gcloud run deploy bolo-khata --source . --region "$GCP_REGION" --allow-unauthenticated \
    --set-secrets GEMINI_API_KEY=gemini-api-key:latest --set-env-vars "GEMINI_MODEL=$MODEL" \
    --memory 512Mi --max-instances 3
}

case "${1:-}" in
  github) preflight; github ;;
  vercel) preflight; vercel_deploy ;;
  cloudrun) preflight; cloudrun ;;
  all) preflight; github; vercel_deploy ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
