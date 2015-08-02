
/**
 * @fileoverview Chrome window manager logic code.
 * @author Jakzo
 */


/**
 * Manages a session (set of tabs within a window).
 * @constructor
 * @param {Object} options
 * @param {?Window} options.window The window object this session is associated
 *     with.
 * @param {?Array.<Session.Tab>} options.tabs A list of tabs that belong to this
 *     session.
 * @param {?string} options.name The name of the session. Defaults to the title
 *     of the first tab.
 */
var Session = function(options) {

    /**
     * The ID of the window object this session is associated with.
     * @type {?Window}
     */
    this.id = options.id || options.window && options.window.id || null;
    
    /**
     * Tabs belonging to this session.
     * @type {Session.Tab}
     */
    this.tabs = options.tabs || [];

    /**
     * The name of the session.
     * @type {?string}
     */
    this.name = options.name || null;

    this.update();

    Session.all.push(this);
    if(options.window && options.window.focused) this.focused();
};

/**
 * Moves the session to the top of the list when it's window is focused.
 */
Session.prototype.focused = function() {
    this.remove();
    Session.all.splice(0, 0, this);
};

/**
 * Closes the window associated with the session.
 */
Session.prototype.close = function() {
    if(this.id) chrome.windows.remove(this.id);
};

/**
 * Removes the session from the list of all sessions.
 */
Session.prototype.remove = function() {
    for(var s = 0; s < Session.all.length; s++) {
        if(Session.all[s] == this) {
            Session.all.splice(s, 1);
            return;
        }
    }
};

/**
 * Updates the session details based on it's window.
 */
Session.prototype.update = function() {
    if(!this.id) return;
    var self = this,
        options = { populate: true };
    chrome.windows.get(this.id, options, function(win) {
        self.tabs = [];
        win.tabs.forEach(function(tab) {
            self.tabs.push(new Session.Tab({
                id: tab.id,
                url: tab.url,
                title: tab.title,
                icon: tab.favIconUrl
            }));
        });
    });
};


/**
 * Manages session data for a tab.
 * @constructor
 * @param {Object} options
 * @param {?number} options.id The ID of the tab it is associated with.
 * @param {?string} options.url URL of the tab.
 * @param {?string} options.title Title of the tab.
 * @param {?string} options.icon URL of the icon image for the tab.
 */
Session.Tab = function(options) {

    /**
     * The ID of the tab it is associated with.
     * @type {?number}
     */
    this.id = options.id || null;
    
    /**
     * URL of the tab.
     * @type {?string}
     */
    this.url = options.url || null;

    /**
     * Title of the tab.
     * @type {?string}
     */
    this.title = options.title || null;

    /**
     * URL of the icon image for the tab.
     * @type {?string}
     */
    this.icon = options.icon || null;
};


/**
 * List of all (open and closed) sessions.
 * @type {Session}
 */
Session.all = [];

/**
 * Saves the current state of the sessions.
 */
Session.save = function() {

    //Limit the amount of sessions
    Session.all = Session.all.slice(0, 64);

    //Get the session save data
    var saveData = [];
    Session.all.forEach(function(session) {
        var tabData = [];
        session.tabs.forEach(function(tab) {
            tabData.push({
                url: tab.url,
                title: tab.title,
                icon: tab.icon
            });
        });
        saveData.push({
            name: session.name,
            tabs: tabData
        });
    });
    localStorage.setItem("savedSessions", JSON.stringify(saveData));

    //Update any open popups
    chrome.extension.getViews().forEach(function(popup) {
        if(popup.renderSessions) setTimeout(function() {
            popup.renderSessions(window);
        }, 100);
    });
};

/**
 * Returns the session that has a certain window attached to it.
 * @param {number|Window} idOrWindow Session ID or chrome window object.
 * @return {?Session}
 */
