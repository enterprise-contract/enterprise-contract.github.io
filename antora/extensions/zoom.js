'use strict'

require('@asciidoctor/core')()
const Opal = global.Opal

;(() => {
    const defaultConverter = Opal.module(null, 'Asciidoctor').Converter.$for('html5').$new()
    const classDef = Opal.klass(
        Opal.module(null),
        Opal.module(null, 'Asciidoctor').Converter.$for('html5'),
        'ECHtml5Converter'
    )

    classDef.$register_for('html5')

    Opal.defn(classDef, '$convert_image', function (node) {
        const markup = defaultConverter.$convert_image(node)
        const target = node.getAttribute('target')
        return `<div id="zoom_${target}" class="zoom">${markup}</div><div data-target="zoom_${target}" class="zoomer">${markup}</div>`
    })

    return classDef
})()
