'use strict';

var limit = 25;
var count = 0;
var last = '';
var query = '?after=' + last + '&count=' + count + '&limit=' + limit + '&raw_json=1';
var path_base = 'https://oauth.reddit.com/';
var path_mod = '/r/gonewild/new';

var TOKEN;
const PLATFORM = navigator.platfrom || navigator.userAgentData.platform;
const APP_INFO = ':viewru_test:v0.1 (by /u/MrGovart)'
const server = 'http://127.0.0.1:3000'

async function get(path) {
    const response = await fetch(path, {
        method: 'GET',
        headers: {
            'Authorization': 'bearer ' + TOKEN,
            'User-Agent': PLATFORM + APP_INFO,
        },
    })
    .then(  response => {
            console.log(response);
            if (response.status == 401) {
                throw new Error('Token is expired');
                } else {
            if (response.status == 200) {
                return response;
            }
        }
    });
    return response;
}

function getToken() {
    fetch(server + '/reddit_token').then(response => response.text()).then(text => TOKEN = text);
}
async function refreshToken() {
    const response = await fetch(server + '/reddit_token_refresh')
    .then(response => response.text())
    .then(text => TOKEN = text);
    return response;
}

function getThumbs() { // params...
    query = '?after=' + last + '&count=' + count + '&limit=' + limit + '&raw_json=1';
    get(path_base + path_mod + query)
    .then(
    response => response.json(),
    () => refreshToken().then(() => { console.log('Token is updated, re-requesting'); return get(path_base + path_mod + query); }).then(response => response.json())  // error handling on token expiration
    )
    .then(json => {
        // page control
        var c = json.data.children;
        var l = c.length;
        last = c[l - 1].data.name;
        count += l;

        console.log(json);
        parseToCont(json);
    })
}

function parseToCont(json) {
    var posts_array = [];
    if (json.kind === 'Listing') {
        var data = json.data.children;
        data.forEach((post, i) => {
            console.log(post);
            console.log(i);
            var post = post.data;
            var domain = post.domain;
            switch (true) {
                case (domain.startsWith('self.')):
                    console.log('self post');
                    break;
                case (domain.includes('imgur')):
                    if (post.post_hint == 'image') {
                        var src = post.url;
                        var width = post.preview.images[0].source.width;
                        var height = post.preview.images[0].source.height;
                        // append as image
                        if (post.preview != undefined) {
                            var fallback = post.preview.images[0];
                        }
                        posts_array.push({type: 'image', src: src, width: width, height: height, fallback: fallback});
                        } else {
                    if (post.post_hint == 'link') {
                        var src = post.url;
                        if (src.endsWith('.gifv')) {
                            src = post.preview.images[0].source;
                            posts_array.push({type: 'gif-video', src: post.url.replace('.gifv', '.mp4'), width: src.width, height: src.height})
                        } else {
                            console.log('unsupported case');
                            console.log(post);
                            posts_array.push({type: 'unsupported', src: url});
                        }
                    }}
                break;
            case (domain == 'i.redd.it'):
                if (post.post_hint == 'image') {
                    var src = post.url;
                    var width = post.preview.images[0].source.width;
                    var height = post.preview.images[0].source.height;
                    if (width == undefined || height == undefined) {
                        console.log('dimensions fetching of reddit image is fucked up')
                        console.log(post)
                    }
                    // append as image
                    if (post.preview != undefined) {
                        var fallback = post.preview.images[0];
                    }
                    posts_array.push({type: 'image', src: src, width: width, height: height, fallback: fallback});
                    }
                break;
            case (domain == 'v.redd.it'):
                if (post.post_hint == 'hosted:video') {
                    var src = post.secure_media.reddit_video; // dimensions inside
                    // append as video
                    posts_array.push({type: 'video', src: {dash: src.dash_url, hls: src.hls_url, mp4: src.fallback_url}, width: src.width, height: src.height})
                    }
                break;
            case (domain == 'redgifs.com' || domain == 'gfycat.com'):
                var link = post.url;
                if (post.preview != undefined) {
                    src = post.preview.reddit_video_preview; // dimensions inside
                    if (src != undefined) {
                        posts_array.push({type: 'scrapped_video', src: {dash: src.dash_url, hls: src.hls_url, mp4: src.fallback_url}, width: src.width, height: src.height, scrape: link})
                        return;
                        }
                    } else {
                if (post.secure_media != null) {
                    src = post.secure_media.oembed;
                    if (src != undefined) {
                        posts_array.push({type: 'scrapped_video_thumb', src: src.thumbnail_url, width: src.thumbnail_width, height: src.thumbnail_height, scrape: link});
                        return;
                        } else {
                        posts_array.push({type: 'scrapped_video_thumb', src: post.thumbnail, width: post.thumbnail_width, height: post.thumbnail_height, scrape: link})
                        return;
                        }
                    }
                }
                break;
            default:
                switch (true) {
                    case (post.post_hint == 'image'):
                        var src = post.url;
                        var width = post.preview.images[0].source.width;
                        var height = post.preview.images[0].source.height;
                        if (post.preview != undefined) {
                            var fallback = post.preview.images[0];
                        }
                        posts_array.push({type: 'image', src: src, width: width, height: height, fallback: fallback});
                        break;
                    case (post.post_hint == 'link'):
                        var src = post.preview.images[0].source.url;
                        var width = post.preview.images[0].source.width;
                        var height = post.preview.images[0].source.height;
                        var link = post.url;
                        posts_array.push({type: 'scrapped_video_thumb', src: src, width: width, height: height, scrape: link})
                        break;
                    default:
                        console.log('unsupported case');
                        console.log(post);
                        var url = post.url;
                        posts_array.push({type: 'unsupported', src: url})
                        // create div-block with link
                }
            }
        });
    } else {
        console.log('It is not a listing!');
        return;
    }
    console.log(posts_array)
    appendContainer(posts_array);
}

