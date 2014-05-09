
// https://acc.ounts.google.com => https://google.com
function getBaseURL(url) {
	pathArray =  url.split( '/' );
	protocol = pathArray[0]; // http|https
	parts = pathArray[2].split('.'); // [accounts, google, com]

	// Get the top level domain (acc.ounts.googe.com => google.com)
	host = parts.slice(parts.length - 2).join('.');
	return protocol + '://' + host;
}

function removeHeaderFromRequest(requestHeaders,header) {
	for (var i = 0; i < requestHeaders.length; ++i) {
		if (requestHeaders[i].name.toLowerCase() == header) {
			// if (header=='cookie') console.log(requestHeaders[i].value);
			requestHeaders.splice(i, 1);
		}
	}
	return requestHeaders;
}

function getHeaderFromRequest(headers,header) {
	for (var i = 0; i < headers.length; ++i) {
		if (headers[i].name.toLowerCase() == header) {
			return headers[i].value;
		}
	}
	return undefined;
}

function getSessionNameForTab(tabId) {
	return tabData[tabId];
}

function getSessionCookie(id,url) {
	var savedCookies = cookiejar[id][url];
	if (!savedCookies) {
		return undefined;
	}
	// Construct our own cookie
	var cookie = '';
	for (var key in savedCookies) {
		// console.log(key);
		if (savedCookies[key] != undefined) {
			cookie += savedCookies[key].key + '=' + savedCookies[key].value + '; ';
		}
	};
	// Remove the last '; '
	cookie = cookie.substring(0,cookie.length - 2);
	return cookie;
}

function parseSetCookie(setCookie) {
	var cookieData = ['path','domain', 'httponly','expires','secure','priority','max-age'];

	var cookieParts = setCookie.split(';');
	var cook = {
		attr : [],
		key : null,
		value : null
	}
	for (var j = 0; j < cookieParts.length; j++) {
		var fields = cookieParts[j].trim().split('='); // 'foo=bar' => ['foo','bar']
		// This is for cookie attribute such as 'httponly; '
		if (fields.length == 1) {
			cook.attr[fields[0]] = null;
		}
		if (fields.length == 2) {
			var key = fields[0];
			var value = fields[1];
			if (cookieData.indexOf(key.toLowerCase()) > -1) {
				cook.attr[key] = value;
			} else {
				cook.key = key;
				cook.value = value;
			}
		}
	}
	return cook;

}

function saveSessionCookie(id,url,setCookie) {
	var cookie = parseSetCookie(setCookie);
	if (cookiejar[id][url] == undefined) {
		cookiejar[id][url] = [];
	}

	// Lets check if the cookie has expired
	if (cookie.attr['expires'] && cookie.attr['expires'].indexOf('1970') > -1) {
		cookiejar[id][url][cookie.key] = undefined;
	}
	else {
		cookiejar[id][url][cookie.key] = cookie;
	}
}

/**
* Intercept a request and send our own session cookies
* This is a callback function for addlistener
**/
function handleOnBeforeSendHeaders(details) {

	// remove 'cookie' header from the requset, so we dont get to trouble with browser saved cookies
	var requestHeaders = removeHeaderFromRequest(details.requestHeaders,"cookie");

	// Extension is active, but the current tab has no session configuration
	// Do not allow cookies to be sent to the site from this tab
	// TODO: maybe just drop the request all togather
	var name = getSessionNameForTab(details.tabId);
	if (name == undefined) {
		return {requestHeaders: requestHeaders};
	}

	var url = getBaseURL(details.url);
	var sessionCookie = getSessionCookie(name, url);
	if (sessionCookie == undefined) {
		return {requestHeaders: requestHeaders};
	} else {
		// Add our cookie to the request and forward it
		requestHeaders.push({name : 'cookie',value : sessionCookie});
		return {requestHeaders: requestHeaders};
	}
}

// Intercept a response from the server and save the cookies
function handleOnHeadersReceived(details) {

	// Extension is ative, but the current tab has no session configuration
	// Do not allow cookies to be sent to the site from this tab
	var name = getSessionNameForTab(details.tabId);
	if (name == undefined) {
		return {responseHeaders: removeHeaderFromRequest(details.responseHeaders,'set-cookie')};
	}

	var url = getBaseURL(details.url);
	// There could be multiplpe set-cookies
	for (var i = 0; i < details.responseHeaders.length; ++i) {
		if (details.responseHeaders[i].name.toLowerCase() === 'set-cookie') {
			var setCookie = details.responseHeaders[i].value;
			saveSessionCookie(name,url,setCookie);
		}
	}
	var responseHeaders = removeHeaderFromRequest(details.responseHeaders,'set-cookie');
	return {responseHeaders: responseHeaders};
}

function startTampering() {

	chrome.webRequest.onBeforeSendHeaders.addListener(
		handleOnBeforeSendHeaders,
		{urls: ["<all_urls>"]},
		["blocking", "requestHeaders"]
	);

	chrome.webRequest.onHeadersReceived.addListener(
		handleOnHeadersReceived,
		{urls: ["<all_urls>"]},
		["blocking","responseHeaders"]
	);

}

// Listen to connection from popup.js
chrome.extension.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg) {
		if (msg.id == '0') {
			chrome.browserAction.setBadgeText({text : '',tabId : msg.tabId});
			tabData[msg.tabId] = undefined;
		} else {
			chrome.browserAction.setBadgeText({
				text : msg.id[0],
				tabId : msg.tabId
			});
			if (cookiejar[msg.id] == undefined) {
				cookiejar[msg.id] = [];
			}
			tabData[msg.tabId] = msg.id;
		}
	});
});

var cookiejar = [];
var tabData = [];
startTampering();
