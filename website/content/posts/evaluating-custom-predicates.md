---
title: "Policies Polyglot: Evaluating Custom Predicates"
date: 2024-03-20T15:02:00-04:00
author: "Luiz Carvalho"
---

Attestations are a wonderful way to attach metadata to container images in a secure manner. One of
the most popular formats is [SLSA Provenance](https://slsa.dev/spec/v0.1/provenance#schema) which is
used to provide information on how the image was created. Our [Hitchhiker’s
Guide](https://enterprisecontract.dev/docs/user-guide/hitchhikers-guide.html) demonstrates how
to write policies to assert the contents of the SLSA Provenance. Here, we expand on that approach to
assert the contents of *any* attestation format, even completely made up ones.

<!--more-->

{{< conforma-name-preamble >}}

Before getting started, let's make sure we have an image that is already signed and has a SLSA
Provenance attestation. We will also need access to the signing key used. The [Hitchhiker’s
Guide](https://enterprisecontract.dev/docs/user-guide/hitchhikers-guide.html) walks through the
process. If you want to try out the commands in this blog post, start there.

When we talk about different attestation formats, what we are really saying is different **predicate
types** of an in-toto attestation. In addition to SLSA Provenance, there are a few [other common
types](https://github.com/in-toto/attestation/blob/ad3ec5f1e6c9f56a10b7be2e366772b224a99ff8/spec/predicates/README.md).
As suggested earlier, in this blog post we will use a made up predicate type to both demystify
predicates and highlight Enterprise Contract's flexibility in validating attestations.

Let's get this started!

First, we create a `predicate.json` file with arbitrary JSON data. This holds the contents of our
custom predicate.

```json
{"bacon_style": "crispy", "bacon_count": 6}
```

Second, we create a new attestation for our image using `predicate.json` as the predicate for our
fabricated predicate type.

```bash
cosign attest --predicate predicate.json --type 'https://bacon/v42' --key cosign.key $REPOSITORY:latest
```

Next, we want to write a policy rule that asserts the contents of the "bacon" predicate associated
with a container image. To do so, it helps to visualize how EC structures this data. The `ec
validate image` command supports an output format for this specific purpose.

```bash
ec validate image --public-key cosign.pub --image $REPOSITORY:latest --output yaml \
  --output policy-input=input.json
```

Once the command finishes, the `input.json` file contains the complete input as seen by the policy
rules. Use [jq](https://jqlang.github.io/jq/) to inspect it.

```bash
$ jq '.attestations[1].statement.predicate' input.json
{
    "bacon_style": "crispy",
    "bacon_count": 6
}
```

The "crispy" value can be accessed via the `input.attestations[1].statement.predicate.bacon_style`
variable from within a policy rule.

Things are getting exciting!

Create a new directory to hold the new policies we are about to write, e.g. `mkdir policies`. Then
create the file `bacon.rego` inside that directory.

```rego
package bacon

import rego.v1

# METADATA
# title: Style
# description: Verify the Bacon attestation has the expected style.
# custom:
#   short_name: style
deny contains result if {
    some error in _errors
    result := {"code": "bacon.style", "msg": error}
}

_expected_style := "crispy"

_errors contains error if {
    count(_bacon_attestations) == 0
    error := "No bacon attestations found"
}

_errors contains error if {
    some attestation in _bacon_attestations
    not attestation.statement.predicate.bacon_style
    error := "Bacon attestation does not set the 'bacon_style' attribute"
}

_errors contains error if {
    some attestation in _bacon_attestations
    got := attestation.statement.predicate.bacon_style
    got != _expected_style
    error := sprintf("Bacon must be %q! Found %q bacon", [_expected_style, got])
}

_bacon_attestations := [attestation |
    some attestation in input.attestations
    attestation.statement.predicateType == "https://bacon/v42"
]
```

(Check out the [docs](https://enterprisecontract.dev/docs/ec-policies/authoring.html) for more
information on how to author policy rules 🔥)

Next, we create a policy configuration, `policy.yaml`, to use the policy rules above.

```yaml
---
sources:
  - policy:
      - /tmp/policies
```

Note: Change `/tmp/policies` to the absolute path to the directory where `bacon.rego` was saved.

Finally, let's validate our image conforms to the policy config.

```bash
ec validate image --public-key cosign.pub --policy policy.yaml --image $REPOSITORY:latest \
  --output yaml --show-successes
```

```yaml
components:
- attestations:
  - predicateBuildType: https://localhost/dummy-type
    predicateType: https://slsa.dev/provenance/v0.2
    signatures:
    - keyid: ""
      sig: MEUCIFMtiIiz0h9+zJpc5MfwavZ2/BIxuhIig5uoePcQ+nOHAiEAzSCKAOH5irMG1bG5HNkVzZLOyDOV3SiIIrU6YCTz668=
    type: https://in-toto.io/Statement/v0.1
  - predicateType: https://bacon/v42
    signatures:
    - keyid: ""
      sig: MEQCIHzmTK9YRU/PPfFjxRP6oSFNXyMIbAXEnQNP7GcCIjsbAiBVI8NtWYcvjg7/GmFC9Ce1e0XSh/mS5i5USHAX5I12tA==
    type: https://in-toto.io/Statement/v0.1
  containerImage: localhost:5000/ec-zero-to-hero@sha256:b5430d3d447434c795a508036e5046e41c009039be5b3f656f121c2426500d1e
  name: Unnamed
  signatures:
  - keyid: ""
    sig: MEQCIGIxpCboUYXF/fw6OuKmpM1Svi/0q+URD7oarLsji2+nAiBe3rgmWYOCa7sVpc2K5DKsef9hDigSlOHt6tl8v/8/JA==
  source: {}
  success: true
  successes:
  - metadata:
      code: builtin.attestation.signature_check
    msg: Pass
  - metadata:
      code: builtin.attestation.syntax_check
    msg: Pass
  - metadata:
      code: builtin.image.signature_check
    msg: Pass
  - metadata:
      code: bacon.style
    msg: Pass
ec-version: v0.3.2687-370a1a7
effective-time: "2024-03-20T18:58:24.532182311Z"
key: |
  -----BEGIN PUBLIC KEY-----
  MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEaxhfip26cuIfpDEVII0ilOHvFkee
  igKbV5APr6OHYEstl9uJ8keON3VyzGfRB/2FUzr92J4ZN3YQUsTaiGc/HQ==
  -----END PUBLIC KEY-----
policy:
  publicKey: cosign.pub
  sources:
  - policy:
    - /tmp/policies
success: true
```

Success!

Change the value of the `_expected_style` variable in the `bacon.rego` file to any other value, e.g.
`"chunky"`. Run the exact EC command again to see what a violation looks like.

```yaml
components:
- ...
  violations:
  - metadata:
      code: bacon.style
    msg: Bacon must be "chunky"! Found "crispy" bacon
...
success: false
```

As we can see the Enterprise Contract can be used to perform advanced checks on any kind of
attestation 👌. What will you use it for? 🤔
