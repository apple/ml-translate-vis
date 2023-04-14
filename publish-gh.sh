rm -rf dist/*
npm run build:github
gh-pages -d dist -t true -m "Deploy $(git log '--format=format:%H' main -1)"