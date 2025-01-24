---
title: "A Taste of Policies"
date: 2023-08-15T12:34:56-04:00
author: "Luiz Carvalho"
---

In a [previous blog
post](https://conforma.dev/posts/introducing-the-enterprise-contract/), we introduced the
basic concepts of the Enterprise Contract. This time, we explore it further to showcase the usage of
policies.

<!--more-->

{{< conforma-name-preamble >}}

Throughtout this post, we will use a container image from one of the author's side projects. This
image was
[built](https://github.com/lcarva/festoji/blob/848edc452ccbc6d42ec56c2807eef2f49e754c5e/.github/workflows/package.yaml)
in a GitHub Workflow and was signed with the "keyless" sigstore workflow.

```bash
IMAGE=quay.io/lucarval/festoji:latest
```

For posterity, here is the version of the ec CLI used:

```bash
$ ec version
Version            v0.1.1857-b8f0da8
Source ID          b8f0da8848c5230a46dc62e5aa3eab77b0085d75
Change date        2023-08-08 15:05:57 +0000 UTC (6 days ago)
ECC                v0.0.0-20230725143429-4731fc7d3b41
OPA                v0.55.0
Conftest           v0.44.1
Cosign             N/A
Sigstore           v1.7.1
Rekor              v1.2.2-0.20230530122220-67cc9e58bd23
Tekton Pipeline    v0.47.0
Kubernetes Client  v0.27.4
```

The most basic verification we can do on this image is to verify its signature and signed SLSA
Provenance were created by the expected identity:

```bash
$ ec validate image --policy '' --image $IMAGE \
  --certificate-identity-regexp='https:\/\/github\.com\/(slsa-framework\/slsa-github-generator|lcarva\/festoji)\/' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
  --output yaml
```

A regular expression is needed for the certificate identity because the signature and the signed
SLSA Provenance were created by different identities.

## Adding a Policy

The verification above is useful, but we want more. We want to apply policy rules to the signature
and to the SLSA Provenance. We also want to more easily specify the values for the certificate
flags. Let's create a policy!

```yaml
---
identity:
  subjectRegExp: >-
    https:\/\/github\.com\/(slsa-framework\/slsa-github-generator|lcarva\/festoji)\/
  issuer: https://token.actions.githubusercontent.com

sources:
  - policy:
      - github.com/enterprise-contract/ec-policies//policy/lib
      - github.com/enterprise-contract/ec-policies//policy/release
    ruleData:
      allowed_gh_workflow_repos:
        - lcarva/festoji
      allowed_gh_workflow_refs:
        - refs/heads/master
      allowed_gh_workflow_names:
        - Package
      allowed_gh_workflow_triggers:
        - push

configuration:
  include:
    - github_certificate
```

This policy moves the certificate flags to the policy itself. It also specifies certain policy rules
to be executed. Here we are including some of the existing Enterprise Contract policy rules,
[github_certificate](https://conforma.dev/docs/ec-policies/release_policy.html#github_certificate_package).
These policy rules rely on certain data to be provided, e.g. the expected GitHub Workflow
repository. With this policy saved as `policy.yaml`, we can simplify how the CLI is invoked:

```bash
$ ec validate image --policy 'policy.yaml' --image $IMAGE --info --output yaml
```

The `--info` flag is used to display additional information about the policy rules, such as their
descriptions.

We can tweak the values of the `ruleData` in the policy to see what a failure would look like:

```yaml
violations:
- metadata:
    code: github_certificate.gh_workflow_name
    description: Check if the value of the GitHub Workflow Name extension in the
      image signature certificate matches one of the allowed values. Use the rule
      data key "allowed_gh_workflow_names" to specify the list of allowed values.
      An empty allow list, which is the default value, causes this check to succeeded.
    title: GitHub Workflow Name
  msg: 'Name "Package" not in allowed list: ["spam"]'
- metadata:
    code: github_certificate.gh_workflow_ref
    description: Check if the value of the GitHub Workflow Ref extension in the
      image signature certificate matches one of the allowed values. Use the rule
      data key "allowed_gh_workflow_refs" to specify the list of allowed values.
      An empty allow list, which is the default value, causes this check to succeeded.
    title: GitHub Workflow Repository
  msg: 'Ref "refs/heads/master" not in allowed list: ["refs/heads/spam"]'
- metadata:
    code: github_certificate.gh_workflow_repository
    description: Check if the value of the GitHub Workflow Repository extension
      in the image signature certificate matches one of the allowed values. Use
      the rule data key "allowed_gh_workflow_repos" to specify the list of allowed
      values. An empty allow list, which is the default value, causes this check
      to succeeded.
    title: GitHub Workflow Repository
  msg: 'Repository "lcarva/festoji" not in allowed list: ["spam/spam"]'
- metadata:
    code: github_certificate.gh_workflow_trigger
    description: Check if the value of the GitHub Workflow Trigger extension in
      the image signature certificate matches one of the allowed values. Use the
      rule data key "allowed_gh_workflow_triggers" to specify the list of allowed
      values. An empty allow list, which is the default value, causes this check
      to succeeded.
    title: GitHub Workflow Trigger
  msg: 'Trigger "push" not in allowed list: ["spam"]'
```

As you can see, the Enterprise Contract provides a comprehensive list of all the identified
violations.

## Bring Your Own Policy Rules

In addition to the policy rules provide by the Enterprise Contract, it is also possible to use your
own policy rules. The [festoji-policies](https://github.com/lcarva/festoji-policies) git repository
illustrates this. It contains a very simple layout:

```bash
$ tree
.
├── LICENSE
└── policies
    └── github_slsa_provenance.rego

2 directories, 2 files
```

The important bits are in the rego file:

```rego
# METADATA
# title: GitHub SLSA Provenance
# description: >-
#   Verify SLSA Provenance created in GitHub meets requirements.
package festoji.policies.github_slsa_provenance

import future.keywords.contains
import future.keywords.if
import future.keywords.in

# METADATA
# title: Materials
# description: Verify SLSA Provenance materials are correct.
# custom:
#   short_name:  materials
#   failure_msg: Unexpected materials
deny contains result if {
	some att in input.attestations
	match := [material |
		some material in att.statement.predicate.materials
		material.uri == "git+https://github.com/lcarva/festoji@refs/heads/master"
	]
	count(match) == 0
	result := "Unexpected materials"
}
```

This defines a single policy rule that verifies the materials section of the SLSA Provenance contain
the expected git repository. The Enterprise Contract relies on rego annotations to provide
additional information about each of the policy rules. See the
[docs](https://conforma.dev/docs/ec-policies/authoring.html) for more information.

Let's add this rule to our previous policy:

```yaml
---
identity:
  subjectRegExp: >-
    https:\/\/github\.com\/(slsa-framework\/slsa-github-generator|lcarva\/festoji)\/
  issuer: https://token.actions.githubusercontent.com

sources:
  - policy:
      - github.com/enterprise-contract/ec-policies//policy/lib
      - github.com/enterprise-contract/ec-policies//policy/release
    ruleData:
      allowed_gh_workflow_repos:
        - lcarva/festoji
      allowed_gh_workflow_refs:
        - refs/heads/master
      allowed_gh_workflow_names:
        - Package
      allowed_gh_workflow_triggers:
        - push
  # A new policy source group uses the custom policy rules.
  - policy:
    - github.com/lcarva/festoji-policies//policies

configuration:
  include:
    - github_certificate
    - github_slsa_provenance  # Also specify which custom policy rule to include.
```

We can run the ec CLI again with this new policy. The default output should be the same. Let's use
the flag `--show-successes` to ensure the custom policy rule was included:

```bash
$ ec validate image --policy policy.yaml --image $IMAGE --info --output yaml --show-successes
[…]
- metadata:
    code: festoji.policies.github_slsa_provenance.materials
    description: Verify SLSA Provenance materials are correct.
    title: Materials
  msg: Pass
- metadata:
    code: github_certificate.gh_workflow_extensions
    description: Check if the image signature certificate contains the expected
      GitHub extensions. These are the extensions that represent the GitHub workflow
      trigger, sha, name, repository, and ref.
    title: GitHub Workflow Certificate Extensions
  msg: Pass
- metadata:
    code: github_certificate.gh_workflow_name
    description: Check if the value of the GitHub Workflow Name extension in the
      image signature certificate matches one of the allowed values. Use the rule
      data key "allowed_gh_workflow_names" to specify the list of allowed values.
      An empty allow list, which is the default value, causes this check to succeeded.
    title: GitHub Workflow Name
  msg: Pass
[…]
```

Success!

## Takeaway

If there is one thing I would like you to takeaway from this blog post is that defining your policy
for verifying images in a single file is very powerful. This is effectively the "contract" in
Enterprise Contract. You can add it to a git repository to have a formal review process while
keeping an audit trail as well as use it as the source of truth for different teams in your
organization. (Is PolicyOps a thing?!)
