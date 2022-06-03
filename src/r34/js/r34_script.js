'use strict';
const parser = new DOMParser();
const S = '%20'
const lim = '&limit='
const pid = '&pid='
const tag = '&tags='
var Plim = 25;
var Ppid = 0;
var Ptag = '';
const Pmtg_default = '%20sort:id:'
var Pmtg = '%20sort:id:desc';
var count = {posts:0, prevPosts:0}



// tags
// rule 34 tag search
var Tlim = 0;
var tags_target_body = 'https://api.rule34.xxx//index.php?page=dapi&s=tag&q=index&order=count&name_pattern=';

async function getTags(input) {
    console.log('get request!!!')
    var tagArray = new Array();
    await fetch(tags_target_body+input+lim+Tlim)
        .then(response => response.text())
        .then(text => {
            var tags_xml = parser.parseFromString(text, "text/xml");
            var json_arr = xml2json(tags_xml, 'tag');
            json_arr.reverse();
            var tags = json_arr.slice(0, 10);
            tags.forEach(tag => tagArray.push(tag.name))
        });
    return tagArray;
}

// posts
// rule 34 post search
var post_target_body = 'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index';
var prevPreq;

function readSearchURL() {
    var query = window.location.search;
    if (query == '') {
        console.log('search is empty')
        return;
    }
    var params = new URLSearchParams(query);
    var tags = params.get('tags');
    if (tags != null) {
        Ptag = decodeURI(tags);
    }
    var sort_type = params.get('sort_type');
    if (sort_type != null && sort_type != '') {
        var order = params.get('order');
        Pmtg = S +'sort:' + sort_type + ':' + order;
    } else {
        var order = params.get('order');
        Pmtg = Pmtg_default + order;
    }
    var rating = params.get('rating');
    if (rating != null && rating != '') {
        Pmtg = Pmtg.concat(S + 'rating:' + rating);
    }
    var min_score = params.get('score');
    if (min_score != null && min_score != '') {
        Pmtg = Pmtg.concat(S + 'score:>=' + min_score);
    }
}

function readSearch() {
    // get all params for URL:
    var input = document.getElementById('search').value;
    Ptag = input.replaceAll(' ', S);
    var sort_type = document.getElementById('sorting').value;
    if (sort_type != '') {
        var order = document.getElementById('order').value;
        Pmtg = S +'sort:' + sort_type + ':' + order;
    } else {
        var order = document.getElementById('order').value;
        Pmtg = Pmtg_default + order;
    }
    var rating = document.getElementById('rating').value;
    if (rating != '') {
        Pmtg = Pmtg.concat(S + 'rating:' + rating);
    }
    var min_score = document.getElementById('score').value;
    if (min_score != '') {
        Pmtg = Pmtg.concat(S + 'score:>=' + min_score);
    }
    var container = document.getElementById('container');
    var container1 = document.createElement('div');
    container1.setAttribute('class', 'container-f')
    container1.setAttribute('id', 'container-1')
    count.posts = 0;
    prevPreq = undefined;
    container.replaceChildren(container1);
    getThumbs();
}

async function evadeDupls(currPreq) {
    console.log('tested curreq')
    console.log(currPreq)
    if (prevPreq == undefined) {
        return currPreq; // return the same arr if there is no previous
    }
    var duplI = prevPreq.findIndex(post => post.id == currPreq[0].id);
    console.log('duplI ' + duplI)
    if (duplI > -1) {
        var duplC = Plim - duplI;
        for (var n = 0; n < duplC; n++) {
            currPreq.shift(); // cut duplicates
        }
    } else {
        console.log('currreq returned')
        return currPreq; // return the same arr if there is no collapsing
    }
    // grab missing images to satisfy the limit
    var offset = Plim*Ppid;
    for (var sPlim = duplC; offset % sPlim != 0; sPlim++) {}
    var sPpid = offset / sPlim + 1;
    var missing = await getMissThumbs(sPlim, sPpid);
    if (missing.length > duplC) {
        for (var n = 0; n < missing.length - duplC; n++) {
            missing.pop();
        }
    }
    currPreq = currPreq.concat(missing);
    console.log('updated currreq');
    console.log(currPreq);
    return Promise.resolve(currPreq);
}

async function getMissThumbs(limit, page_number) {
    var response = await fetch(post_target_body+lim+limit+pid+page_number+tag+Ptag+Pmtg)
        .then(response => response.text())
        .then(text => parser.parseFromString(text, "text/xml"))
        .then(post_xml => xml2json(post_xml, 'post'));
    return response;
}

