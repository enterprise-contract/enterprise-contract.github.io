# Hints and tips

## Adding SVG icon

Search for a nice icon on https://heroicons.com/, e.g. a download icon, next
search in the https://github.com/tailwindlabs/heroicons/ repository for it, e.g.
https://github.com/tailwindlabs/heroicons/blob/master/src/24/outline/arrow-down-circle.svg
and include it like this in the `layouts` directory:

```
{{ $icon := resources.Get "svg/heroicons/24/outline/arrow-down-circle.svg" }}
{{ $icon.Content | safeHTML }}
```

Or like this in the Markdown files (assumes 24/outline):

```
{{< icon "arrow-down-circle" >}}
```
