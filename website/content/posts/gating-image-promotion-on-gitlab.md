---
title: "Gating Image Promotion on GitLab"
date: 2024-06-12T18:64:00-00:00
author: "Luiz Carvalho"
---

Once you have a container image ready for promotion, it is important to first verify the image meets
a certain criteria before it is made available to consumers. In this blog post, we look at how to
achieve this in a [GitLab] pipeline.

<!--more-->

> See the [appendix](#appendix) section for the full example.

Consider a simple [.gitlab-ci.yaml] file:

```yaml
---
stages:
  - build
  - promote

docker-build:
  stage: build
  image: docker:cli
  services:
    - docker:dind
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  before_script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" $CI_REGISTRY
  script:
    - docker build --pull -t "$DOCKER_IMAGE_NAME" .
    - docker push "$DOCKER_IMAGE_NAME"

tag-latest:
  stage: promote
  image:
    name: ghcr.io/sigstore/cosign/cosign:v2.2.3-dev@sha256:0d795fa145b03026b7bc2a35e33068cdb75e1c1f974e604c17408bf7bd174967
    entrypoint: ["/busybox/sh", "-c"]
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  before_script:
    - cosign login "$CI_REGISTRY" -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD"
  script:
    - cosign copy -f "${DOCKER_IMAGE_NAME}" "$CI_REGISTRY_IMAGE:latest"
```

The example above illustrates a pipeline with two jobs. The first, `docker-build`, will build a
container image and push it to the [GitLab container registry]. The second, `tag-latest`, simply
tags the image with the `latest` tag. In this simplistic promotion workflow, tagging the image with
`latest` signifies to users that an update is ready to be consumed.

## Sign the Image

The first step in improving the security of this process is to sign the container image. To do so,
we introduce a new stage to the pipeline:

```yaml
---
stages:
  - build
  - process  # <- added
  - promote

# [...]

# New job
secure:
  stage: process
  image:
    name: ghcr.io/sigstore/cosign/cosign:v2.2.3-dev@sha256:0d795fa145b03026b7bc2a35e33068cdb75e1c1f974e604c17408bf7bd174967
    entrypoint: ["/busybox/sh", "-c"]
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    COSIGN_YES: "true"
  # Set the JWT token audience and the name of the env variable
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: "sigstore"
  before_script:
    - cosign login "$CI_REGISTRY" -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD"
  script:
    - cosign sign ${DOCKER_IMAGE_NAME}

  # [...]
```

We also modified the `tag-latest` job to depend on the `secure` job instead of `docker-build`. This
ensures the image is signed before it is tagged.

Notice how no signing keys are required to sign the image. This is because we are leveraging
Sigstore's [identity-based] signatures, also known as "keyless".

With the modifications above the GitLab pipeline will produce an image that is signed. Users can
then verify it accordingly.

## Add Provenance

Taking this a step further, let's also create a [SLSA Provenance] that provides some information
about how the image was created. Then, let's associate this information with our image as a signed
attestation.

To generate the SLSA Provenance, we are going to use a simple `bash` script that resides at
`scripts/generate.sh` in our git repository.

```bash
#!/usr/bin/env bash
set -euo pipefail

# List of available GitLab CI variables: https://docs.gitlab.com/ee/ci/variables/predefined_variables.html

cat <<EOF
{
  "buildDefinition": {
   "buildType": "https://gitlab.com/lucarval/sign-attest-poc",
   "resolvedDependencies": [
    {
     "uri": "git+${CI_PROJECT_URL}",
     "digest": {
      "sha1": "${CI_COMMIT_SHA}"
     }
    }
   ]
  },
  "runDetails": {
   "builder": {
    "id": "${CI_RUNNER_ID}",
    "version": {
     "gitlab-runner": "${CI_RUNNER_REVISION}"
    }
   },
   "metadata": {
    "invocationID": "${CI_PIPELINE_ID}",
    "startedOn": "${CI_PIPELINE_CREATED_AT}",
    "finishedOn": "${CI_PIPELINE_CREATED_AT}"
   }
  }
}
EOF
```

Next, we use this script to generate the SLSA Provenance predicate, and change the previously added
`secure` job to associate this information with our image.

```yaml
# [...]

generate-provenance:
  needs: [docker-build]
  stage: process
  image: registry.access.redhat.com/ubi9:latest
  script:
    - ./scripts/generate.sh > predicate.json
  artifacts:
    paths:
      - predicate.json

secure:
  needs:  # <- added
    - job: generate-provenance
      artifacts: true
  stage: process
  # [...]
  script:
    - cosign sign ${DOCKER_IMAGE_NAME}
    # added line below
    - cosign attest --predicate predicate.json --type https://slsa.dev/provenance/v1 ${DOCKER_IMAGE_NAME}

# [...]
```

Now our image is signed and attested! The consumers of this image are ecstatic.

## Gate Promotion

There is a gotcha in our pipeline! What if there is a bug in our `generate.sh` script? What if the
signature, for whatever reason, is not created as expected? Any consumer of our image that practices
supply chain security best practices will be prevented from consuming the image.

Those poor users...

To mitigate these issues, we can introduce a gating step that validates the image, like consumers
would, *before* promoting the image. Let's define a minimal Enterprise Contract policy configuration
file, called `policy.yaml`, that captures the validation requirements:

```yaml
---
identity:
  issuer: https://gitlab.com
  subject: https://gitlab.com/lucarval/sign-attest-poc//.gitlab-ci.yml@refs/heads/main
```

Whoa where did those values come from!?

This is part of the [identity-based] signature workflow implemented by Sigstore.

The `issuer` refers to the entity that is responsible for *issuing* the identity. In our case, this
is `https://gitlab.com` because we are running our pipeline from a git repository hosted on
[gitlab.com](https://gitlab.com).

The `subject` is the identity GitLab decided to assign to this particular pipeline. It is derived
from the git repository, the file that defines the pipeline, and the git reference. If we were to
run this same pipeline on a different git repository, or just on a different branch, the `subject`
would contain a different value.

By specifying these values in our `policy.yaml`, we are stating that we expect our images to always
come from this particular branch in this particular repository.

```yaml
# [...]

validate:
  stage: promote
  image:
    name: quay.io/enterprise-contract/ec-cli:snapshot
    entrypoint: [""]
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    GIT_REVISION: $CI_COMMIT_SHA
  script:
    - ec validate image --image "${DOCKER_IMAGE_NAME}" --policy policy.yaml --output yaml --show-successes

tag-latest:
  needs: [validate]  # <- added
  stage: promote
  # [...]
```

Now we have the guarantee that when the image is promoted, it already has the expected signature and
SLSA Provenance attestation. Cool!

## Advanced Validation

Our `policy.yaml` is very minimal. The Enterprise Contract validation is ensuring the image is
signed with the expected identity, and that it also contains a SLSA Provenance also signed with the
same identity. This is great, but we can, and will, take it further!

Let's use one of the community policy rules to ensure the SLSA Provenance correctly captures the git
information. The [slsa_source_correlated] policy package is meant for exactly this use case.

To use it, let's update our `policy.yaml` to add a `sources` section:

```yaml
---
identity:
  subject: https://gitlab.com/lucarval/sign-attest-poc//.gitlab-ci.yml@refs/heads/main
  issuer: https://gitlab.com
sources:  # <- added
  - policy:
      - github.com/enterprise-contract/ec-policies//policy/lib
      - github.com/enterprise-contract/ec-policies//policy/release
    config:
      include:
        - slsa_source_correlated
```

We also need to tweak the parameters to the `ec` CLI. Let's use the `--images` parameter instead of
the `--image` parameter so we can provide more information about the image we are verifying. The
`--images` parameter requires more than just an image reference. We create a file, called
`images.yaml`, on the fly which includes the expected git repository and commit for the image.

```yaml
# [...]

validate:
  # [...]
  script:  # <- replaced script block
    - |
      cat <<EOF | tee images.yaml
      ---
      components:
        - containerImage: "${DOCKER_IMAGE_NAME}"
          source:
            git:
              url: "${CI_PROJECT_URL}"
              revision: "${GIT_REVISION}"
      EOF
    - ec validate image --images images.yaml --policy policy.yaml --output yaml --show-successes

# [...]
```

When the `validate` job runs next, in addition to the previous checks, it will also verify the SLSA
Provenance contains the expected git source information.

## Conclusion

I hope this blog post has given you an idea of what is possible with Enterprise Contract when using
GitLab.

[GitLab]: https://gitlab.com/
[.gitlab-ci.yaml]: https://docs.gitlab.com/ee/ci/yaml/index.html
[GitLab container registry]: https://docs.gitlab.com/ee/user/packages/container_registry/
[identity-based]: https://docs.sigstore.dev/signing/overview/
[SLSA Provenance]: https://slsa.dev/spec/v1.0/
[slsa_source_correlated]: https://enterprisecontract.dev/docs/ec-policies/release_policy.html#slsa_source_correlated_package

## Appendix

This section provides the `.gitlab-ci.yaml` file in full for convenience.

```yaml
---
stages:
  - build
  - process
  - promote

docker-build:
  stage: build
  image: docker:cli
  services:
    - docker:dind
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  before_script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" $CI_REGISTRY
  script:
    - docker build --pull -t "$DOCKER_IMAGE_NAME" .
    - docker push "$DOCKER_IMAGE_NAME"


generate-provenance:
  stage: process
  image: registry.access.redhat.com/ubi9:latest
  script:
    - ./scripts/generate.sh > predicate.json
  artifacts:
    paths:
      - predicate.json

secure:
  needs:
    - job: generate-provenance  # <- added
      artifacts: true
  stage: process
  image:
    name: ghcr.io/sigstore/cosign/cosign:v2.2.3-dev@sha256:0d795fa145b03026b7bc2a35e33068cdb75e1c1f974e604c17408bf7bd174967
    entrypoint: ["/busybox/sh", "-c"]
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    COSIGN_YES: "true"
  # Set the JWT token audience and the name of the env variable
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: "sigstore"
  before_script:
    - cosign login "$CI_REGISTRY" -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD"
  script:
    - cosign sign ${DOCKER_IMAGE_NAME}
    - cosign attest --predicate predicate.json --type https://slsa.dev/provenance/v1 ${DOCKER_IMAGE_NAME}

validate:
  stage: promote
  image:
    name: quay.io/enterprise-contract/ec-cli:snapshot
    entrypoint: [""]
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    GIT_REVISION: $CI_COMMIT_SHA
  script:
    - |
      cat <<EOF | tee images.yaml
      ---
      components:
        - containerImage: "${DOCKER_IMAGE_NAME}"
          source:
            git:
              url: "${CI_PROJECT_URL}"
              revision: "${GIT_REVISION}"
      EOF
    - ec validate image --images images.yaml --policy policy.yaml --output yaml --show-successes

tag-latest:
  needs: [validate]
  stage: promote
  image:
    name: ghcr.io/sigstore/cosign/cosign:v2.2.3-dev@sha256:0d795fa145b03026b7bc2a35e33068cdb75e1c1f974e604c17408bf7bd174967
    entrypoint: ["/busybox/sh", "-c"]
  variables:
    DOCKER_IMAGE_NAME: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  before_script:
    - cosign login "$CI_REGISTRY" -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD"
  script:
    - cosign copy -f "${DOCKER_IMAGE_NAME}" "$CI_REGISTRY_IMAGE:latest"
```