function getThumbs() {
    console.log('get')
    fetch(post_target_body+lim+Plim+pid+Ppid+tag+Ptag+Pmtg)
        .then(response => response.text())
        .then(text => parser.parseFromString(text, "text/xml"))
        .then(xml => checkCount(xml, 'posts'))
        .then(post_xml => xml2json(post_xml, 'post'), reason => { console.log(reason); getThumbs(); return Promise.reject('new get is made'); })
        .then(array => evadeDupls(array))
        .then(evaded => {
            // keep Previous request and make new request
            prevPreq = evaded;
            console.log(prevPreq)
            return evaded;
        })
        .then(json => thumb2container(json));
}

function checkCount(xml, header_type) {
    if (header_type != 'posts') {
        return // work only with posts
    }
    count.prevPosts = count.posts;
    count[header_type] = xml.getElementsByTagName(header_type)[0].getAttribute('count');
    console.log('offset: ' + (count.posts - count.prevPosts));
    if (count.posts - count.prevPosts > Plim && count.prevPosts != 0) {
        var offset = count.posts - count.prevPosts;
        Ppid = Ppid + Math.floor(offset / Plim);
        throw new Error('New posts offset are more than limit or equal, pid is corrected, new Get')
    }
    return xml;
}

function xml2json(xml, type) {
    var array = [];
    var entities = xml.getElementsByTagName(type);
    for(var n = 0; n < entities.length; n++) {
        array.push(new Entity (entities[n]));
    }
    return array;
}

class Entity {
    constructor(entity) {
        var _this = this;
        var attrs = entity.attributes;
        for(var n = 0; n < attrs.length; n++) {
            _this[attrs[n].nodeName] = attrs[n].nodeValue;
        }
    }
}

function thumb2container(array) {
    var container = document.getElementById('container');
    var container1 = document.getElementById('container-1');
    var width_style = parseInt(getComputedStyle(container1).width);
    if (container.querySelectorAll('.container-f').length > 1) {
        var container2 = document.getElementById('container-2');
        } else {
    if (window.innerWidth > 450) {
        container2 = document.createElement('div');
        container2.setAttribute('class', 'container-f');
        container2.setAttribute('id', 'container-2');
        container.appendChild(container2)
        }
    }
    // init length
    if (container1.getElementsByTagName('div').length == 0 && ( container2 == undefined || container2.getElementsByTagName('div').length == 0)) {
        var length1 = 0;
        var length2 = 0;
        } else {
        var divs1 = container1.getElementsByTagName('div');
        var length1 = divs1[divs1.length - 1].offsetTop + divs1[divs1.length - 1].offsetHeight;
    if (container2 != undefined) {
        var divs2 = container2.getElementsByTagName('div');
        var length2 = divs2[divs2.length - 1].offsetTop + divs2[divs2.length - 1].offsetHeight;
        }
    }
    array.forEach(function(post, i) {
        var div = document.createElement('div');
        div.innerHTML = '<a href=' + post.sample_url + '><img class="thumb" src="' + post.preview_url + '">'
        var meta = document.createElement('p');
        meta.setAttribute('class', 'i-info');
        meta.setAttribute('width', post.width);
        meta.setAttribute('height', post.height);
        meta.setAttribute('file', post.file_url);
        div.appendChild(meta)
        div.setAttribute('class', 'img-c');
        div.setAttribute('n', i);
        var height = +(post.preview_height*(width_style/post.preview_width).toFixed(5));
        if (container2 == undefined) {
            container1.appendChild(div);
        } else {
            if (length2 < length1) {
                div = container2.appendChild(div);
                length2 = length2 + height;
                } else {
                div = container1.appendChild(div);
                length1 = length1 + height;
            }
        }
    });
}