function appendContainer(posts_array) {
    // main containers init
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
    // length init
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
    posts_array.forEach(function(post, i) {
        switch (post.type) {
            case 'image':
                var div = document.createElement('div');
                    div.setAttribute('class', 'img-c');
                    div.setAttribute('n', i);
                var image = new Image(post.width);
                    image.onerror = () => {
                        if (post.fallback != undefined) {
                            var type = image.src.substring(image.src.lastIndexOf('.') + 1);
                            if (post.fallback.variants && post.fallback.variants[type] != undefined) {
                                image.src = post.fallback.variants[type].source.url;
                                } else {
                                image.src = post.fallback.source.url;
                            }
                            } else {
                            image.src = '' // HERE put a placeholder instead
                        }
                    }
                    image.src = post.src;
                    image.className = 'thumb';
    //            var meta = document.createElement('p');
    //            meta.setAttribute('class', 'i-info');
    //            meta.setAttribute('file', post.file_url);
    //            div.appendChild(meta)
                div.appendChild(image);
                var height = +(post.height*(width_style/post.width).toFixed(5));
                break;
            case 'video':
                var div = document.createElement('div');
                    div.setAttribute('class', 'img-c');
                    div.setAttribute('n', i);
                var video = document.createElement('video');
                    video.setAttribute('class', 'video-js');
                    if (post.width < post.height) {
                        video.className += ' vjs-9-16';
                    }
                    video.setAttribute('data-setup', '{}');
                    video.setAttribute('autoplay', 'autoplay');
                    video.setAttribute('loop', 'loop');
                var source = document.createElement('source')
                    source.src = post.src.hls;
                    source.type = 'application/x-mpegURL'
                    video.appendChild(source);
                var source = document.createElement('source')
                    source.src = post.src.dash;
                    source.type = 'application/x-mpegURL'
                    video.appendChild(source);
                var source = document.createElement('source')
                    source.src = post.src.mp4;
                    source.type = 'video/mp4'
                    video.appendChild(source);
                div.appendChild(video);
                var height = +(post.height*(width_style/post.width).toFixed(5));
                break;
            case 'gif-video':
                var div = document.createElement('div');
                    div.setAttribute('class', 'img-c');
                    div.setAttribute('n', i);
                var video = document.createElement('video');
                    video.setAttribute('class', 'video-js');
                    if (post.width < post.height) {
                        video.className += ' vjs-9-16';
                    }
                    video.setAttribute('data-setup', '{}');
                    video.setAttribute('autoplay', 'autoplay');
                    video.setAttribute('loop', 'loop');
                var source = document.createElement('source')
                    source.src = post.src;
                    source.type = 'video/mp4'
                    video.appendChild(source);
                div.appendChild(video);
                var height = +(post.height*(width_style/post.width).toFixed(5));
                break;
            case 'scrapped_video':
                var div = document.createElement('div');
                    div.setAttribute('class', 'img-c');
                    div.setAttribute('n', i);
                scrape(post.scrape, div);
                var video = document.createElement('video');
                    video.setAttribute('class', 'video-js');
                    if (post.width < post.height) {
                        video.className += ' vjs-9-16';
                    }
                    video.setAttribute('data-setup', '{}'); // HERE set player noramlly gdmnt
                    video.setAttribute('autoplay', 'autoplay');
                    video.setAttribute('loop', 'loop');
                    video.setAttribute('muted', 'muted');
                var source = document.createElement('source')
                    source.src = post.src.hls;
                    source.type = 'application/x-mpegURL'
                    video.appendChild(source);
                var source = document.createElement('source')
                    source.src = post.src.dash;
                    source.type = 'application/x-mpegURL'
                    video.appendChild(source);
                var source = document.createElement('source')
                    source.src = post.src.mp4;
                    source.type = 'video/mp4'
                    video.appendChild(source);
                div.appendChild(video);
                var height = +(post.height*(width_style/post.width).toFixed(5));
                break;
            case 'scrapped_video_thumb':
                var div = document.createElement('div');
                    div.setAttribute('class', 'img-c');
                    div.setAttribute('n', i);
                scrape(post.scrape, div);
                var image = new Image(post.width);
                    image.onerror = () => { image.src = '' }
                    image.src = post.src;
                    image.className = 'thumb';
                div.appendChild(image);
                var height = +(post.height*(width_style/post.width).toFixed(5));
                break;
            case 'unsupported':
                var div = document.createElement('div');
                    div.setAttribute('class', 'img-c');
                    div.setAttribute('n', i);
                var placeholder = new Image (300, 300);
                var a = document.createElement('a');
                    a.href = post.src;
                    a.appendChild(placeholder);
                div.appendChild(a);
                break;
            default:
                console.log('Default');
                break;
            }
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

async function scrape(url, div) {
    const video_url = await fetch(server + '/scrape?url=' + url).then(r => r.text());
    console.log(video_url);
    if (!video_url) {
        console.log(div)
        if (div.querySelector('img').src == window.location.href) {
            div.remove();
        }
        throw new Error ('Wrong scrapping');
        } else {
    if (video_url == 'failed') {
        console.log(div)
        if (div.querySelector('img').src == window.location.href) {
            div.remove();
        }
        throw new Error ('Source is not found');
        } else {
    if (video_url == '404') {
        console.log(div)
        if (div.querySelector('img').src == window.location.href) {
            div.remove();
        }
        throw new Error ('Source returned 404');
        }
    }}
    if (video_url.includes('redgifs.com')) {
        var url = video_url.replace('-mobile', '');
    } else {
        var url = video_url;
    }
    var link = document.createElement('a');
        link.href = url;
    var img = div.firstChild;
    div.appendChild(link);
    link.appendChild(img);
}

// async function fetchIMG(url, img) {
//     fetch(url, {referrerPolicy: "no-referrer"}).then(response => response.blob())
//     .then(imageBlob => {
//         const imageObjectURL = URL.createObjectURL(imageBlob);
//         img.src = imageObjectURL;
//   });
// }

getToken()