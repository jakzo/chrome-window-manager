
var container = document.querySelector("#windows");

//Render sessions
function renderSessions(backgroundPage) {

    //Remove any previous renderings
    while(container.firstChild) container.removeChild(container.firstChild);

    //Sort the sessions into active and inactive
    var activeSessions = [],
        inactiveSessions = [];
    backgroundPage.Session.all.forEach(function(session) {
        if(session.id) activeSessions.push(session);
        else inactiveSessions.push(session);
    });

    //Add the DOM elements of each session
    function addSession(session) {

        //Session display
        var element = document.createElement("div");
        element.classList.add("session");
        element.addEventListener("click", function(e) {
            if(session.id) chrome.windows.update(session.id, { focused: true });
            else {
                var urls = [];
                session.tabs.forEach(function(tab) {
                    urls.push(tab.url);
                });
                chrome.windows.create({ url: urls });
            }
        }, false);
        if(session.id) element.classList.add("session-active");
        container.appendChild(element);

        //Session title bar
        var sessionName = session.name ||
            session.tabs[0] && session.tabs[0].title || "-";
        var titleBar = document.createElement("div");
        element.appendChild(titleBar);

        function startEditing() {
            titleBar.replaceChild(titleInput, title);
            titleBar.replaceChild(titleDone, titleEdit);
            element.classList.add("session-selected");
            titleInput.focus();
        }
        function stopEditing() {
            titleBar.replaceChild(title, titleInput);
            titleBar.replaceChild(titleEdit, titleDone);
            element.classList.remove("session-selected");
        }

        var titleEdit = document.createElement("span");
        titleEdit.classList.add("title-icon");
        titleEdit.classList.add("title-edit");
        titleEdit.title = "Edit";
        titleEdit.addEventListener("click", function(e) {
            e.stopPropagation();
            if(!isEditingTitle) startEditing();
        }, false);
        titleBar.appendChild(titleEdit);

        var titleDone = document.createElement("span");
        titleDone.classList.add("title-icon");
        titleDone.classList.add("title-done");
        titleDone.title = "Edit";
        titleDone.addEventListener("click", stop, false);

        var isEditingTitle = false;
        var titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.value = sessionName;
        titleInput.classList.add("title");
        function stop(e) { e.stopPropagation(); }
        titleInput.addEventListener("click", stop, false);
        titleInput.addEventListener("mousedown", stop, false);
        titleInput.addEventListener("contextmenu", stop, false);
        titleInput.addEventListener("keypress", function(e) {
            if(e.keyCode == 13) this.blur();
        }, false);
        titleInput.addEventListener("change", function(e) {
            session.name = this.value.length ? this.value : null;
            backgroundPage.Session.save();
            title.textContent = titleInput.value;
        }, false);
        titleInput.addEventListener("blur", stopEditing, false);

        var title = document.createElement("span");
        title.classList.add("title");
        title.textContent = sessionName;
        titleBar.appendChild(title);

        var titleClose = document.createElement("span");
        titleClose.classList.add("title-icon");
        titleClose.classList.add(session.id ? "title-close" : "title-delete");
        titleClose.title = session.id ? "Close Window" : "Delete Session";
        titleClose.addEventListener("click", function(e) {
            e.stopPropagation();
            session.id ? session.close() : session.remove();
            backgroundPage.Session.save();
        }, false);
        titleBar.appendChild(titleClose);

        //Tab icon
        session.tabs.forEach(function(tab) {
            var tabIcon = document.createElement("div");
            tabIcon.classList.add("tab-icon");
            tabIcon.title = (tab.title ? tab.title + "\n" : "") + tab.url;
            if(tab.icon) {
                tabIcon.style.backgroundImage = "url('" + tab.icon + "')";
            }
            element.appendChild(tabIcon);
        });
    }
    activeSessions.forEach(addSession);
    inactiveSessions.forEach(addSession);
}

//Close popup when losing focus
//window.addEventListener("blur", close, false);

//Do not show context menu
window.addEventListener("contextmenu", function(e) {
    //e.preventDefault();
}, false);

//Render the sessions after getting the background page
chrome.runtime.getBackgroundPage(renderSessions);
