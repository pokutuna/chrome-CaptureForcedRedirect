chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    chrome.pageAction.show(tabId);
});

// { tab.id : { url, mhtml, mhtmlTimer, frames, framesTimer, reloadTimer, reloadCount } }
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
        reloadCount: 0
    };

    let updateDump = () => {
        chrome.pageCapture.saveAsMHTML({ tabId: tab.id }, (blob) => obj.mhtml = blob);
        setIcon(tab.id, true);
    };

    let updateFrames = () => {
        chrome.tabs.executeScript(tab.id, {
            allFrames: true,
            code: 'JSON.stringify({ url: location.href, html: document.documentElement.innerHTML })'
        }, function(frames) {
            if (chrome.runtime.lastError) {
                console.error(`${tab.id}: ${chrome.runtime.lastError}`);
            } else {
                obj.frames = frames;
            }
            obj.framesTimer = setTimeout(updateFrames, 1000);
        });
    };

    obj.mhtmlTimer = setInterval(updateDump, 1000);

    obj.framesTimer = setTimeout(updateFrames, 1000);

    obj.reloadTimer = setInterval(() => {
        clearInterval(obj.mhtmlTimer);
        clearTimeout(obj.framesTimer);

        chrome.tabs.reload(tab.id, null, () => {
            obj.reloadCount += 1;
            obj.mhtmlTimer = setInterval(updateDump, 1000);
            obj.framesTimer = setTimeout(updateFrames, 1000);
        });
        setIcon(tab.id, true);
        console.log(`${tab.id} reloaded.`);
    }, 1000 * 60 * 1); // 1 min

    bombs[tab.id] = obj;
}

function check(tabId, changeInfo) {
    let obj = bombs[tabId];
    if (!obj) return;

    if (changeInfo.url && changeInfo.url !== obj.url) {
        console.log(`${tabId} captured at ${(new Date()).toISOString()}`);
        download(
            `${tabId}-${Date.now()}.mhtml`,
            obj.mhtml
        );
        download(
            `${tabId}-${Date.now()}.json`,
            new Blob([ JSON.stringify(obj.frames.map((str) => JSON.parse(str))) ], { type: 'application/json' })
        );
    }
}

function stop(tabId) {
    let obj = bombs[tabId];
    if (!obj) return;

    setIcon(tabId, false);
    clearInterval(obj.mhtmlTimer);
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