Session.get = function(idOrWindow) {
    if(!idOrWindow) return;
    var id, win;
    if(typeof idOrWindow == "number") id = idOrWindow;
    else {
        win = idOrWindow;
        id = win.id;
    }
    for(var s = 0; s < Session.all.length; s++) {
        var session = Session.all[s];
        if(session.id == id) return session;

        //Check the URL of each tab to see if the window matches the session
        if(win && !session.id && win.tabs.length == session.tabs.length) {
            var match = true;
            for(var t = 0; t < win.tabs.length; t++) {
                if(!Session.isSameUrl(win.tabs[t].url, session.tabs[t].url)) {
                    match = false;
                    break;
                }
            }
            if(match) return session;
        }
    }
    return null;
};

/**
 * Checks if two URLs are the same page.
 * @param {string} url1
 * @param {string} url2
 * @return {boolean} True if they are the same page.
 */
Session.isSameUrl = function(url1, url2) {
    function clean(url) {
        var hashIndex = url.indexOf("#");
        if(~hashIndex) url = url.substr(0, hashIndex);
        return url;
    }
    return clean(url1) == clean(url2);
};

/**
 * Create a new session based on a new window or returns the existing session
 * associated with the window.
 * @param {Window} win
 * @return {Session}
 */
Session.onWindowCreated = function(win) {
    if(!win) return;
    var session = Session.get(win);
    if(session) {
        session.id = win.id;
        session.tabs.forEach(function(tab, t) {
            tab.id = win.tabs[t].id;
        });
    }
    else new Session({
        window: win
    });
};

/**
 * Creates sessions from saved sessions and currently open windows.
 */
Session.initialise = function() {

    //Get saved sessions
    var savedSessions = JSON.parse(localStorage.getItem("savedSessions")) || [];
    savedSessions.forEach(function(saveData) {
        var tabs = [];
        saveData.tabs.forEach(function(tab) {
            tabs.push(new Session.Tab({
                url: tab.url,
                title: tab.title,
                icon: tab.icon
            }));
        });
        new Session({
            name: saveData.name,
            tabs: tabs
        });
    });

    //Create sessions from currently open windows
    var options = { populate: true };
    chrome.windows.getAll(options, function(allWindows) {
        allWindows.forEach(Session.onWindowCreated);
    });
    Session.save();

    //Move the most recently focused window to the top of the list
    chrome.windows.onFocusChanged.addListener(function(id) {
        var session = Session.get(id);
        if(session) {
            session.focused();
            Session.save();
        }
    });

    //Associate new windows with sessions
    chrome.windows.onCreated.addListener(function(win) {
        var options = { populate: true };
        /*
         * Sometimes the onCreated event will be fired when the window does not
         * exist (mostly when loading a developer tools window) and the callback
         * for chrome.windows.get will still be called despite the window not
         * existing.
         */
        chrome.windows.get(win.id, options, Session.onWindowCreated);
        Session.save();
    });

    //Close sessions when their window is closed
    chrome.windows.onRemoved.addListener(function(windowId) {
        var session = Session.get(windowId);
        if(session) {
            if(session.tabs.length) session.id = null;

            //Remove the session if it has no tabs
            else for(var s = 0; s < Session.all.length; s++) {
                var session = Session.all[s];
                if(session.id == windowId) {
                    Session.all.splice(s, 1);
                    break;
                }
            }
            session.id = null;
            Session.save();
        }
    });

    //Update sessions when tabs change
    function sessionChanged(windowId) {
        var session = Session.get(windowId);
        if(session) {
            session.update();
            Session.save();
        }
    }
    chrome.tabs.onCreated.addListener(function(tab) {
        sessionChanged(tab.windowId);
    });
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        sessionChanged(tab.windowId);
    });
    chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
        sessionChanged(moveInfo.windowId);
    });
    chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {
        sessionChanged(detachInfo.oldWindowId);
    });
    chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
        sessionChanged(attachInfo.newWindowId);
    });
    chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
        if(!removeInfo.isWindowClosing) sessionChanged(removeInfo.windowId);
    });
    chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
        /** @todo Should I be handling this event...? */
        for(var s = 0; s < Session.all.length; s++) {
            var session = Session.all[s];
            for(var t = 0; t < session.tabs.length; t++) {
                if(session.tabs[t].id == removedTabId) {
                    sessionChanged(session.id);
                    return;
                }
            }
        }
    });
};

Session.initialise();
