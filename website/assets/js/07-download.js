document.addEventListener('DOMContentLoaded', async () => {
    const download = document.querySelector('#download a');
    if (!download) {
        return
    }
    try {
        const response = await fetch('https://api.github.com/repos/enterprise-contract/ec-cli/releases/tags/snapshot');
        const snapshot = await response.json();
        const uap = new UAParser();
        const os = uap.getOS().name.replace('macOS', 'darwin').toLowerCase();
        const arch = uap.getCPU().architecture;
        const file = `ec_${os}_${arch}`;
        const asset = snapshot.assets.find(a => a.name === file);
        if (asset) {
            download.parentNode.insertAdjacentHTML('afterend', `<a class="all-downloads" href=${download.href}>(All downloads)</a>`)
            download.href = asset.browser_download_url;
            download.title = `${uap.getOS().name} / ${uap.getCPU().architecture}`;
        }
    } catch(e) {
        // Unable to fetch the releases leave the download link as is
        return;
    }
})
