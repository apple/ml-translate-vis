# Contribution Guide

Thanks for your interest in contributing. This project was released to accompany a research paper for purposes of reproducability, and beyond its publication there are limited plans for future development of the repository.

While we welcome new pull requests and issues please note that our response may be limited. Forks and out-of-tree improvements are strongly encouraged.

## Before you get started

By submitting a pull request, you represent that you have the right to license your contribution to Apple and the community, and agree by submitting the patch that your contributions are licensed under the [LICENSE](LICENSE).

We ask that all community members read and observe our [Code of Conduct](CODE_OF_CONDUCT.md).

## Updating the version

To bump the version of this repository, first make sure everything works, check for lint errors using `npm run check`, and format the code with `npm run format`. Then, run `npm version` to bump the version of the package (please follow [semantic versioning](https://semver.org)). This will update the version in `package.json` and create a new commit tagged with the version number. Then, push the commit and tag with `git push` and `git push --tags`. Finally, create a new release on GitHub with a changelog. To deploy the demo, run `npm run deploy`.