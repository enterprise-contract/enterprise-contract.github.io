---
kind: home
---

The Enterprise Contract is a set of tools for maintaining software supply chain
security, and for the definition and enforcement of policies related to how
container images are built and tested.

```
{{<rawhtml>}}<span class="bar">&#11044;</span><span class="bar">&#11044;</span><span class="bar">&#11044;</span>{{</rawhtml>}}
$ {{<rawhtml>}}<span class="command">ec validate image --image quay.io/redhat-appstudio/ec-golden-image --output summary</span>{{</rawhtml>}}
components:
  - name: golden-container
    success: true
    successes:
      base_image_registries.base_image_permitted:
        - Pass
      cve.cve_blockers:
        - Pass
      provenance_materials.git_clone_source_matches_provenance:
        - Pass
      slsa_provenance_available.attestation_predicate_type_accepted:
        - Pass
    total_violations: 0
    total_warnings: 0
    total_successes: 4
success: true
key: |
  -----BEGIN PUBLIC KEY-----
  MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZP/0htjhVt2y0ohjgtIIgICOtQtA
  naYJRuLprwIv6FDhZ5yFjYUEtsmoNcW7rx2KM6FOXGsCX3BNc7qhHELT+g==
  -----END PUBLIC KEY-----
```

{{<rawhtml>}}
<a href="./docs/index.html"><button>View the documentation</button></a>
{{</rawhtml>}}
