---
title: "Introducing the Enterprise Contract"
date: 2023-04-24T12:56:35-04:00
---

You may have heard of [sigstore](https://www.sigstore.dev/how-it-works) and its container image
verification tool, [cosign](https://docs.sigstore.dev/cosign/overview/). This blog post introduces a
policy-driven workflow, [Enterprise Contract](https://enterprisecontract.dev/ec/main/index.html),
built on those technologies.

## Before starting…

Let’s say you have an image, `quay.io/lucarval/demo:ec`, and you want to verify this image was signed
and attested by a known and trusted build system. This image was built via
[Tekton](https://tekton.dev/docs/) and was signed and attested by [Tekton
Chains](https://tekton.dev/docs/chains/).

When verifying an image, it is recommended to first resolve the image reference to a digest. This
ensures the same image is being verified across all steps preventing
[TOCTOU](https://en.wikipedia.org/wiki/Time-of-check_to_time-of-use) attacks. There are various
tools that can do this. I’ll use [skopeo](https://github.com/containers/skopeo) since I’m familiar
with it:

```text
$ skopeo inspect --no-tags docker://quay.io/lucarval/demo:ec | jq '.Digest'
"sha256:304040ca1911aa4d911bd7c6d6d07193c57dc49dbc43e63828b42ab204fb1b25"
```

Store the “pinned” image reference in the `IMAGE` environment variable:

```text
IMAGE='quay.io/lucarval/demo:ec@sha256:304040ca1911aa4d911bd7c6d6d07193c57dc49dbc43e63828b42ab204fb1b25'
```

(You may choose to keep the tag in the image reference as well. When both the tag and the digest are
present, the digest should be used by clients.)

For the purpose of this blog post, it is assumed that the image has been signed and attested with a
long-lived key instead of using the [keyless](https://docs.sigstore.dev/cosign/keyless/) workflow.
The public key is:

```text
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZP/0htjhVt2y0ohjgtIIgICOtQtA
naYJRuLprwIv6FDhZ5yFjYUEtsmoNcW7rx2KM6FOXGsCX3BNc7qhHELT+g==
-----END PUBLIC KEY-----
```

Let’s save that into a file called `cosign.pub`.

## Verifying with cosign

The most common way to verify an image is to use cosign. This section highlights the steps involved
in doing so.

We first verify the image has been signed with the expected public key. The build system that built
this image does not integrate with [Rekor](https://docs.sigstore.dev/rekor/overview/) yet, so we
need to skip the transparency log checks.

```text
$ cosign verify --key cosign.pub $IMAGE --insecure-ignore-tlog

Verification for quay.io/lucarval/demo@sha256:304040ca1911aa4d911bd7c6d6d07193c57dc49dbc43e63828b42ab204fb1b25 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
[…]
```

Great, this tells us that the image was indeed built by the expected build system because the image
signature matches the provided public key.

Next, we verify the image contains the expected [SLSA Provenance](https://slsa.dev/provenance/v0.2)
attestation.

```text
$ cosign verify-attestation --type slsaprovenance --key cosign.pub $IMAGE --insecure-ignore-tlog

Verification for quay.io/lucarval/demo@sha256:304040ca1911aa4d911bd7c6d6d07193c57dc49dbc43e63828b42ab204fb1b25 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signatures were verified against the specified public key
[…]
```

The SLSA Provenance contains a lot of useful information about the build process. The cosign
verify-attestation command does offer some support for evaluating its contents with a policy engine.
The current options are [Rego](https://www.openpolicyagent.org/docs/latest/policy-language/) and
[Cue](https://cuelang.org/). Applying policies directly with cosign is possible, but let's introduce
a tool to make it easier and more convenient.

## Verifying with the Enterprise Contract

The steps on the previous section work wonderfully when verifying an image. But what if you want to
validate a group of images? And ensure they all meet the requirements of a certain policy? What if
you want a configuration that can be shared across different teams?

This is where the Enterprise Contract comes into play!

The Enterprise Contract can be evaluated via the
[ec-cli](https://github.com/enterprise-contract/ec-cli). The simplest example involves using an
empty policy:

```text
$ ec validate image --policy '' --rekor-url '' --public-key cosign.pub --image $IMAGE --output yaml

components:
- containerImage: quay.io/lucarval/demo@sha256:304040ca1911aa4d911bd7c6d6d07193c57dc49dbc43e63828b42ab204fb1b25
  name: Unnamed
  signatures:
  - keyid: SHA256:IhiN7gY+Z3uSSd7tmj6w5Zfhqafzdhm3DZjIvGc6iYY
    metadata:
      predicateBuildType: tekton.dev/v1beta1/TaskRun
      predicateType: https://slsa.dev/provenance/v0.2
      type: https://in-toto.io/Statement/v0.1
    sig: MEUCIQDcgZIwEkLFqD7U9HrobgEC8Jo7wm+xJ5AoyO3qg+aj8QIgb9xDpjYGRMmpVk+QATeVKlHonzBiu51HtT3J+lQXPXc=
  - keyid: SHA256:IhiN7gY+Z3uSSd7tmj6w5Zfhqafzdhm3DZjIvGc6iYY
    metadata:
      predicateBuildType: tekton.dev/v1beta1/PipelineRun
      predicateType: https://slsa.dev/provenance/v0.2
      type: https://in-toto.io/Statement/v0.1
    sig: MEYCIQDKSihaAR/zAhJhR5GCqleDvfUUtvRw61vk0YeTBAnOSQIhAKa09B4yEfaSJronmWBFbu5cVPNxm17CMl/PElEz1POa
  success: true
ec-version: v0.1.1294-84267e8
key: |
  -----BEGIN PUBLIC KEY-----
  MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZP/0htjhVt2y0ohjgtIIgICOtQtA
  naYJRuLprwIv6FDhZ5yFjYUEtsmoNcW7rx2KM6FOXGsCX3BNc7qhHELT+g==
  -----END PUBLIC KEY-----
policy:
  publicKey: cosign.pub
success: true
```

The ec-cli has different output formats. I chose the one that displays the full report in YAML
format. From its success, we can tell that the image signature and the image attestations match the
provided public key. We can also see some metadata information about the found attestations.

Let’s take a step further and say we want to validate the SLSA Provenance attestations with a
certain set of policy rules. The [ec-policies](https://github.com/enterprise-contract/ec-policies)
repo has a set of useful rego policies, so let’s use that.

Create a policy file called `policy.yaml` with the following content:

```yaml
sources:
- name: policies
  data:
  - git::github.com/enterprise-contract/ec-policies.git//data?ref=bca7d72
  policy:
  - git::github.com/enterprise-contract/ec-policies.git//policy/lib?ref=bca7d72
  - git::github.com/enterprise-contract/ec-policies.git//policy/release?ref=bca7d72
configuration:
  include:
  - slsa_source_version_controlled
publicKey: |
  -----BEGIN PUBLIC KEY-----
  MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZP/0htjhVt2y0ohjgtIIgICOtQtA
  naYJRuLprwIv6FDhZ5yFjYUEtsmoNcW7rx2KM6FOXGsCX3BNc7qhHELT+g==
  -----END PUBLIC KEY-----
rekorUrl: ""
```

The sources attribute specifies a list of rego policy rules and corresponding [data
sources](https://enterprisecontract.dev/ec-cli/main/configuration.html#_data_sources). Each data and
policy source can be specified via a different set of transports. Here we choose to use them
directly from git.

In configuration, we specify what to include from the sources. (Omit this to include all!) In this
example, the policy rules from the
[slsa_source_version_controlled](https://enterprisecontract.dev/ec-policies/release_policy.html#slsa_source_version_controlled_package)
package are included. Check out the
[docs](https://enterprisecontract.dev/ec-cli/main/configuration.html) for more information.

We can also specify the public key and rekor URL directly in this file. This helps consolidate all
the input parameters required for validating images.

Let’s run the ec-cli again with this policy in place:

```text
ec validate image --policy policy.yaml --image $IMAGE --output yaml --info
```

which resuts in:

```yaml
components:
- containerImage: quay.io/lucarval/demo@sha256:304040ca1911aa4d911bd7c6d6d07193c57dc49dbc43e63828b42ab204fb1b25
  name: Unnamed
  signatures:
  - keyid: SHA256:IhiN7gY+Z3uSSd7tmj6w5Zfhqafzdhm3DZjIvGc6iYY
    metadata:
      predicateBuildType: tekton.dev/v1beta1/TaskRun
      predicateType: https://slsa.dev/provenance/v0.2
      type: https://in-toto.io/Statement/v0.1
    sig: MEUCIQDcgZIwEkLFqD7U9HrobgEC8Jo7wm+xJ5AoyO3qg+aj8QIgb9xDpjYGRMmpVk+QATeVKlHonzBiu51HtT3J+lQXPXc=
  - keyid: SHA256:IhiN7gY+Z3uSSd7tmj6w5Zfhqafzdhm3DZjIvGc6iYY
    metadata:
      predicateBuildType: tekton.dev/v1beta1/PipelineRun
      predicateType: https://slsa.dev/provenance/v0.2
      type: https://in-toto.io/Statement/v0.1
    sig: MEYCIQDKSihaAR/zAhJhR5GCqleDvfUUtvRw61vk0YeTBAnOSQIhAKa09B4yEfaSJronmWBFbu5cVPNxm17CMl/PElEz1POa
  success: true
  successes:
  - metadata:
      code: slsa_source_version_controlled.material_non_git_uri
      collections:
      - minimal
      - slsa2
      - slsa3
      description: Each entry in the predicate.materials array of the attestation
        uses a git URI.
      title: Material from a git repository
    msg: Pass
  - metadata:
      code: slsa_source_version_controlled.material_without_git_commit
      collections:
      - minimal
      - slsa2
      - slsa3
      description: Each entry in the predicate.materials array of the attestation
        includes a SHA1 digest which corresponds to a git commit.
      title: Material with git commit digest
    msg: Pass
  - metadata:
      code: slsa_source_version_controlled.missing_materials
      collections:
      - minimal
      - slsa2
      - slsa3
      description: 'At least one entry in the predicate.materials array of the attestation
        contains the expected attributes: uri and digest.sha1.'
      title: Material format
    msg: Pass
ec-version: v0.1.1294-84267e8
key: |
  -----BEGIN PUBLIC KEY-----
  MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZP/0htjhVt2y0ohjgtIIgICOtQtA
  naYJRuLprwIv6FDhZ5yFjYUEtsmoNcW7rx2KM6FOXGsCX3BNc7qhHELT+g==
  -----END PUBLIC KEY-----
policy:
  configuration:
    include:
    - slsa_source_version_controlled
  publicKey: |
    -----BEGIN PUBLIC KEY-----
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZP/0htjhVt2y0ohjgtIIgICOtQtA
    naYJRuLprwIv6FDhZ5yFjYUEtsmoNcW7rx2KM6FOXGsCX3BNc7qhHELT+g==
    -----END PUBLIC KEY-----
  sources:
  - data:
    - git::github.com/enterprise-contract/ec-policies.git//data?ref=bca7d72
    name: policies
    policy:
    - git::github.com/enterprise-contract/ec-policies.git//policy/lib?ref=bca7d72
    - git::github.com/enterprise-contract/ec-policies.git//policy/release?ref=bca7d72
success: true
```

Notice the additional information in the output. It contains a list of policy rules that were
successfully evaluated as well as the details for the policy used.

To improve reusability, the `policy.yaml` file can be stored in your Kubernetes clusters via the
[EnterpriseContractPolicy](https://github.com/enterprise-contract/enterprise-contract-controller)
custom resource, see
[example](https://github.com/enterprise-contract/enterprise-contract-controller/blob/main/config/samples/appstudio.redhat.com_v1alpha1_enterprisecontractpolicy.yaml).

Say now that you have a group of images, an “application snapshot”, that must all pass validation.
We can do this in one shot by creating the components.yaml file:

```yaml
components:
  - containerImage: quay.io/example/one:latest@sha256:...
  - containerImage: quay.io/example/two:latest@sha256:...
  - containerImage: quay.io/example/three:latest@sha256:...
```

Then run the ec-cli:

```text
ec validate image --policy policy.yaml --file-path components.yaml --output yaml
```

The output of this command is a full report that includes the evaluation results of each image, as
well as whether all the images pass the validation.

The Enterprise Contract helps us verify that images were built in the expected build system, and
that they were built in the expected way. By leveraging OPA’s Rego as its policy engine, it’s easy
to create custom rules that apply whatever security and build policies are appropriate for your use
case.

## What’s next?

As the Enterprise Contract continues to be actively worked on, and used to meet users’ needs, we
plan on improving it even more. An important feature currently being worked on is support for
keyless workflows which will increase the number of supported use cases.

If you want to learn more, check out our [docs](https://enterprisecontract.dev/ec/main/index.html)
and browse [the source](https://github.com/enterprise-contract)!