// changing layout
function changeLayout() {
    if (window.innerWidth > 450 && document.querySelectorAll('.container-f').length < 2) {
        col2colcol()
        } else {
    if (window.innerWidth < 450 && document.querySelectorAll('.container-f').length > 1) {
        colcol2col()
        } else {
    return
        }
    }
}
function colcol2col() {
    var container1 = document.getElementById('container-1');
    var container2 = document.getElementById('container-2');
    if (container2 == undefined) { // if function is triggered incorrectly
        return;
    }
    var imgs1 = container1.getElementsByTagName('div');
    var imgs2 = container2.getElementsByTagName('div');
    var length1 = 0;
    var length2 = 0;
    var scheme = [];
    var c = 1;
    var n1 = 0;
    var n2 = 0;
    while (c < imgs1.length + imgs2.length) {
        // read guide
        if (scheme.length == 0) {
            var b = false;
        } else {
            var b = scheme[scheme.length - 1];
        }
        // do
        if (b) {
            // check new right
            length2 = +(length2 + imgs2[n2].getBoundingClientRect().height).toFixed(5);
            scheme.push(length2 < length1); // true -> to the right or false -> to the left
            n2++;
        } else {
            // check new left
            length1 = +(length1 + imgs1[n1].getBoundingClientRect().height).toFixed(5);
            scheme.push(length2 < length1); // true -> to the right or false -> to the left
            n1++;
        }
        c++;
    }
    // use scheme to place items
    n1 = imgs1.length - 1;
    n2 = imgs2.length - 1;
    while(scheme.length > 0) {
        if (scheme.pop()) {
            imgs1[n1].after(imgs2[n2]);
            n2--;
        } else {
            n1--;
        }
    }
    var container = document.getElementById('container');
    container.removeChild(container2);
}
function col2colcol() {
    var container = document.getElementById('container');
    var container1 = document.getElementById('container-1');
    var container2 = document.getElementById('container-2');
    if (container2 != undefined) { // if function is triggered incorrectly
        return;
    }
    container2 = document.createElement('div');
    container2.setAttribute('class', 'container-f');
    container2.setAttribute('id', 'container-2');
    var imgs1 = container1.getElementsByTagName('div');
    var length1 = 0;
    var length2 = 0;
    var n1 = 0;
    var n2 = 0;
    // start loop
    var l = imgs1.length;
    for (var c = 0; c < l; c++) {
        if (length2 < length1) {
            length2 = +(length2 + imgs1[n2].getBoundingClientRect().height).toFixed(5);
            container2.appendChild(imgs1[n2])
            } else {
            length1 = +(length1 + imgs1[n1++].getBoundingClientRect().height).toFixed(5);
            n2++;
        }
    }
    container.appendChild(container2);
}

// Update
function updateThumbs() {
    if ((Math.floor(scrollListener.scrollTop) + 400) > (scrollListener.scrollHeight - scrollListener.clientHeight)) {
        Ppid++
        getThumbs();
    }
}

async function giveHint() {
    var container, b;
    // get Event input
    var inputField = document.getElementById('search');
    var input = inputField.value.split(' ').slice(-1)[0];
    if (input.length < 3) {
        console.log('break')
        return // don't send request
    }
    // setting up the list
    container = document.getElementById("autocomplete-list");
    if (container == null) {
        container = document.createElement("div");
        container.setAttribute("id", "autocomplete-list");
        container.setAttribute("class", "autocomplete-items");
        inputField.parentNode.appendChild(container);
        // receiving the autocomplete values
        var array = await getTags(input);
    } else {
        // receiving the autocomplete values
        var array = await getTags(input);
        container.replaceChildren();
    }
    // creating hint nodes
    for (var n = 0; n < array.length; n++) {
        b = document.createElement("div");
        var strong = array[n].substr(array[n].search(input), input.length);
        var p1 = array[n].substr(0, array[n].search(input));
        var p2 = array[n].substr(array[n].search(input) + input.length);
        b.innerHTML = p1 + "<strong>" + strong + "</strong>" + p2;
        b.innerHTML += "<input type='hidden' value='" + array[n] + "'>";
        b.addEventListener("click", function(e) {
            var inputIndx = inputField.value.lastIndexOf(input);
            inputField.value = inputField.value.slice(0, inputIndx).concat(this.getElementsByTagName("input")[0].value);
            closeAllLists();
            });
        container.appendChild(b);
    }
    console.log('done')
}

function closeAllLists() {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    console.log('closed')
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      x[i].parentNode.removeChild(x[i]);
  }
}

// function responsiveImgCtrl(entries) {
//     var img = entries[0].target;
//     var height = img.offsetHeight;
//     var width = img.offsetWidth;
//     var container = img.parentElement;
//     var max_height = container.offsetHeight;
//     var max_width = parseInt(container.style.maxWidth);
//     if (height >= max_height && !max_width) {
//         container.style.maxWidth = width + 'px';
//         } else {
//     if (max_width && width < max_width) {
//         container.style.maxWidth = '';
//         }
//     }
// }


document.addEventListener("click", function (e) {
    closeAllLists();
});

var start = new Promise((res) => {
    res(readSearchURL());
});
start.then(getThumbs);