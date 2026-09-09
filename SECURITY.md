# Security Policy

## Supported versions

Security fixes are provided for the latest released version of each actively
maintained package in this repository.

The deprecated `creem_io` SDK is frozen and unsupported, including for security
fixes. Migrate to the maintained [`creem` SDK](./packages/sdk/README.md).

## Report a vulnerability privately

Do not open a public issue, discussion, or pull request for a suspected
vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/armitage-labs/creem/security/advisories/new)
to send the report to the repository's security team. Include, when possible:

- the affected package and version;
- the impact and affected configurations;
- reproduction steps or a minimal proof of concept;
- any known mitigations.

We will coordinate validation, remediation, and disclosure through the private
advisory. We do not publish response-time guarantees, but we will keep reporters
informed as the investigation progresses.

If GitHub private vulnerability reporting is temporarily unavailable, email
[security@creem.io](mailto:security@creem.io) with the subject "Security
vulnerability." Do not include secrets or sensitive exploit details in the
initial email; ask for a secure reporting route.

## Non-security reports

For ordinary defects and documentation problems, use the repository's
[issue forms](https://github.com/armitage-labs/creem/issues/new/choose).
