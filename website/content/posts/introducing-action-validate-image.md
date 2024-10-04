---
title: "Introducing Action Validate for GitHub"
date: 2023-10-24T13:02:00-04:00
author: "Sean Conroy"
---

You may already be familiar
with using the `EC-CLI Validate` command for local container image validation.
Now, you can seamlessly integrate this functionality directly into your build
processes or any other automated workflow in GitHub.

<!--more-->

## What is EC Validate Action?

**EC Validate** is a GitHub Action that brings validation capabilities of the Enterprise Contract CLI directly into your GitHub Workflow. Designed to integrate seamlessly into your build pipeline, this action offers both compliance assessments and integrity checks for your container images. It ensures that your images meet both organizational and industry standards before deployment or environment promotion.

### Key Features

- **GitHub Native**: Being a GitHub Action, EC Validate seamlessly integrates into your existing GitHub workflows, while also providing GitHub summary output.
- **Policy Compliance**: Ability to tailor its validation checks based on custom or pre-defined policies.
- **Integrity Checks**: Verifies that the image hasn't been tampered with.
- **[Signature Verification Support](https://enterprisecontract.dev/docs/ec-cli/signing.html)**: Offers support for verifying both long-lived public-key signed, and keyless signed container images.

Interested in learning more? Visit the EC Validate action in [GitHub's Market Place](https://github.com/marketplace/actions/ec-validate) for a user guide.

## The `Golden-Container` Build Pipeline Example using EC Validate
Imagine you're operating within a [build & release workflow](https://GitHub.com/enterprise-contract/golden-container/blob/main/.github/workflows/release.yaml). You've successfully set up a pipeline that takes care of building, digitally signing, generating an SBOM, and adding provenance data. However, you're missing a crucial step in validating the container image. This is where the `EC Validate` comes into play, ensuring your container images meet the required security and compliance standards before deployment.

Now, let’s go over the initial steps of this workflow before actually diving into it.

### Sign image with GitHub OIDC Token
In this step, the container image is signed using Cosign and a GitHub OIDC token. This adds an additional layer of security and trust to the image, making it easier to verify its integrity and origin.

```yaml
- name: Sign image with GitHub OIDC Token
  run: cosign sign --yes ${IMAGE_REGISTRY}/${IMAGE_REPO}@${DIGEST}
  env:
    DIGEST: ${{ steps.push-image.outputs.digest }}
```

### Generate and Store SBOM

We use Syft to generate a SBOM. It's then attested using Cosign.

```yaml
- name: Generate and store SBOM
  run: |
      syft "${IMAGE_REGISTRY}/${IMAGE_REPO}@${DIGEST}" -o spdx-json=sbom-spdx.json
      cosign attest --yes --predicate sbom-spdx.json --type spdx "${IMAGE_REGISTRY}/${IMAGE_REPO}@${DIGEST}"
  env:
    DIGEST: ${{ steps.push-image.outputs.digest }}
```

### SLSA Provenance Generation
We employ SLSA tooling to generate provenance. This helps track the build process and adds traceability to the container image.
```yaml
- name: slsa-github-generator
  uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
  with:
    image: ${{ needs.build.outputs.image }}
    digest: ${{ needs.build.outputs.digest }}
    registry-username: ${{ github.actor }}
  secrets:
    registry-password: ${{ secrets.GITHUB_TOKEN }}
```

### EC Action Validate
EC Action Validate works by assessing your container images against a set of validation checks. You can customize these checks through a policy to align with the specific security and compliance guidelines of your organization or industry. Whether the image passes or fails, you'll receive a GitHub summary output, and additional logs will be available in YAML format within the action.
```yaml
- name: Validate image (keyless)
  uses: enterprise-contract/action-validate-image@v1.0.31
  with:
    image: ${{ needs.build.outputs.image }}@${{ needs.build.outputs.digest }}
    identity: https:\/\/github\.com\/(slsa-framework\/slsa-github-generator|${{ github.repository_owner }}\/${{ github.event.repository.name }})\/
    issuer: https://token.actions.GitHubusercontent.com
    policy: github.com/enterprise-contract/config//github-default
```
- **`image`**: Specifies the container image to be validated. It uses the image and digest output from a previous build step in the workflow.

- **`identity`**: Defines the identity or entities that are expected to have produced the image signature and attestations. In this case, it's either from the SLSA GitHub Generator or the repository owner.

- **`issuer`**: Specifies the OIDC issuer of the token used for authentication. Here, it's set to GitHub's token actions issuer URL.

- **`policy`**: Points to the policy configuration to use for validation checks. The policy can be either [predefined](https://github.com/enterprise-contract/config) or a custom policy.


### Promote Image
Upon successful validation, this step promotes the image by pushing the latest validated tag. This ensures that only images that have passed checks are promoted.
```yaml
- name: Push latest-validated image tag
  run: |
      skopeo copy \
      --dest-creds=${{ github.actor }}:${{ github.token }} \
      docker://${{ needs.build.outputs.image }}@${{ needs.build.outputs.digest } \
      docker://${{ needs.build.outputs.image }}:latest
```

## Example of Long-Lived Public-Key Authentication
Here is a version of the EC Action Validate that verifies artifacts signed by cosign with long-lived signing secrets. This method uses a public key, stored in a secret variable, to verify the image signature, thereby ensuring its integrity through a three-stage validation process: Signature Verification, Attestation Verification, and Policy Compliance.
```yaml
- name: Validate image (long-lived)
  uses: enterprise-contract/action-validate-image@v1.0.31
  with:
    image: quay.io/konflux-ci/ec-golden-image:latest
    key: ${{ vars.PUBLIC_KEY }}
    policy: github.com/enterprise-contract/config//slsa3
    extra-params: --ignore-rekor
```

- **`image`**: Similar to keyless, specifies the container image to be validated.
- **`key`**: The public key used for long-lived authentication.
- **`policy`**: Policy configuration, which can be either [predefined](https://github.com/enterprise-contract/config) or custom.
- **`extra-params`**: Additional parameters for the action, such as ignoring Rekor for this image. More can be found [here](https://enterprisecontract.dev/docs/ec-cli/ec_validate_image.html#_options)

By using either keyless or long-lived authentication methods, you can tailor EC Action Validate to meet the specific security requirements of your project.

## Putting it all together

EC Validate is a GitHub Action aimed at elevating the security and compliance of your container images right within your GitHub workflow. By offering a range of authentication methods and customizable or defined policies, this action ensures that only validated and compliant images make it to deployment. It's a solution for organizations looking to adhere to organizational and industry standards while automating their pipelines within GitHub.

Interested in learning more? Visit the EC Validate action in [GitHub's Market Place](https://github.com/marketplace/actions/ec-validate) for a user guide. If you would like to see the code, feel free to explore [our GitHub repository](https://github.com/enterprise-contract/action-validate-image).