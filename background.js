let sentries = {};
// {
//   tab.id : {
//     url,
//     mhtml, mhtmlTimer,
//     frames, framesTimer,
//     reloadTimer, reloadCount
//   }, ...
// }

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    chrome.pageAction.show(tabId);

    if (sentries[tabId]) setIcon(tab.id, true);
});


chrome.pageAction.onClicked.addListener((tab) => {
    let obj = sentries[tab.id];
    obj ? stop(tab.id) : start(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => check(tabId, changeInfo));

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => stop(tabId));

function start(tab) {
    console.log(`${tab.id}: start watching.`);
    setIcon(tab.id, true);

    let obj = {
        url: tab.url,
        reloadCount: 0
    };

    let updateMhtml = () => {
        chrome.pageCapture.saveAsMHTML({
            tabId: tab.id
        }, (blob) => {
            if (chrome.runtime.lastError) {
                console.error(`${tab.id}: failed to capture as mhtml.`, chrome.runtime.lastError);
            } else {
                obj.mhtml = blob;
            }

            if (sentries[tab.id]) {
                clearTimeout(obj.mhtmlTimer);
                obj.mhtmlTimer = setTimeout(updateMhtml, 1000);
            }
        });
    };
    obj.mhtmlTimer = setInterval(updateMhtml, 1000);

    let updateFrames = () => {
        chrome.tabs.executeScript(tab.id, {
            allFrames: true,
            code: 'JSON.stringify({ url: location.href, html: document.documentElement.innerHTML })'
        }, function(frames) {
            if (chrome.runtime.lastError) {
                console.error(`${tab.id}: failed to capture frames.`, chrome.runtime.lastError);
            } else {
                obj.frames = frames;
            }

            if (sentries[tab.id]) {
                clearTimeout(obj.framesTimer);
                obj.framesTimer = setTimeout(updateFrames, 1000);
            }
        });
    };
    obj.framesTimer = setTimeout(updateFrames, 1000);

    obj.reloadTimer = setInterval(() => {
        clearTimeout(obj.mhtmlTimer);
        clearTimeout(obj.framesTimer);

        chrome.tabs.reload(tab.id, null, () => {
            obj.reloadCount += 1;
            obj.mhtmlTimer  = setTimeout(updateMhtml, 1000);
            obj.framesTimer = setTimeout(updateFrames, 1000);
        });
        console.log(`${tab.id}: reloaded.`);
    }, 1000 * 60 * 1); // 1 min

    sentries[tab.id] = obj;
}

function check(tabId, changeInfo) {
    let obj = sentries[tabId];
    if (!obj) return;

    if (changeInfo.url && changeInfo.url !== obj.url) {
        console.log(`${tabId}: captured at ${(new Date()).toISOString()}`);
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
    let obj = sentries[tabId];
    if (!obj) return;

    clearTimeout(obj.mhtmlTimer);
    clearTimeout(obj.framesTimer);
    clearInterval(obj.reloadTimer);

    delete sentries[tabId];

    setIcon(tabId, false);
    console.log(`${tabId}: stopped.`);
}

function setIcon(tabId, enabled) {
    chrome.pageAction.setIcon({
        tabId: tabId,
        path: !enabled ? 'img/ghost1.png' : 'img/ghost2.png'
    });
}

function download(filename, blob) {
   	var a = document.createElement("a");
    var blobUrl = window.URL.createObjectURL(blob);
    a.href = blobUrl;
    a.download = filename;
    a.click();
}
