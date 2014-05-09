
var handleRadioSelect = function(e) {
    chrome.tabs.query({
            active: true,
            currentWindow: true
        },
        function(array_of_Tabs) {
            tab = array_of_Tabs[0].id;
            var value = e.target.value;
            var port = chrome.extension.connect({name: "Sample Communication"});
            port.postMessage({
                tabId : tab,
                id : value
            });
        }
    );
}

// Run our kitten generation script as soon as the document's DOM is ready.
document.addEventListener('DOMContentLoaded', function () {
    var elements = document.getElementsByTagName("input");
    for (var i = 0; i < elements.length; i++) {
        elements[i].onchange = handleRadioSelect;
    }
});
