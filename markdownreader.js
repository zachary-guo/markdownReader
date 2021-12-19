(function(document) {

	// 一开始就获得原始 markdown 的内容
	var originalText = document.body.innerText;
	
	//忽略HTML代码
	if (document.doctype) return;

    document.write('<!DOCTYPE html><html>' +
		'<head>' +
		'<body>' +
		'  <div id="container" class="viewport-flip">' +
		'    <div id="text-container" class="content flip" style="display:none;"></div>' +
		'    <div id="markdown-container" class="content flip"></div>' +
		'    <div id="markdown-outline"></div>' +
		'  </div>' +
		'  <div id="markdown-outline-toggle"></div>' +
		'  <div id="markdown-backTop" onclick="window.scrollTo(0,0);"></div>' +
		'</body>' +
		'</html>');
    document.close();
	
	$("#markdown-outline-toggle").on("click", toggleOutline);
	
	var isCtrl = false;
	$(document).keydown(function(event) {
        // 88 是 x 键，17 是 ctrl 键
        if (isCtrl && event.keyCode == 88) {
            toggleOutline();
        }
		isCtrl = (event.keyCode == 17);
    }); 
	
	function toggleOutline() {
		$("#markdown-outline").toggle(300);
	}

	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = chrome.extension.getURL('markdownreader.css');
	document.head.appendChild(link);

	link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = chrome.extension.getURL('hljs.min.css');
	document.head.appendChild(link);

	link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = chrome.extension.getURL('katex.min.css');
	document.head.appendChild(link);

	window.onresize = showOutline;
	
	var jTextContainer = $('#text-container');
	var jMarkdownContainer = $('#markdown-container');
	var jOutline = $('#markdown-outline');

	var isMarkdownMode = true;
	$(document).on('dblclick',toggleMode);

	function toggleMode(e){
		// 内容区外点击才会切换模式
		if($(e.target).closest('.content').length === 0){
			if(isMarkdownMode){
				jMarkdownContainer.addClass('out').removeClass('in');
				isMarkdownMode = false;
				jMarkdownContainer.one('webkitAnimationEnd', function(){
					jTextContainer.show().addClass('in').removeClass('out');
					jMarkdownContainer.hide();
				});
			}
			else{
				jTextContainer.addClass('out').removeClass('in');
				jTextContainer.one('webkitAnimationEnd', function(){
					jMarkdownContainer.show().addClass('in').removeClass('out');
					jTextContainer.hide();
					isMarkdownMode = true;
				});
			}
			return false;
		}
	}

	jMarkdownContainer.on('webkitAnimationEnd', function(){
		if(isMarkdownMode){
			showOutline();
		}
		else{
			hideOutline();
		}
	});

	var markdownConverter = new showdown.Converter({
		tables: true,
		strikethrough: true,
		simplifiedAutoLink: true,
		tasklists: true,
		literalMidWordUnderscores: true
	});
	var lastText = null;
	var outlineCount = 0;

	function updateMarkdown(text) {
		if (text !== lastText) {
			lastText = text;
			jTextContainer.text(text.replace(/\r\n?|\r?\n/g, '\r\n'));
			jMarkdownContainer.html(markdownConverter.makeHtml(lastText));
	        $('code').each(function(i, block){
	        	if(this.parentNode && /^pre$/i.test(this.parentNode.tagName)){
	        		hljs.highlightBlock(block);
	        	}
	        	else{
	        		$(this).addClass('inline');
	        	}
	        })
			updateOutline();
		}

		handleToc();
	}

	function updateOutline() {
		var arrAllHeader = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
		var arrOutline = ['<ul>'];
		var header, headerText;
		var id = 0;
		var level = 0,
			lastLevel = 1;
		var levelCount = 0;
		for (var i = 0, c = arrAllHeader.length; i < c; i++) {
			header = arrAllHeader[i];
			headerText = header.innerText;

			header.setAttribute('id', id);

			level = header.tagName.match(/^h(\d)$/i)[1];
			levelCount = level - lastLevel;

			if (levelCount > 0) {
				for (var j = 0; j < levelCount; j++) {
					arrOutline.push('<ul>');
				}
			} else if (levelCount < 0) {
				levelCount *= -1;
				for (var j = 0; j < levelCount; j++) {
					arrOutline.push('</ul>');
				}
			};
			arrOutline.push('<li>');
			arrOutline.push('<a href="#' + id + '">' + headerText + '</a>');
			arrOutline.push('</li>');
			lastLevel = level;
			id++;
		}
		arrOutline.push('</ul>')
		outlineCount = id;
		if(outlineCount > 0){
			jOutline.html(arrOutline.join(''));
            jOutline.find('ul').each(function(i,n){
                var jThis = $(this);
                if(jThis.children('li').length === 0){
                    jThis.replaceWith(jThis.children());
                }
            });
			showOutline();
		}
		else{
			hideOutline();
		}
	}

	function showOutline() {
		if(outlineCount > 0){
			var offset = jMarkdownContainer.offset();
			// alert("jMarkdownContainer.offset() = " + offset.left + ", jMarkdownContainer.outerWidth() = " + jMarkdownContainer.outerWidth())
			jOutline.css({
				// left: offset.left + jMarkdownContainer.outerWidth() + 10 + 'px',
				maxHeight: document.body.clientHeight - 30
			}).show();
		}
	}

	function hideOutline(){
		jOutline.hide();
	}

	var xmlhttp = new XMLHttpRequest();
	var fileurl = location.href,
		bLocalFile = /^file:\/\//i.test(fileurl);
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4 && xmlhttp.status != 404) {
			updateMarkdown(xmlhttp.responseText);
		}
	};

	function checkUpdate() {
		xmlhttp.abort();
		xmlhttp.open("GET", fileurl + '?rnd=' + new Date().getTime(), true);
		xmlhttp.send(null);
		if (bLocalFile) setTimeout(checkUpdate, 500);
	}

	if (bLocalFile) { // 直接使用本地 md 文件
		updateMarkdown(originalText);
	} else { // 使用 url 的 md 文件
		checkUpdate();
	}

	// [TOC]
	/**
	 * 制作 1-6 级标题多级序号，如 2.4.8.1
	 * @h 开始处理这个标题的下级标题，比如 $h = $("h2")，那么接下来要处理 h2 下的 h3，并做递归地处理 h3 下的 h4。当 $h 的 level = 6 时停止递归
	 */
	function docs($h) {
		var hLevel = parseInt($h.get(0).localName.replace(/h/i, ""));
		if (hLevel == 6) {
			return;
		}
		var ctoc = $h.attr("toc");
		$h.nextAll("h" + (hLevel + 1)).each(function(i) {
			var ntoc = ctoc + "." + (i + 1);
			if ($(this).find("i").length == 0) {
				$(this).attr("toc", ntoc).prepend("<i>" + ntoc + "</i>");
			} else {
				$(this).attr("toc", ntoc).find("i").text(ntoc);
			}
			docs($(this));
		});
	}
	function handleToc() {
		// 处理页面将 h1 作为顶级标题，或将 h2 作为顶级标题，等等
		var hs = ["h1", "h2", "h3", "h4", "h5", "h6"];
		$.each(hs, function(i, h) {
			$(".content " + h).each(function(i) {
				if (!$(this).attr("toc")) {
					$(this).attr("toc", i + 1).prepend("<i>" + (i + 1) + "</i>");
					docs($(this));
				}
			});
		})
	}

}(document));
