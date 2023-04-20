document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.zoomer').forEach(e => {
        e.addEventListener('click', () => {
            const zoom = document.getElementById(e.dataset.target)
            zoom.classList.toggle('shown')
        })
    })
    document.querySelectorAll('.zoom').forEach(e => {
        e.addEventListener('click', () => {
            e.classList.toggle('shown')
        })
    })
})
