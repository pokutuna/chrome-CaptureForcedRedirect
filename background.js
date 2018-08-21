chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    chrome.pageAction.show(tabId);
});

// { tab.id : { url, dump, dumpTimer, reloadTimer } }
let bombs = {};

chrome.pageAction.onClicked.addListener((tab) => {
    let obj = bombs[tab.id];
    obj ? stop(tab.id) : start(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => check(tabId, changeInfo));

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => stop(tabId));

function start(tab) {
    console.log(`${tab.id}: The bomb has been planted.`);
    setIcon(tab.id, true);

    let obj = {
        url: tab.url,

        dumpTimer: setInterval(() => {
            try {
                chrome.pageCapture.saveAsMHTML({ tabId: tab.id }, (blob) => obj.dump = blob);
            } catch(e) {
                // nice catch
            }
        }, 1000),

        reloadTimer: setInterval(() => {
            chrome.tabs.reload(tab.id, null, () => setIcon(tab.id, true));
            setIcon(tab.id, true);
            console.log(`${tab.id} reloaded.`);
        }, 1000 * 60 * 5)
    };

    bombs[tab.id] = obj;
}

function check(tabId, changeInfo) {
    let obj = bombs[tabId];
    if (!obj) return;

    if (changeInfo.url && changeInfo.url !== obj.url) {
        console.log(`${tabId} captured at ${(new Date()).toISOString()}`);
        download(`${tabId}-${Date.now()}.mhtml`, obj.dump);
    }
}

function stop(tabId) {
    let obj = bombs[tabId];
    if (!obj) return;

    setIcon(tabId, false);
    clearInterval(obj.dumpTimer);
    clearInterval(obj.reloadTimer);

    delete bombs[tabId];
    console.log(`${tabId} stopped`);
}

function setIcon(tabId, enabled) {
    chrome.pageAction.setIcon({
        tabId: tabId,
        path: !enabled ? 'img/icon-128.png' : 'img/icon-128-planted.png'
    });
}

function download(filename, blob) {
   	var a = document.createElement("a");
    var blobUrl = window.URL.createObjectURL(blob);
    a.href = blobUrl;
    a.download = filename;
    a.click();
}
