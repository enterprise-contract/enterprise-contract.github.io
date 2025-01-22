---
title: 'Presenting "Conforma"'
date: 2025-01-22T12:24:00-05:00
author: "Simon Baird"
---

To make a long story short, this project has a new name. "Enterprise Contract"
is now "Conforma". Read on for some background information about the name and
why we decided to change it.

<!--more-->

## Origins

The name "Enterprise Contract" has been around since the beginning. When a few
bright Red Hatters were sketching out the plans for a new SLSA compliant
internal build system based on OpenShift, Tekton, Tekton Chains, and Sigstore,
verifying signatures and applying policies based on image attestations was a
key piece of the design.

One of the main design ideas was to allow development teams to own their build
pipelines, leaving them free to innovate and iterate, but leverage the SLSA
build provenance to provide a mechanism for release engineers and security
experts to ensure the released artifacts met the required standards.

If a container image passed "the Enterprise Contract" then it was considered
releasable. And if it didn't pass, the tooling would produce clear explanations
about why, and what needed to happen to get it passing.

So we built the tool to do this artifact verification and policy checking, and
called it "Enterprise Contract".

"Enterprise" in Red Hat vernacular can mean something like "ready for
prime-time", not just production-ready, but ready for use by Red Hat customers.
Think "Red Hat Enterprise Linux" for example. And if we say that "contract"
means the set of transparent and agreed-upon policies, then you could say the
name describes the idea well.

## Why Change?

That said, the name has some shortcomings. It's long, and often makes people
think of corporate HR, or some kind of workplace legal document.

Also, for open-source software in general, and the Fedora community in
particular, the terms "Enterprise" and "Contract" are kind of big red flags,
both legally and philosophically.

Fedora is looking at using Konflux for its own build system, and we've received
unambiguous feedback on the idea of Fedora using *anything* with the name
"Enterprise Contract". Besides that, if we want to package our software for
upstream distributions like Fedora, it's likely we'll have a hard time getting
that name accepted.

## What now?

Coming up with a name is hard, but we got there. Conforma feels good. It's
short, catchy, and has some solid connotations related to the functionality it
provides, in my opinion at least!

Rather than just rename our GitHub org and then the Git repos inside it, we're
proceeding carefully to avoid disrupting any of the existing webhooks, CI
triggers, etc. The name "Enterprise Contract" might not go away entirely, but
we'll remove it from all the upstream resources, including the website and the
documentation. Thanks for your patience while we make that happen.

One more note: This may change in the future, but in the short term we're
sticking with the binary name for the cli. If it helps, and I think it does,
"ec" now stands for "execute conforma".

{{< rawhtml >}}
<video width="640" height="360" controls autoplay>
  <source src="/images/newname.webm" type="video/webm">
  Your browser does not support the video tag.
</video>
{{< /rawhtml >}}
