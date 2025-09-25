# Screenshots

Importing URLs into Hydrui is fairly easy. You can right click in any page view and select &ldquo;Import URLs&rdquo; from the context menu. This screenshot tour will showcase some Japanese artwork, but of course, you can use hydrus network to organize pretty much any kind of media files.

In addition to importing files by URL, you can also drag and drop files into any page. When dragging files into a hydrus network page, it will add the files to that page.

[![A screenshot showing three URLs being imported with Hydrui.](/screenshots/1-importing-urls.png)](/screenshots/1-importing-urls.png)

Browsing files is somewhat similar to the desktop hydrus network client UI, though the sidebar is quite different. You can't really access most of the sidebar functionality that is available in hydrus network, though the sidebar here does have some useful information that the hydrus network client doesn't by default, like file ratings. The sidebar experience will probably change in the future.

[![The main page view in Hydrui.](/screenshots/2-browsing-files.png)](/screenshots/2-browsing-files.png)

It is possible to edit tags, URLs and notes for each file. Here's what the notes editor looks like:

[![Screenshot of the Hydrui notes editor showing notes from an imported Twitter post.](/screenshots/3-notes-editor.png)](/screenshots/3-notes-editor.png)

[![Screenshot showing the notes editor showing an edit summary. Hydrui usually offers a summary so you can double check what you're about to do.](/screenshots/4-notes-editor.png)](/screenshots/4-notes-editor.png)

Here's what the tag editing experience looks like:

[![Screenshot of the Hydrui tag editor showing tags from 3 imported posts.](/screenshots/5-tags-editor.png)](/screenshots/5-tags-editor.png)

[![Screenshot showing edit summaries for the tag editor.](/screenshots/6-tags-editor.png)](/screenshots/6-tags-editor.png)

The tag list offers some handy shortcuts. There's also now the ability to quickly add and remove tags directly in the tag list, which is great for organizing a lot of files quickly. Be careful though: changes apply immediately when you do this! The tag list will switch to showing storage tags instead of display tags when in quick edit mode, which means things like tag siblings will no longer take effect. In addition, Hydrui remembers whatever tag service you were last viewing in the Edit Tags modal; it will also be used here.

[![Screenshot showing the context menu of the tag list.](/screenshots/7-tag-list.png)](/screenshots/7-tag-list.png)

[![Screenshot showing the quick edit mode of the tag list.](/screenshots/8-quick-edit-tags.png)](/screenshots/8-quick-edit-tags.png)

Hydrui offers some configurability, though note that settings are currently only saved in local storage, so they will not move across browsers or anything.

[![Screenshot showing editing tag colors in the settings modal.](/screenshots/9-settings.png)](/screenshots/9-settings.png)

Hydrui offers the ability to search for similar files. It uses the same search query that the hydrus network client itself uses.

[![Screenshot showing the "Find Similar" options in the file context menu.](/screenshots/10-find-similar.png)](/screenshots/10-find-similar.png)

Many operations need to be able to open new pages, but it isn't possible to do this via the hydrus network client API yet. For now, Hydrui has virtual pages. These will be used to show things like job results, similarity search results, and so on.

[![Screenshot showing a virtual tab opened off of a tag.](/screenshots/11-virtual-tabs.png)](/screenshots/11-virtual-tabs.png)

Hydrui supports a lot of different kinds of media. Most of the time, it will use your browser's native capabilities to display images and videos. However, Hydrui also ships a copy of Ruffle for displaying Adobe Flash content, PDF.js for displaying PDF files, and OGV.js for displaying Ogg Theora (and WebM, on some devices that do not support WebM.) In addition, Hydrui has its own PSD parser and renderer. It isn't up to par with what [Photopea](https://www.photopea.com/) is capable of, but it will view many simple PSD files very well. Here is a rendering of a [free Fanbox PSD release](https://www.fanbox.cc/@foe/posts/10453143) by ポエ.

The PSD renderer is a work-in-progress. GPU compositing and support for more advanced compositing features is planned eventually, as well as basic support for Clip Studio Paint CLIP files.

[![Screenshot showing the Hydrui PSD viewer.](/screenshots/12-psd-viewer.png)](/screenshots/12-psd-viewer.png)
